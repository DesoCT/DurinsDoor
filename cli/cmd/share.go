package cmd

import (
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"

	ddcrypto "github.com/durins-door/cli/internal/crypto"
	"github.com/durins-door/cli/internal/supabase"

	"crypto/rand"
	"encoding/hex"
)

var (
	sharePassword     string
	shareExpires      string
	shareMaxDownloads int
	shareBaseURL      string
)

var shareCmd = &cobra.Command{
	Use:   "share <file>",
	Short: "Encrypt and upload a file, returning a share link",
	Long: `Encrypts a file locally with AES-256-GCM and uploads the ciphertext to
Supabase Storage. The encryption key is embedded in the share URL fragment
so the server never sees it (zero-knowledge).`,
	Args: cobra.ExactArgs(1),
	RunE: runShare,
}

func init() {
	shareCmd.Flags().StringVar(&sharePassword, "password", "", "Password-protect the share")
	shareCmd.Flags().StringVar(&shareExpires, "expires", "", `Expiry duration, e.g. "24h" or "7d"`)
	shareCmd.Flags().IntVar(&shareMaxDownloads, "max-downloads", 0, "Maximum number of downloads (0 = unlimited)")
	shareCmd.Flags().StringVar(&shareBaseURL, "url", DefaultShareURL, "Base URL for the share link")
}

func runShare(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	// ── 1. Read file ──────────────────────────────────────────────────────────
	fmt.Fprintf(os.Stderr, "Reading %s …\n", filePath)
	plaintext, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}

	filename := filepath.Base(filePath)
	mimeType := detectMIME(filePath, plaintext)

	// ── 2. Encrypt ────────────────────────────────────────────────────────────
	fmt.Fprintln(os.Stderr, "Encrypting …")
	result, err := ddcrypto.Encrypt(plaintext)
	if err != nil {
		return fmt.Errorf("encrypting: %w", err)
	}

	// ── 3. Optional password hash ─────────────────────────────────────────────
	var passwordHash *string
	if sharePassword != "" {
		fmt.Fprintln(os.Stderr, "Hashing password …")
		hash, err := bcrypt.GenerateFromPassword([]byte(sharePassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}
		s := string(hash)
		passwordHash = &s
	}

	// ── 4. Parse expiry ───────────────────────────────────────────────────────
	var expiresAt *string
	if shareExpires != "" {
		t, err := parseDuration(shareExpires)
		if err != nil {
			return fmt.Errorf("parsing --expires: %w", err)
		}
		s := t.UTC().Format(time.RFC3339)
		expiresAt = &s
	}

	// ── 5. Build storage path ─────────────────────────────────────────────────
	uid, err := randomHex(16)
	if err != nil {
		return fmt.Errorf("generating object id: %w", err)
	}
	storagePath := uid + ".enc"

	// ── 6. Upload to Supabase Storage ─────────────────────────────────────────
	client, err := newClient(false)
	if err != nil {
		return err
	}

	fmt.Fprintf(os.Stderr, "Uploading %d bytes …\n", len(result.Blob))
	if err := client.UploadFile(storagePath, result.Blob, "application/octet-stream"); err != nil {
		return fmt.Errorf("uploading: %w", err)
	}

	// ── 7. Create share metadata row ──────────────────────────────────────────
	input := supabase.CreateShareInput{
		StoragePath:  storagePath,
		Filename:     filename,
		FileSize:     int64(len(plaintext)),
		MimeType:     mimeType,
		PasswordHash: passwordHash,
		ExpiresAt:    expiresAt,
	}
	if shareMaxDownloads > 0 {
		input.MaxDownloads = &shareMaxDownloads
	}

	fmt.Fprintln(os.Stderr, "Creating share record …")
	share, err := client.CreateShare(input)
	if err != nil {
		// Best-effort cleanup: remove the uploaded blob.
		_ = client.DeleteFile(storagePath)
		return fmt.Errorf("creating share: %w", err)
	}

	// ── 8. Emit share URL ─────────────────────────────────────────────────────
	shareLink := buildShareURL(shareBaseURL, share.ID, result.KeyB64)
	fmt.Println(shareLink)

	// Print summary to stderr so stdout is clean (pipe-friendly).
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "✓ Share created!")
	fmt.Fprintf(os.Stderr, "  ID:   %s\n", share.ID)
	fmt.Fprintf(os.Stderr, "  File: %s (%d bytes)\n", filename, len(plaintext))
	if shareMaxDownloads > 0 {
		fmt.Fprintf(os.Stderr, "  Max downloads: %d\n", shareMaxDownloads)
	}
	if expiresAt != nil {
		fmt.Fprintf(os.Stderr, "  Expires: %s\n", *expiresAt)
	}
	if sharePassword != "" {
		fmt.Fprintln(os.Stderr, "  Password-protected: yes")
	}

	return nil
}

// buildShareURL constructs the share link with the key in the URL fragment.
// Format: <base>/share/<id>#<keyB64>
func buildShareURL(base, id, keyB64 string) string {
	base = strings.TrimRight(base, "/")
	return fmt.Sprintf("%s/share/%s#%s", base, id, keyB64)
}

// detectMIME attempts to determine the MIME type from file extension or content sniff.
func detectMIME(path string, data []byte) string {
	ext := strings.ToLower(filepath.Ext(path))
	if t := mime.TypeByExtension(ext); t != "" {
		return t
	}
	// Content sniff (first 512 bytes).
	sniff := data
	if len(sniff) > 512 {
		sniff = sniff[:512]
	}
	return http.DetectContentType(sniff)
}

// parseDuration parses "24h", "7d", "30m", etc.
func parseDuration(s string) (time.Time, error) {
	// Handle days manually since time.ParseDuration doesn't support "d".
	s = strings.TrimSpace(s)
	if strings.HasSuffix(s, "d") {
		days := strings.TrimSuffix(s, "d")
		var n int
		if _, err := fmt.Sscanf(days, "%d", &n); err != nil {
			return time.Time{}, fmt.Errorf("invalid days format: %q", s)
		}
		return time.Now().Add(time.Duration(n) * 24 * time.Hour), nil
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return time.Time{}, err
	}
	return time.Now().Add(d), nil
}

// randomHex returns n random hex-encoded bytes (2n hex chars).
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
