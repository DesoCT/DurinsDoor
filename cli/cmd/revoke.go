package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var revokeForce bool

var revokeCmd = &cobra.Command{
	Use:   "revoke <id>",
	Short: "Delete a share (requires login, must be owner)",
	Long: `Permanently deletes a share and its encrypted file from storage.
You must be the owner of the share (enforced by Supabase RLS).`,
	Args: cobra.ExactArgs(1),
	RunE: runRevoke,
}

func init() {
	revokeCmd.Flags().BoolVarP(&revokeForce, "force", "f", false, "Skip confirmation prompt")
}

func runRevoke(cmd *cobra.Command, args []string) error {
	shareID := args[0]

	client, err := newClient(true)
	if err != nil {
		return err
	}

	// Fetch metadata so we can show the filename before confirming.
	share, err := client.GetShare(shareID)
	if err != nil {
		return fmt.Errorf("fetching share: %w", err)
	}

	if !revokeForce {
		fmt.Fprintf(os.Stderr, "About to delete share %s (%s). This cannot be undone.\n",
			shareID, share.Filename)
		fmt.Fprint(os.Stderr, "Type the share ID to confirm: ")
		var confirm string
		fmt.Fscan(os.Stdin, &confirm)
		if confirm != shareID {
			fmt.Fprintln(os.Stderr, "Aborted.")
			return nil
		}
	}

	// Delete storage object first (best-effort).
	if err := client.DeleteFile(share.StoragePath); err != nil {
		fmt.Fprintf(os.Stderr, "⚠  Could not delete storage object: %v\n", err)
	}

	// Delete DB row.
	if err := client.DeleteShare(shareID); err != nil {
		return fmt.Errorf("deleting share: %w", err)
	}

	fmt.Fprintf(os.Stderr, "✓ Share %s deleted.\n", shareID)
	return nil
}
