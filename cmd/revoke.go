package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/share"
)

var revokeCmd = &cobra.Command{
	Use:   "revoke <share-id>",
	Short: "Revoke a share and delete its encrypted file",
	Args:  cobra.ExactArgs(1),
	RunE:  runRevoke,
}

func init() {
	rootCmd.AddCommand(revokeCmd)
}

func runRevoke(cmd *cobra.Command, args []string) error {
	id := args[0]

	st, err := share.NewStore(dataDir())
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer st.Close()

	// Try full ID or prefix match
	shares, err := st.List(cmd.Context())
	if err != nil {
		return err
	}
	resolvedID := id
	if len(id) < 32 {
		// prefix search
		var matches []string
		for _, sh := range shares {
			if len(sh.ID) >= len(id) && sh.ID[:len(id)] == id {
				matches = append(matches, sh.ID)
			}
		}
		switch len(matches) {
		case 0:
			return fmt.Errorf("no share found with ID prefix %q", id)
		case 1:
			resolvedID = matches[0]
		default:
			return fmt.Errorf("ambiguous ID prefix %q — matches: %v", id, matches)
		}
	}

	sh, err := st.Get(cmd.Context(), resolvedID)
	if err != nil {
		if err == share.ErrNotFound {
			return fmt.Errorf("share %q not found", resolvedID)
		}
		return err
	}

	fmt.Printf("Revoking share: %s (%s)...\n", sh.Filename, sh.ID[:16])
	if err := st.Revoke(cmd.Context(), resolvedID); err != nil {
		return fmt.Errorf("revoke: %w", err)
	}
	fmt.Println("✅ Share revoked and file deleted.")
	return nil
}
