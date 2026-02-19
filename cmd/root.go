// Package cmd implements the Durin's Door CLI.
package cmd

import (
	"embed"
	"fmt"
	"os"

	"github.com/spf13/cobra"
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
  durins-door list                      # List active shares
  durins-door revoke <id>               # Revoke a share
  durins-door server                    # Start standalone server`,
	SilenceUsage: true,
	Version:      Version,
}

func init() {
	rootCmd.SetVersionTemplate(fmt.Sprintf("durins-door %s (built %s)\n", Version, BuildDate))
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
