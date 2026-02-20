package cmd

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/unisoniq/durins-door/internal/apiclient"
	"github.com/unisoniq/durins-door/internal/handshake"
	"github.com/unisoniq/durins-door/internal/webcrypto"
)

var (
	sendTo           string
	sendPassword     string
	sendExpires      string
	sendMaxDownloads int
)

var sendCmd = &cobra.Command{
	Use:   "send <file> --to <CODE>",
	Short: "Send a file to a waiting receiver (handshake mode)",
	Long: `Connects to a receiver's handshake session via pairing code.
Both parties compute an ECDH shared secret. A Tolkien verification phrase
lets both parties confirm no MITM tampered with the exchange.`,
	Args: cobra.ExactArgs(1),
	RunE: runSend,
}

func init() {
	sendCmd.Flags().StringVar(&sendTo, "to", "", "Pairing code from the receiver (required)")
	_ = sendCmd.MarkFlagRequired("to")
	sendCmd.Flags().StringVar(&sendPassword, "password", "", "Add a password layer on top of the ECDH key")
	sendCmd.Flags().StringVar(&sendExpires, "expires", "", `Share expiry, e.g. "24h" or "7d"`)
	sendCmd.Flags().IntVar(&sendMaxDownloads, "max-downloads", 0, "Max download count (0 = unlimited)")
	rootCmd.AddCommand(sendCmd)
}

func runSend(_ *cobra.Command, args []string) error {
	filePath := args[0]
	code := strings.ToUpper(strings.TrimSpace(sendTo))

	client := newAPIClient()

	// 1. Fetch receiver's public key
	fmt.Fprintf(os.Stderr, "Fetching receiver's public key for code: %s\n", code)
	hs, err := client.GetHandshakeByCode(code)
	if err != nil {
		return fmt.Errorf("looking up handshake: %w", err)
	}

	// 2. Generate sender's ECDH keypair
	kp, err := handshake.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("generating keypair: %w", err)
	}

	// 3. Publish sender's public key
	if err := client.SetSenderPublicKey(hs.ID, kp.PublicKeyB64()); err != nil {
		return fmt.Errorf("publishing public key: %w", err)
	}

	// 4. Derive shared ECDH secret
	sharedSecret, err := kp.DeriveSharedSecret(hs.ReceiverPublicKey)
	if err != nil {
		return fmt.Errorf("deriving shared secret: %w", err)
	}

	// 5. Show verification phrase
	phrase := handshake.VerificationPhrase(sharedSecret)
	fmt.Fprintln(os.Stderr, "Connected! Computing shared secret...")
	fmt.Fprintf(os.Stderr, "Verification phrase: %s\n", phrase)
	fmt.Fprintln(os.Stderr, "   Ask the receiver to confirm their phrase matches.")

	if !promptConfirm("   Does the receiver's phrase match? [y/N]: ") {
		return fmt.Errorf("verification aborted — possible MITM attack, session cancelled")
	}

	// 6. Read file
	plaintext, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("reading file: %w", err)
	}
	filename := filepath.Base(filePath)

	// 7. Encrypt with ECDH-derived key
	fmt.Fprintf(os.Stderr, "Encrypting and uploading: %s (%s)\n",
		filename, formatSizeCmd(int64(len(plaintext))))
	blob, err := webcrypto.EncryptWithKey(plaintext, sharedSecret)
	if err != nil {
		return fmt.Errorf("encrypting: %w", err)
	}

	// 8. Parse expiry
	var expiresAt string
	if sendExpires != "" {
		t, err := parseExpiry(sendExpires)
		if err != nil {
			return fmt.Errorf("parsing --expires: %w", err)
		}
		expiresAt = t.UTC().Format(time.RFC3339)
	}

	// 9. Upload via API
	share, err := client.Upload(apiclient.UploadInput{
		Filename:     filename,
		FileData:     bytes.NewReader(blob),
		FileSize:     int64(len(blob)),
		Password:     sendPassword,
		ExpiresAt:    expiresAt,
		MaxDownloads: sendMaxDownloads,
	})
	if err != nil {
		return fmt.Errorf("uploading: %w", err)
	}

	// 10. Link share to handshake
	if err := client.SetHandshakeShareID(hs.ID, share.ID); err != nil {
		return fmt.Errorf("notifying receiver: %w", err)
	}

	fmt.Fprintln(os.Stderr, "File sent! The receiver will download and decrypt it automatically.")
	return nil
}
