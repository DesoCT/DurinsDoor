// Package cmd contains all Cobra commands for the Durin's Door CLI.
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/durins-door/cli/internal/auth"
	"github.com/durins-door/cli/internal/supabase"
)

const (
	DefaultSupabaseURL = "https://nenrrpgahxmuckrjcluo.supabase.co"
	DefaultAnonKey     = "sb_publishable_3NM0a1G0ViMAKQ-jGk27hQ_mxStBLXQ"
	DefaultShareURL    = "https://durins-door.vercel.app"
)

var (
	supabaseURL string
	supabaseKey string
)

var rootCmd = &cobra.Command{
	Use:   "durins-door",
	Short: "Share files securely via Durin's Door",
	Long: `Durin's Door CLI — zero-knowledge file sharing.

Files are encrypted locally with AES-256-GCM before upload.
The encryption key never leaves your machine and is embedded
in the share URL fragment (not sent to the server).

Supabase project: ` + DefaultSupabaseURL,
	SilenceUsage: true,
}

// Execute is the entry point called from main().
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&supabaseURL, "supabase-url", DefaultSupabaseURL,
		"Supabase project URL")
	rootCmd.PersistentFlags().StringVar(&supabaseKey, "supabase-key", DefaultAnonKey,
		"Supabase anon/service key")

	rootCmd.AddCommand(shareCmd)
	rootCmd.AddCommand(downloadCmd)
	rootCmd.AddCommand(loginCmd)
	rootCmd.AddCommand(logoutCmd)
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(revokeCmd)
	rootCmd.AddCommand(receiveCmd)
	rootCmd.AddCommand(sendCmd)
}

// newClient returns a Supabase client, optionally populated with the stored JWT.
func newClient(requireAuth bool) (*supabase.Client, error) {
	client := supabase.New(supabaseURL, supabaseKey)

	session, err := auth.Load()
	if err != nil {
		return nil, fmt.Errorf("loading session: %w", err)
	}

	if session != nil {
		if session.IsExpired() {
			fmt.Fprintln(os.Stderr, "⚠  Stored session has expired. Run `durins-door login` to re-authenticate.")
			if requireAuth {
				return nil, fmt.Errorf("authentication required")
			}
		} else {
			client.Token = session.AccessToken
		}
	} else if requireAuth {
		return nil, fmt.Errorf("not logged in — run `durins-door login` first")
	}

	return client, nil
}
