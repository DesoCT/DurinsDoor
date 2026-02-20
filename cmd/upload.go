package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/apiclient"
)

var (
	uploadPassword     string
	uploadExpires      string
	uploadMaxDownloads int
)

var uploadCmd = &cobra.Command{
	Use:   "upload <file>",
	Short: "Upload a file to a remote Durin's Door server",
	Long: `Uploads a file to a running Durin's Door server. The server encrypts and
stores the file. Requires --server-url and --token to be set.`,
	Args: cobra.ExactArgs(1),
	RunE: runUpload,
}

func init() {
	uploadCmd.Flags().StringVar(&uploadPassword, "password", "", "Password-protect the share")
	uploadCmd.Flags().StringVar(&uploadExpires, "expires", "", `Expiry duration, e.g. "24h" or "7d"`)
	uploadCmd.Flags().IntVar(&uploadMaxDownloads, "max-downloads", 0, "Maximum number of downloads (0 = unlimited)")
	rootCmd.AddCommand(uploadCmd)
}

func runUpload(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	fi, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("cannot access file: %w", err)
	}
	if fi.IsDir() {
		return fmt.Errorf("%s is a directory — please zip it first", filePath)
	}

	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("opening file: %w", err)
	}
	defer f.Close()

	// Parse expiry
	var expiresAt string
	if uploadExpires != "" {
		t, err := parseExpiry(uploadExpires)
		if err != nil {
			return fmt.Errorf("parsing --expires: %w", err)
		}
		expiresAt = t.UTC().Format(time.RFC3339)
	}

	client := newAPIClient()

	fmt.Fprintf(os.Stderr, "Uploading %s (%s)...\n", filepath.Base(filePath), humanSizeCmd(fi.Size()))

	share, err := client.Upload(apiclient.UploadInput{
		Filename:     filepath.Base(filePath),
		FileData:     f,
		FileSize:     fi.Size(),
		Password:     uploadPassword,
		ExpiresAt:    expiresAt,
		MaxDownloads: uploadMaxDownloads,
	})
	if err != nil {
		return fmt.Errorf("uploading: %w", err)
	}

	fmt.Fprintln(os.Stderr)
	fmt.Fprintln(os.Stderr, "Share created!")
	fmt.Fprintf(os.Stderr, "  ID:   %s\n", share.ID)
	fmt.Fprintf(os.Stderr, "  File: %s (%s)\n", share.Filename, formatSizeCmd(share.FileSize))
	if share.MaxDownloads != nil {
		fmt.Fprintf(os.Stderr, "  Max downloads: %d\n", *share.MaxDownloads)
	}
	if share.ExpiresAt != nil {
		fmt.Fprintf(os.Stderr, "  Expires: %s\n", share.ExpiresAt.Format(time.RFC3339))
	}
	if uploadPassword != "" {
		fmt.Fprintln(os.Stderr, "  Password-protected: yes")
	}

	// Print the download URL
	serverURL := strings.TrimRight(flagServerURL, "/")
	fmt.Printf("%s/d/%s\n", serverURL, share.ID)

	return nil
}

// parseExpiry handles "24h", "7d", etc.
func parseExpiry(s string) (time.Time, error) {
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

func formatSizeCmd(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}
