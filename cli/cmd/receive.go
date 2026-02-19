package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	ddcrypto "github.com/durins-door/cli/internal/crypto"
	"github.com/durins-door/cli/internal/handshake"
	"github.com/durins-door/cli/internal/progress"
	"github.com/durins-door/cli/internal/wordlist"
)

const handshakeTimeout = 10 * time.Minute

var receiveOutput string

var receiveCmd = &cobra.Command{
	Use:   "receive",
	Short: "Wait for a peer to send you a file (handshake mode)",
	Long: `Creates a peer-to-peer handshake session.

A pairing code is displayed — share it with the sender out-of-band. Once they
connect, both parties compute the same Tolkien verification phrase from the
ECDH shared secret. Speaking it aloud confirms no MITM tampered with the
key exchange.

The sender encrypts the file with the ECDH-derived AES-256 key. The server
never sees the key or the plaintext.`,
	Args: cobra.NoArgs,
	RunE: runReceive,
}

func init() {
	receiveCmd.Flags().StringVarP(&receiveOutput, "output", "o", ".", "Directory to save the received file")
}

func runReceive(_ *cobra.Command, _ []string) error {
	// ── 1. Generate ECDH P-256 keypair ───────────────────────────────────────
	kp, err := handshake.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("generating keypair: %w", err)
	}

	// ── 2. Reserve a pairing code & create handshake row ─────────────────────
	client, err := newClient(false)
	if err != nil {
		return err
	}

	var hsID, code string
	for attempt := 0; attempt < 10; attempt++ {
		code, err = wordlist.GenerateCode()
		if err != nil {
			return fmt.Errorf("generating code: %w", err)
		}

		hs, createErr := client.CreateHandshake(code, kp.PublicKeyB64())
		if createErr == nil {
			hsID = hs.ID
			break
		}
		// On a uniqueness conflict (409) just try a different word.
		if strings.Contains(createErr.Error(), "409") || strings.Contains(createErr.Error(), "unique") {
			continue
		}
		return fmt.Errorf("creating handshake: %w", createErr)
	}
	if hsID == "" {
		return fmt.Errorf("could not reserve a unique pairing code — try again")
	}

	// ── 3. Show pairing code ──────────────────────────────────────────────────
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "🚪 Waiting for a file...")
	fmt.Fprintf(os.Stderr, "📜 Share this code with the sender: \033[1;33m%s\033[0m\n", code)
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "⏳ Waiting for sender to connect...")

	// ── 4. Poll until sender posts their public key ───────────────────────────
	updated, err := client.PollForSender(hsID, handshakeTimeout)
	if err != nil {
		return fmt.Errorf("waiting for sender: %w", err)
	}
	fmt.Fprintln(os.Stderr, "✨ Sender connected!")

	// ── 5. Derive shared ECDH secret ─────────────────────────────────────────
	sharedSecret, err := kp.DeriveSharedSecret(*updated.SenderPublicKey)
	if err != nil {
		return fmt.Errorf("deriving shared secret: %w", err)
	}

	// ── 6. Show verification phrase ───────────────────────────────────────────
	phrase := handshake.VerificationPhrase(sharedSecret)
	fmt.Fprintf(os.Stderr, "🔐 Verification phrase: \033[1;36m%s\033[0m\n", phrase)
	fmt.Fprintln(os.Stderr, "   Ask the sender to read their phrase aloud.")

	if !promptConfirm("   Does the sender's phrase match? [y/N]: ") {
		return fmt.Errorf("verification aborted — possible MITM attack, session cancelled")
	}

	// ── 7. Poll until sender links a share ────────────────────────────────────
	fmt.Fprintln(os.Stderr, "⏳ Waiting for sender to upload the file...")
	withShare, err := client.PollForShare(updated.ID, handshakeTimeout)
	if err != nil {
		return fmt.Errorf("waiting for file: %w", err)
	}

	// ── 8. Fetch share metadata ───────────────────────────────────────────────
	share, err := client.GetShare(*withShare.ShareID)
	if err != nil {
		return fmt.Errorf("fetching share: %w", err)
	}
	fmt.Fprintf(os.Stderr, "📥 Receiving: %s (%s)\n", share.Filename, formatSize(share.FileSize))

	// ── 9. Download encrypted blob ────────────────────────────────────────────
	blob, err := client.DownloadFile(share.StoragePath)
	if err != nil {
		return fmt.Errorf("downloading: %w", err)
	}
	progress.PrintDone()

	// ── 10. Decrypt with ECDH-derived key ─────────────────────────────────────
	plaintext, err := ddcrypto.DecryptRaw(blob, sharedSecret)
	if err != nil {
		return fmt.Errorf("decryption failed — shared secret mismatch: %w", err)
	}

	// ── 11. Write output ──────────────────────────────────────────────────────
	outDir := receiveOutput
	if outDir == "" || outDir == "." {
		outDir = "."
	}
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return fmt.Errorf("creating output dir: %w", err)
	}

	baseName := sanitiseFilename(share.Filename)
	if baseName == "" {
		baseName = share.ID
	}
	outPath := uniquePath(outDir + "/" + baseName)

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		return fmt.Errorf("writing file: %w", err)
	}
	fmt.Fprintf(os.Stderr, "✅ File saved: %s\n", outPath)

	// Best-effort download counter bump.
	_ = client.IncrementDownloads(*withShare.ShareID)

	return nil
}

// promptConfirm reads a y/Y response from stdin; anything else is treated as No.
func promptConfirm(prompt string) bool {
	fmt.Fprint(os.Stderr, prompt)
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		ans := strings.TrimSpace(scanner.Text())
		return strings.EqualFold(ans, "y") || strings.EqualFold(ans, "yes")
	}
	return false
}
