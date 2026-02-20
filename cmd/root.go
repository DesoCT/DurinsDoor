// Package cmd implements the Durin's Door CLI.
package cmd

import (
	"embed"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/apiclient"
)

const (
	DefaultServerURL = "http://localhost:8888"
)

// Version and BuildDate are set via ldflags at build time.
var (
	Version   = "dev"
	BuildDate = "unknown"
)

// webFS is injected from main via SetWebFS.
var webFS embed.FS

// SetWebFS injects the embedded web filesystem into the cmd package.
func SetWebFS(fs embed.FS) {
	webFS = fs
}

// Persistent flags for server connection.
var (
	flagServerURL   string
	flagAdminToken  string
)

var rootCmd = &cobra.Command{
	Use:   "durins-door",
	Short: "Durin's Door — encrypted temporary file sharing",
	Long: `
  ╔═══════════════════════════════════════╗
  ║         🚪  DURIN'S DOOR  🚪          ║
  ║   Speak, friend, and download.        ║
  ╚═══════════════════════════════════════╝

Durin's Door encrypts your files and creates temporary download links.
Files are AES-256-GCM encrypted at rest and decrypted on-the-fly during download.

Usage:
  durins-door share myfile.zip          # Share a file (1 hour default expiry)
  durins-door share myfile.zip --expires 24h
  durins-door share myfile.zip --password "mellon"
  durins-door download <url>            # Download and decrypt a shared file
  durins-door send <file> --to <CODE>   # Send a file to a waiting receiver
  durins-door receive                   # Wait for a peer to send you a file
  durins-door list                      # List active shares
  durins-door revoke <id>               # Revoke a share
  durins-door server                    # Start standalone server`,
	SilenceUsage: true,
	Version:      Version,
}

func init() {
	rootCmd.SetVersionTemplate(fmt.Sprintf("durins-door %s (built %s)\n", Version, BuildDate))
	rootCmd.PersistentFlags().StringVar(&flagServerURL, "server-url", DefaultServerURL,
		"Durin's Door server URL")
	rootCmd.PersistentFlags().StringVar(&flagAdminToken, "api-token", "",
		"Admin bearer token for server API")
}

// newAPIClient returns an API client configured from persistent flags.
func newAPIClient() *apiclient.Client {
	token := flagAdminToken
	if token == "" {
		token = os.Getenv("DURINS_DOOR_TOKEN")
	}
	return apiclient.New(flagServerURL, token)
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
