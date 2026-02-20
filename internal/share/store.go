// Package share manages file share metadata using SQLite.
package share

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// ErrNotFound is returned when a share is not found.
var ErrNotFound = errors.New("share not found")

// ErrExpired is returned when a share has expired.
var ErrExpired = errors.New("share expired")

// ErrExhausted is returned when a share has reached its download limit.
var ErrExhausted = errors.New("share download limit reached")

// Share represents a single file share entry.
type Share struct {
	ID           string
	Filename     string    // original filename
	EncryptedPath string   // path to encrypted file on disk
	KeyHex       string    // AES-256 key as hex
	CreatedAt    time.Time
	ExpiresAt    time.Time
	MaxDownloads int       // 0 = unlimited
	Downloads    int
	PasswordHash string    // bcrypt hash of password, empty = no password
	AdminToken   string    // token for admin operations
	Size         int64     // original file size in bytes
}

// IsExpired returns true if the share has expired.
func (s *Share) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// IsExhausted returns true if the share has hit its download limit.
func (s *Share) IsExhausted() bool {
	return s.MaxDownloads > 0 && s.Downloads >= s.MaxDownloads
}

// DownloadsRemaining returns how many downloads remain, or -1 if unlimited.
func (s *Share) DownloadsRemaining() int {
	if s.MaxDownloads == 0 {
		return -1
	}
	rem := s.MaxDownloads - s.Downloads
	if rem < 0 {
		return 0
	}
	return rem
}

// Store manages share persistence in SQLite.
type Store struct {
	db      *sql.DB
	dataDir string
}

// NewStore opens (or creates) a SQLite database at dataDir/shares.db.
func NewStore(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	dbPath := filepath.Join(dataDir, "shares.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	db.SetMaxOpenConns(1) // SQLite is single-writer

	s := &Store{db: db, dataDir: dataDir}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *Store) migrate() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS shares (
			id            TEXT PRIMARY KEY,
			filename      TEXT NOT NULL,
			encrypted_path TEXT NOT NULL,
			key_hex       TEXT NOT NULL,
			created_at    INTEGER NOT NULL,
			expires_at    INTEGER NOT NULL,
			max_downloads INTEGER NOT NULL DEFAULT 0,
			downloads     INTEGER NOT NULL DEFAULT 0,
			password_hash TEXT NOT NULL DEFAULT '',
			admin_token   TEXT NOT NULL DEFAULT '',
			size          INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);

		CREATE TABLE IF NOT EXISTS handshakes (
			id                  TEXT PRIMARY KEY,
			code                TEXT UNIQUE NOT NULL,
			receiver_public_key TEXT NOT NULL,
			sender_public_key   TEXT NOT NULL DEFAULT '',
			share_id            TEXT NOT NULL DEFAULT '',
			created_at          INTEGER NOT NULL,
			expires_at          INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_handshakes_code ON handshakes(code);
		CREATE INDEX IF NOT EXISTS idx_handshakes_expires ON handshakes(expires_at);
	`)
	return err
}

// Create inserts a new share record.
func (s *Store) Create(ctx context.Context, share *Share) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO shares (id, filename, encrypted_path, key_hex, created_at, expires_at,
		                    max_downloads, downloads, password_hash, admin_token, size)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		share.ID,
		share.Filename,
		share.EncryptedPath,
		share.KeyHex,
		share.CreatedAt.Unix(),
		share.ExpiresAt.Unix(),
		share.MaxDownloads,
		share.Downloads,
		share.PasswordHash,
		share.AdminToken,
		share.Size,
	)
	if err != nil {
		return fmt.Errorf("insert share: %w", err)
	}
	return nil
}

// Get retrieves a share by ID, validating expiry and download limits.
func (s *Store) Get(ctx context.Context, id string) (*Share, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, filename, encrypted_path, key_hex, created_at, expires_at,
		       max_downloads, downloads, password_hash, admin_token, size
		FROM shares WHERE id = ?`, id)
	share, err := scanShare(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get share: %w", err)
	}
	return share, nil
}

// IncrementDownloads atomically increments the download counter.
func (s *Store) IncrementDownloads(ctx context.Context, id string) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE shares SET downloads = downloads + 1 WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("increment downloads: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// List returns all non-expired shares.
func (s *Store) List(ctx context.Context) ([]*Share, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, filename, encrypted_path, key_hex, created_at, expires_at,
		       max_downloads, downloads, password_hash, admin_token, size
		FROM shares
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list shares: %w", err)
	}
	defer rows.Close()

	var shares []*Share
	for rows.Next() {
		share, err := scanShareRow(rows)
		if err != nil {
			return nil, err
		}
		shares = append(shares, share)
	}
	return shares, rows.Err()
}

// Revoke deletes a share and its encrypted file.
func (s *Store) Revoke(ctx context.Context, id string) error {
	share, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	// Remove encrypted file
	_ = os.Remove(share.EncryptedPath)

	_, err = s.db.ExecContext(ctx, `DELETE FROM shares WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete share: %w", err)
	}
	return nil
}

// Purge removes all expired shares and their files.
func (s *Store) Purge(ctx context.Context) (int, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, encrypted_path FROM shares WHERE expires_at < ?`, time.Now().Unix())
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	type expired struct{ id, path string }
	var toDelete []expired
	for rows.Next() {
		var e expired
		if err := rows.Scan(&e.id, &e.path); err != nil {
			return 0, err
		}
		toDelete = append(toDelete, e)
	}
	rows.Close()

	count := 0
	for _, e := range toDelete {
		_ = os.Remove(e.path)
		s.db.ExecContext(ctx, `DELETE FROM shares WHERE id = ?`, e.id)
		count++
	}
	return count, nil
}

// ActiveCount returns the number of active (non-expired) shares.
func (s *Store) ActiveCount(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM shares WHERE expires_at > ?`, time.Now().Unix()).Scan(&count)
	return count, err
}

// DataDir returns the data directory path.
func (s *Store) DataDir() string {
	return s.dataDir
}

// Close closes the database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanShare(row *sql.Row) (*Share, error) {
	var s Share
	var createdAt, expiresAt int64
	err := row.Scan(
		&s.ID, &s.Filename, &s.EncryptedPath, &s.KeyHex,
		&createdAt, &expiresAt,
		&s.MaxDownloads, &s.Downloads,
		&s.PasswordHash, &s.AdminToken, &s.Size,
	)
	if err != nil {
		return nil, err
	}
	s.CreatedAt = time.Unix(createdAt, 0)
	s.ExpiresAt = time.Unix(expiresAt, 0)
	return &s, nil
}

func scanShareRow(rows *sql.Rows) (*Share, error) {
	var s Share
	var createdAt, expiresAt int64
	err := rows.Scan(
		&s.ID, &s.Filename, &s.EncryptedPath, &s.KeyHex,
		&createdAt, &expiresAt,
		&s.MaxDownloads, &s.Downloads,
		&s.PasswordHash, &s.AdminToken, &s.Size,
	)
	if err != nil {
		return nil, err
	}
	s.CreatedAt = time.Unix(createdAt, 0)
	s.ExpiresAt = time.Unix(expiresAt, 0)
	return &s, nil
}
