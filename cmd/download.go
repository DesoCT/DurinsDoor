package cmd

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"

	"github.com/unisoniq/durins-door/internal/webcrypto"
)

var downloadOutput string

var downloadCmd = &cobra.Command{
	Use:   "download <url>",
	Short: "Download and decrypt a shared file from a remote server",
	Long: `Downloads the encrypted blob from a Durin's Door server and decrypts it
using the key embedded in the URL fragment.`,
	Args: cobra.ExactArgs(1),
	RunE: runDownload,
}

func init() {
	downloadCmd.Flags().StringVarP(&downloadOutput, "output", "o", "", "Output file path (default: original filename)")
	rootCmd.AddCommand(downloadCmd)
}

func runDownload(cmd *cobra.Command, args []string) error {
	rawURL := args[0]

	// Parse URL to extract share ID and key
	shareID, keyB64, err := parseShareURL(rawURL)
	if err != nil {
		return err
	}

	if keyB64 == "" {
		return fmt.Errorf("no encryption key found in URL fragment\n" +
			"The key must be in the URL fragment: https://…/share/<id>#<key>")
	}

	client := newAPIClient()

	fmt.Fprintln(os.Stderr, "Fetching share metadata...")
	share, err := client.GetShare(shareID)
	if err != nil {
		return fmt.Errorf("fetching share: %w", err)
	}

	// Password check (client-side bcrypt verification)
	if share.PasswordHash != nil && *share.PasswordHash != "" {
		password, err := promptPw("Password: ")
		if err != nil {
			return fmt.Errorf("reading password: %w", err)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*share.PasswordHash), []byte(password)); err != nil {
			return fmt.Errorf("incorrect password")
		}
		fmt.Fprintln(os.Stderr, "Password accepted.")
	}

	// Check download limits
	if share.MaxDownloads != nil && share.Downloads >= *share.MaxDownloads {
		return fmt.Errorf("this share has reached its download limit (%d/%d)",
			share.Downloads, *share.MaxDownloads)
	}

	// Download encrypted blob
	fmt.Fprintln(os.Stderr, "Downloading...")
	blob, err := client.DownloadFile(shareID)
	if err != nil {
		return fmt.Errorf("downloading: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Downloaded %d bytes.\n", len(blob))

	// Decrypt
	fmt.Fprintln(os.Stderr, "Decrypting...")
	plaintext, err := webcrypto.Decrypt(blob, keyB64)
	if err != nil {
		return fmt.Errorf("decryption failed: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Decrypted %d bytes.\n", len(plaintext))

	// Write output
	outPath := downloadOutput
	if outPath == "" {
		outPath = sanitiseFilename(share.Filename)
		if outPath == "" {
			outPath = shareID
		}
	}
	if downloadOutput == "" {
		outPath = uniquePath(outPath)
	}

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		return fmt.Errorf("writing file: %w", err)
	}
	fmt.Fprintf(os.Stderr, "\nSaved to %s\n", outPath)

	// Increment download counter (best-effort)
	_ = client.IncrementDownloads(shareID)

	return nil
}

func parseShareURL(raw string) (id, keyB64 string, err error) {
	if !strings.Contains(raw, "://") && !strings.HasPrefix(raw, "/") {
		return raw, "", nil
	}

	u, err := url.Parse(raw)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}

	keyB64 = u.Fragment

	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	for i, p := range parts {
		if p == "share" && i+1 < len(parts) {
			return parts[i+1], keyB64, nil
		}
		if p == "d" && i+1 < len(parts) {
			return parts[i+1], keyB64, nil
		}
	}

	if len(parts) > 0 {
		return parts[len(parts)-1], keyB64, nil
	}

	return "", "", fmt.Errorf("cannot extract share ID from URL: %s", raw)
}

func promptPw(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	pw, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return "", err
	}
	return string(pw), nil
}

func sanitiseFilename(name string) string {
	name = filepath.Base(name)
	return strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == 0 {
			return '_'
		}
		return r
	}, name)
}

func uniquePath(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path
	}
	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for i := 1; i < 1000; i++ {
		candidate := fmt.Sprintf("%s (%d)%s", base, i, ext)
		if _, err := os.Stat(candidate); err != nil {
			return candidate
		}
	}
	return path
}
