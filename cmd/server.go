package cmd

import (
	"fmt"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/server"
	"github.com/unisoniq/durins-door/internal/share"
	"github.com/unisoniq/durins-door/internal/tunnel"
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start the Durin's Door server standalone (serves all existing shares)",
	RunE:  runServer,
}

var (
	flagServerPort    int
	flagServerToken   string
	flagServerTunnel  bool
	flagServerNoTunnel bool
)

func init() {
	serverCmd.Flags().IntVar(&flagServerPort, "port", 8888, "HTTP server port")
	serverCmd.Flags().StringVar(&flagServerToken, "token", "", "Admin bearer token (auto-generated if empty)")
	serverCmd.Flags().BoolVar(&flagServerTunnel, "tunnel", true, "Auto-create public tunnel (default: true)")
	serverCmd.Flags().BoolVar(&flagServerNoTunnel, "no-tunnel", false, "Disable automatic tunnel")
	rootCmd.AddCommand(serverCmd)
}

func runServer(cmd *cobra.Command, args []string) error {
	st, err := share.NewStore(dataDir())
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer st.Close()

	adminToken := flagServerToken
	if adminToken == "" {
		adminToken = randomID()
	}

	ctx, cancel := signal.NotifyContext(cmd.Context(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	srv := server.New(server.Config{
		Store:      st,
		AdminToken: adminToken,
		Port:       flagServerPort,
		WebFS:      webFS,
	})

	// Start server in background
	go srv.Start(ctx)
	// Brief pause for bind
	time.Sleep(300 * time.Millisecond)

	fmt.Println()
	printBanner()
	fmt.Printf("  📡 Local:  http://localhost:%d\n", flagServerPort)
	fmt.Printf("  🛡  Admin:  http://localhost:%d/admin?token=%s\n", flagServerPort, adminToken)

	// Auto-tunnel
	useTunnel := flagServerTunnel && !flagServerNoTunnel
	var tun *tunnel.Tunnel
	if useTunnel && tunnel.IsAvailable() {
		fmt.Printf("\n  🌍 Starting %s tunnel...\n", tunnel.Name())
		tun, err = tunnel.Start(ctx, flagServerPort)
		if err != nil {
			fmt.Printf("  ⚠  Tunnel failed: %v\n", err)
		} else {
			fmt.Printf("  🌍 Public: %s\n", tun.PublicURL)
			fmt.Printf("  🛡  Admin:  %s/admin?token=%s\n", tun.PublicURL, adminToken)
		}
	}

	fmt.Println()
	fmt.Println("  Press Ctrl+C to stop.")
	fmt.Println()

	<-ctx.Done()

	fmt.Println("\n✨ Shutting down...")
	if tun != nil {
		tun.Stop()
	}
	return nil
}
