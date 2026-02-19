package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List your shares (requires login)",
	Long:  `Lists all shares associated with your account, newest first.`,
	Args:  cobra.NoArgs,
	RunE:  runList,
}

func runList(cmd *cobra.Command, args []string) error {
	client, err := newClient(true)
	if err != nil {
		return err
	}

	shares, err := client.ListShares()
	if err != nil {
		return fmt.Errorf("listing shares: %w", err)
	}

	if len(shares) == 0 {
		fmt.Fprintln(os.Stderr, "No shares found.")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tFILE\tSIZE\tDOWNLOADS\tEXPIRES\tCREATED")
	fmt.Fprintln(w, "──────────────────────────────────────────\t────────────────────\t──────\t─────────\t───────────────────\t───────────────────")

	for _, s := range shares {
		expires := "never"
		if s.ExpiresAt != nil {
			if s.ExpiresAt.Before(time.Now()) {
				expires = "expired"
			} else {
				expires = s.ExpiresAt.Format("2006-01-02 15:04")
			}
		}

		downloads := fmt.Sprintf("%d", s.Downloads)
		if s.MaxDownloads != nil {
			downloads = fmt.Sprintf("%d/%d", s.Downloads, *s.MaxDownloads)
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			s.ID,
			truncate(s.Filename, 20),
			formatSize(s.FileSize),
			downloads,
			expires,
			s.CreatedAt.Format("2006-01-02 15:04"),
		)
	}

	return w.Flush()
}

func formatSize(b int64) string {
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

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}
