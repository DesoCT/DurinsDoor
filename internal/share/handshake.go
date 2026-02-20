package share

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// Handshake represents a peer-to-peer key exchange session.
type Handshake struct {
	ID                string
	Code              string
	ReceiverPublicKey string
	SenderPublicKey   string // empty until sender connects
	ShareID           string // empty until sender uploads
	CreatedAt         time.Time
	ExpiresAt         time.Time
}

// HasSender returns true once the sender has connected.
func (h *Handshake) HasSender() bool {
	return h.SenderPublicKey != ""
}

// HasShare returns true once the sender has uploaded and linked a share.
func (h *Handshake) HasShare() bool {
	return h.ShareID != ""
}

// CreateHandshake inserts a new handshake row.
func (s *Store) CreateHandshake(ctx context.Context, h *Handshake) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO handshakes (id, code, receiver_public_key, sender_public_key, share_id, created_at, expires_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		h.ID, h.Code, h.ReceiverPublicKey, h.SenderPublicKey, h.ShareID,
		h.CreatedAt.Unix(), h.ExpiresAt.Unix(),
	)
	if err != nil {
		return fmt.Errorf("insert handshake: %w", err)
	}
	return nil
}

// GetHandshake retrieves a handshake by ID.
func (s *Store) GetHandshake(ctx context.Context, id string) (*Handshake, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, code, receiver_public_key, sender_public_key, share_id,
		       created_at, expires_at
		FROM handshakes WHERE id = ?`, id)
	return scanHandshake(row)
}

// GetHandshakeByCode retrieves a handshake by its pairing code.
func (s *Store) GetHandshakeByCode(ctx context.Context, code string) (*Handshake, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, code, receiver_public_key, sender_public_key, share_id,
		       created_at, expires_at
		FROM handshakes WHERE code = ?`, code)
	return scanHandshake(row)
}

// SetSenderPublicKey updates the sender's public key on a handshake.
func (s *Store) SetSenderPublicKey(ctx context.Context, id, senderPubKey string) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE handshakes SET sender_public_key = ? WHERE id = ?`, senderPubKey, id)
	if err != nil {
		return fmt.Errorf("set sender public key: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// SetHandshakeShareID links a share to a handshake.
func (s *Store) SetHandshakeShareID(ctx context.Context, id, shareID string) error {
	result, err := s.db.ExecContext(ctx,
		`UPDATE handshakes SET share_id = ? WHERE id = ?`, shareID, id)
	if err != nil {
		return fmt.Errorf("set handshake share_id: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// PurgeHandshakes removes expired handshakes.
func (s *Store) PurgeHandshakes(ctx context.Context) (int, error) {
	result, err := s.db.ExecContext(ctx,
		`DELETE FROM handshakes WHERE expires_at < ?`, time.Now().Unix())
	if err != nil {
		return 0, err
	}
	n, _ := result.RowsAffected()
	return int(n), nil
}

func scanHandshake(row *sql.Row) (*Handshake, error) {
	var h Handshake
	var createdAt, expiresAt int64
	err := row.Scan(
		&h.ID, &h.Code, &h.ReceiverPublicKey, &h.SenderPublicKey, &h.ShareID,
		&createdAt, &expiresAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan handshake: %w", err)
	}
	h.CreatedAt = time.Unix(createdAt, 0)
	h.ExpiresAt = time.Unix(expiresAt, 0)
	return &h, nil
}
