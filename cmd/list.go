package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"
	"time"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/share"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List all active shares",
	RunE:  runList,
}

func init() {
	rootCmd.AddCommand(listCmd)
}

func runList(cmd *cobra.Command, args []string) error {
	st, err := share.NewStore(dataDir())
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer st.Close()

	shares, err := st.List(cmd.Context())
	if err != nil {
		return fmt.Errorf("list shares: %w", err)
	}

	if len(shares) == 0 {
		fmt.Println("No active shares.")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tFILE\tSIZE\tDOWNLOADS\tEXPIRES\tSTATUS")
	fmt.Fprintln(w, "──────────────────\t────────────────\t────────\t──────────\t─────────────────────\t──────")

	for _, sh := range shares {
		status := "✅ active"
		if sh.IsExpired() {
			status = "⏰ expired"
		} else if sh.IsExhausted() {
			status = "🚫 exhausted"
		}
		downloads := fmt.Sprintf("%d", sh.Downloads)
		if sh.MaxDownloads > 0 {
			downloads = fmt.Sprintf("%d / %d", sh.Downloads, sh.MaxDownloads)
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			sh.ID[:16],
			sh.Filename,
			humanSizeCmd(sh.Size),
			downloads,
			sh.ExpiresAt.Format(time.RFC822),
			status,
		)
	}
	w.Flush()
	return nil
}
