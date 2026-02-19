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

	ddcrypto "github.com/durins-door/cli/internal/crypto"
)

var downloadOutput string

var downloadCmd = &cobra.Command{
	Use:   "download <url>",
	Short: "Download and decrypt a shared file",
	Long: `Downloads the encrypted blob and decrypts it using the key embedded in
the URL fragment. If the share is password-protected, you will be prompted.`,
	Args: cobra.ExactArgs(1),
	RunE: runDownload,
}

func init() {
	downloadCmd.Flags().StringVarP(&downloadOutput, "output", "o", "", "Output file path (default: original filename)")
}

func runDownload(cmd *cobra.Command, args []string) error {
	rawURL := args[0]

	// ── 1. Parse URL ──────────────────────────────────────────────────────────
	shareID, keyB64, err := parseShareURL(rawURL)
	if err != nil {
		return err
	}

	if keyB64 == "" {
		return fmt.Errorf("no encryption key found in URL fragment\n" +
			"The key must be in the URL fragment: https://…/share/<id>#<key>")
	}

	// ── 2. Fetch share metadata ───────────────────────────────────────────────
	client, err := newClient(false)
	if err != nil {
		return err
	}

	fmt.Fprintln(os.Stderr, "Fetching share metadata …")
	share, err := client.GetShare(shareID)
	if err != nil {
		return fmt.Errorf("fetching share: %w", err)
	}

	// ── 3. Password check ─────────────────────────────────────────────────────
	if share.PasswordHash != nil && *share.PasswordHash != "" {
		password, err := promptPassword("Password: ")
		if err != nil {
			return fmt.Errorf("reading password: %w", err)
		}
		if err := bcrypt.CompareHashAndPassword([]byte(*share.PasswordHash), []byte(password)); err != nil {
			return fmt.Errorf("incorrect password")
		}
		fmt.Fprintln(os.Stderr, "Password accepted.")
	}

	// ── 4. Check download limits ──────────────────────────────────────────────
	if share.MaxDownloads != nil && share.Downloads >= *share.MaxDownloads {
		return fmt.Errorf("this share has reached its download limit (%d/%d)",
			share.Downloads, *share.MaxDownloads)
	}

	// ── 5. Download encrypted blob ────────────────────────────────────────────
	fmt.Fprintln(os.Stderr, "Downloading …")
	blob, err := client.DownloadFile(share.StoragePath)
	if err != nil {
		return fmt.Errorf("downloading: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Downloaded %d bytes.\n", len(blob))

	// ── 6. Decrypt ────────────────────────────────────────────────────────────
	fmt.Fprintln(os.Stderr, "Decrypting …")
	plaintext, err := ddcrypto.Decrypt(blob, keyB64)
	if err != nil {
		return fmt.Errorf("decryption failed: %w", err)
	}
	fmt.Fprintf(os.Stderr, "Decrypted %d bytes.\n", len(plaintext))

	// ── 7. Write output ───────────────────────────────────────────────────────
	outPath := downloadOutput
	if outPath == "" {
		outPath = sanitiseFilename(share.Filename)
		if outPath == "" {
			outPath = shareID
		}
	}

	// Avoid overwriting existing files unless -o was explicit.
	if downloadOutput == "" {
		outPath = uniquePath(outPath)
	}

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		return fmt.Errorf("writing file: %w", err)
	}

	fmt.Fprintf(os.Stderr, "\n✓ Saved to %s\n", outPath)

	// ── 8. Increment download counter (best-effort) ───────────────────────────
	_ = client.IncrementDownloads(shareID)

	return nil
}

// parseShareURL extracts the share ID and key from a Durin's Door URL.
// Supported formats:
//   - https://durins-door.vercel.app/share/<id>#<key>
//   - /share/<id>#<key>    (partial)
func parseShareURL(raw string) (id, keyB64 string, err error) {
	// Handle bare IDs (no scheme).
	if !strings.Contains(raw, "://") && !strings.HasPrefix(raw, "/") {
		// Treat as plain share ID with no key — return as-is so caller can error.
		return raw, "", nil
	}

	u, err := url.Parse(raw)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}

	// Fragment is the key.
	keyB64 = u.Fragment

	// Path is /<something>/share/<id>
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	for i, p := range parts {
		if p == "share" && i+1 < len(parts) {
			return parts[i+1], keyB64, nil
		}
	}

	// Fallback: last path segment is the ID.
	if len(parts) > 0 {
		return parts[len(parts)-1], keyB64, nil
	}

	return "", "", fmt.Errorf("cannot extract share ID from URL: %s", raw)
}

// promptPassword reads a password from the terminal without echoing.
func promptPassword(prompt string) (string, error) {
	fmt.Fprint(os.Stderr, prompt)
	pw, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr) // newline after hidden input
	if err != nil {
		return "", err
	}
	return string(pw), nil
}

// sanitiseFilename removes path separators from a filename.
func sanitiseFilename(name string) string {
	name = filepath.Base(name)
	return strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == 0 {
			return '_'
		}
		return r
	}, name)
}

// uniquePath returns a path that doesn't exist by appending "(n)" if needed.
func uniquePath(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path // doesn't exist, use as-is
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
