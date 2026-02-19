package cmd

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"

	ddcrypto "github.com/durins-door/cli/internal/crypto"
	"github.com/durins-door/cli/internal/handshake"
	"github.com/durins-door/cli/internal/progress"
	"github.com/durins-door/cli/internal/supabase"
)

var (
	sendTo           string
	sendPassword     string
	sendExpires      string
	sendMaxDownloads int
	sendBaseURL      string
)

var sendCmd = &cobra.Command{
	Use:   "send <file> --to <CODE>",
	Short: "Send a file to a waiting receiver (handshake mode)",
	Long: `Connects to a receiver's handshake session via pairing code.

Both parties generate ECDH P-256 keypairs. After exchanging public keys via
Supabase, a shared AES-256 secret is derived. A Tolkien verification phrase
(SHA-256 of the shared secret → 3 wordlist words) lets both parties verbally
confirm no MITM tampered with the exchange.

The file is encrypted with the ECDH-derived key — the server never sees the
plaintext or the key.`,
	Args: cobra.ExactArgs(1),
	RunE: runSend,
}

func init() {
	sendCmd.Flags().StringVar(&sendTo, "to", "", "Pairing code from the receiver (required)")
	_ = sendCmd.MarkFlagRequired("to")
	sendCmd.Flags().StringVar(&sendPassword, "password", "", "Add a password layer on top of the ECDH key")
	sendCmd.Flags().StringVar(&sendExpires, "expires", "", `Share expiry, e.g. "24h" or "7d"`)
	sendCmd.Flags().IntVar(&sendMaxDownloads, "max-downloads", 0, "Max download count (0 = unlimited)")
	sendCmd.Flags().StringVar(&sendBaseURL, "url", DefaultShareURL, "Base URL (for share record only)")
}

func runSend(_ *cobra.Command, args []string) error {
	filePath := args[0]
	code := strings.ToUpper(strings.TrimSpace(sendTo))

	// ── 1. Fetch receiver's public key ────────────────────────────────────────
	fmt.Fprintf(os.Stderr, "🔑 Fetching receiver's public key for code: \033[1;33m%s\033[0m\n", code)

	client, err := newClient(false)
	if err != nil {
		return err
	}

	hs, err := client.GetHandshakeByCode(code)
	if err != nil {
		return fmt.Errorf("looking up handshake: %w", err)
	}

	// ── 2. Generate sender's ECDH keypair ─────────────────────────────────────
	kp, err := handshake.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("generating keypair: %w", err)
	}

	// ── 3. Publish sender's public key ────────────────────────────────────────
	if err := client.SetSenderPublicKey(hs.ID, kp.PublicKeyB64()); err != nil {
		return fmt.Errorf("publishing public key: %w", err)
	}

	// ── 4. Derive shared ECDH secret ─────────────────────────────────────────
	sharedSecret, err := kp.DeriveSharedSecret(hs.ReceiverPublicKey)
	if err != nil {
		return fmt.Errorf("deriving shared secret: %w", err)
	}

	// ── 5. Show verification phrase ───────────────────────────────────────────
	phrase := handshake.VerificationPhrase(sharedSecret)
	fmt.Fprintln(os.Stderr, "✨ Connected! Computing shared secret…")
	fmt.Fprintf(os.Stderr, "🔐 Verification phrase: \033[1;36m%s\033[0m\n", phrase)
	fmt.Fprintln(os.Stderr, "   Ask the receiver to confirm their phrase matches.")

	if !promptConfirm("   Does the receiver's phrase match? [y/N]: ") {
		return fmt.Errorf("verification aborted — possible MITM attack, session cancelled")
	}

	// ── 6. Read file ──────────────────────────────────────────────────────────
	plaintext, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}
	filename := filepath.Base(filePath)
	mimeType := detectMIME(filePath, plaintext)

	// ── 7. Encrypt with ECDH-derived key ──────────────────────────────────────
	fmt.Fprintf(os.Stderr, "📤 Encrypting and uploading: %s (%s)\n",
		filename, formatSize(int64(len(plaintext))))

	blob, err := ddcrypto.EncryptWithKey(plaintext, sharedSecret)
	if err != nil {
		return fmt.Errorf("encrypting: %w", err)
	}

	// ── 8. Optional password hash ─────────────────────────────────────────────
	var passwordHash *string
	if sendPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(sendPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hashing password: %w", err)
		}
		s := string(hash)
		passwordHash = &s
	}

	// ── 9. Parse expiry ───────────────────────────────────────────────────────
	var expiresAt *string
	if sendExpires != "" {
		t, err := parseDuration(sendExpires)
		if err != nil {
			return fmt.Errorf("parsing --expires: %w", err)
		}
		s := t.UTC().Format("2006-01-02T15:04:05Z07:00")
		expiresAt = &s
	}

	// ── 10. Upload encrypted blob with progress ───────────────────────────────
	storageID, err := randomHex(16)
	if err != nil {
		return fmt.Errorf("generating object id: %w", err)
	}
	storagePath := storageID + ".enc"

	pr := progress.NewReader(bytes.NewReader(blob), int64(len(blob)))
	if err := client.UploadFileReader(storagePath, pr, int64(len(blob)), "application/octet-stream"); err != nil {
		return fmt.Errorf("uploading: %w", err)
	}
	pr.Finish()

	// ── 11. Create share metadata row ─────────────────────────────────────────
	input := supabase.CreateShareInput{
		StoragePath:  storagePath,
		Filename:     filename,
		FileSize:     int64(len(plaintext)),
		MimeType:     mimeType,
		PasswordHash: passwordHash,
		ExpiresAt:    expiresAt,
	}
	if sendMaxDownloads > 0 {
		input.MaxDownloads = &sendMaxDownloads
	}

	share, err := client.CreateShare(input)
	if err != nil {
		_ = client.DeleteFile(storagePath)
		return fmt.Errorf("creating share record: %w", err)
	}

	// ── 12. Link share to handshake ───────────────────────────────────────────
	if err := client.SetHandshakeShareID(hs.ID, share.ID); err != nil {
		return fmt.Errorf("notifying receiver: %w", err)
	}

	fmt.Fprintln(os.Stderr, "✅ File sent! The receiver will download and decrypt it automatically.")

	return nil
}
