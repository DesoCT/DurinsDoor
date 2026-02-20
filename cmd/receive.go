package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/unisoniq/durins-door/internal/handshake"
	"github.com/unisoniq/durins-door/internal/progress"
	"github.com/unisoniq/durins-door/internal/webcrypto"
	"github.com/unisoniq/durins-door/internal/wordlist"
)

const handshakeTimeout = 10 * time.Minute

var receiveOutputDir string

var receiveCmd = &cobra.Command{
	Use:   "receive",
	Short: "Wait for a peer to send you a file (handshake mode)",
	Long: `Creates a peer-to-peer handshake session. A pairing code is displayed —
share it with the sender out-of-band. Both parties compute a Tolkien
verification phrase from the ECDH shared secret.`,
	Args: cobra.NoArgs,
	RunE: runReceive,
}

func init() {
	receiveCmd.Flags().StringVarP(&receiveOutputDir, "output", "o", ".", "Directory to save the received file")
	rootCmd.AddCommand(receiveCmd)
}

func runReceive(_ *cobra.Command, _ []string) error {
	// 1. Generate ECDH keypair
	kp, err := handshake.GenerateKeyPair()
	if err != nil {
		return fmt.Errorf("generating keypair: %w", err)
	}

	client := newAPIClient()

	// 2. Reserve a pairing code & create handshake
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
		if strings.Contains(createErr.Error(), "409") || strings.Contains(createErr.Error(), "Conflict") {
			continue
		}
		return fmt.Errorf("creating handshake: %w", createErr)
	}
	if hsID == "" {
		return fmt.Errorf("could not reserve a unique pairing code — try again")
	}

	// 3. Show pairing code
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "Waiting for a file...")
	fmt.Fprintf(os.Stderr, "Share this code with the sender: %s\n", code)
	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "Waiting for sender to connect...")

	// 4. Poll until sender posts their public key
	updated, err := client.PollForSender(hsID, handshakeTimeout)
	if err != nil {
		return fmt.Errorf("waiting for sender: %w", err)
	}
	fmt.Fprintln(os.Stderr, "Sender connected!")

	// 5. Derive shared ECDH secret
	sharedSecret, err := kp.DeriveSharedSecret(*updated.SenderPublicKey)
	if err != nil {
		return fmt.Errorf("deriving shared secret: %w", err)
	}

	// 6. Show verification phrase
	phrase := handshake.VerificationPhrase(sharedSecret)
	fmt.Fprintf(os.Stderr, "Verification phrase: %s\n", phrase)
	fmt.Fprintln(os.Stderr, "   Ask the sender to read their phrase aloud.")

	if !promptConfirm("   Does the sender's phrase match? [y/N]: ") {
		return fmt.Errorf("verification aborted — possible MITM attack, session cancelled")
	}

	// 7. Poll until sender links a share
	fmt.Fprintln(os.Stderr, "Waiting for sender to upload the file...")
	withShare, err := client.PollForShare(updated.ID, handshakeTimeout)
	if err != nil {
		return fmt.Errorf("waiting for file: %w", err)
	}

	// 8. Fetch share metadata
	share, err := client.GetShare(*withShare.ShareID)
	if err != nil {
		return fmt.Errorf("fetching share: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Receiving: %s (%s)\n", share.Filename, formatSizeCmd(share.FileSize))

	// 9. Download encrypted blob
	blob, err := client.DownloadFile(*withShare.ShareID)
	if err != nil {
		return fmt.Errorf("downloading: %w", err)
	}
	progress.PrintDone()

	// 10. Decrypt with ECDH-derived key
	plaintext, err := webcrypto.DecryptRaw(blob, sharedSecret)
	if err != nil {
		return fmt.Errorf("decryption failed — shared secret mismatch: %w", err)
	}

	// 11. Write output
	outDir := receiveOutputDir
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
	fmt.Fprintf(os.Stderr, "File saved: %s\n", outPath)

	// Best-effort download counter bump
	_ = client.IncrementDownloads(*withShare.ShareID)

	return nil
}

// promptConfirm reads a y/Y response from stdin.
func promptConfirm(prompt string) bool {
	fmt.Fprint(os.Stderr, prompt)
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		ans := strings.TrimSpace(scanner.Text())
		return strings.EqualFold(ans, "y") || strings.EqualFold(ans, "yes")
	}
	return false
}
