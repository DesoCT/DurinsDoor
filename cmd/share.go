package cmd

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/unisoniq/durins-door/internal/crypto"
	"github.com/unisoniq/durins-door/internal/server"
	"github.com/unisoniq/durins-door/internal/share"
	"github.com/unisoniq/durins-door/internal/tunnel"
	"golang.org/x/crypto/bcrypt"
)

var shareCmd = &cobra.Command{
	Use:   "share <file>",
	Short: "Share a file via a temporary encrypted download link",
	Long: `Encrypts a file and starts a local HTTP server with a temporary download URL.

Examples:
  durins-door share myfile.zip
  durins-door share myfile.zip --expires 24h --max-downloads 3
  durins-door share secret.pdf --password "mellon" --key "customsecret"`,
	Args: cobra.ExactArgs(1),
	RunE: runShare,
}

var (
	flagKey          string
	flagExpires      time.Duration
	flagPassword     string
	flagMaxDownloads int
	flagPort         int
	flagTunnel       bool
	flagNoTunnel     bool
	flagRegisterOnly bool
)

func init() {
	shareCmd.Flags().StringVar(&flagKey, "key", "", "Custom encryption key passphrase (auto-generated if empty)")
	shareCmd.Flags().DurationVar(&flagExpires, "expires", time.Hour, "Expiry duration (e.g. 1h, 24h)")
	shareCmd.Flags().StringVar(&flagPassword, "password", "", "Require a password to download")
	shareCmd.Flags().IntVar(&flagMaxDownloads, "max-downloads", 0, "Maximum number of downloads (0 = unlimited)")
	shareCmd.Flags().IntVar(&flagPort, "port", 0, "HTTP server port (0 = auto)")
	shareCmd.Flags().BoolVar(&flagTunnel, "tunnel", true, "Auto-create public tunnel via Cloudflare/ngrok (default: true)")
	shareCmd.Flags().BoolVar(&flagNoTunnel, "no-tunnel", false, "Disable automatic tunnel")
	shareCmd.Flags().BoolVar(&flagRegisterOnly, "register-only", false, "Encrypt and register the share but don't start a server")

	rootCmd.AddCommand(shareCmd)
}

func runShare(cmd *cobra.Command, args []string) error {
	filePath := args[0]

	// Validate file
	fi, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("cannot access file: %w", err)
	}
	if fi.IsDir() {
		return fmt.Errorf("%s is a directory — please zip it first", filePath)
	}

	// Derive or generate encryption key
	var key []byte
	var keyHex string
	if flagKey != "" {
		key = crypto.DeriveKey(flagKey)
		keyHex = crypto.KeyToHex(key)
	} else {
		key, err = crypto.GenerateKey()
		if err != nil {
			return fmt.Errorf("generate key: %w", err)
		}
		keyHex = crypto.KeyToHex(key)
	}

	// Open the store
	st, err := share.NewStore(dataDir())
	if err != nil {
		return fmt.Errorf("open store: %w", err)
	}
	defer st.Close()

	// Encrypt the file into the data dir
	shareID := randomID()
	encPath := filepath.Join(st.DataDir(), "files", shareID+".enc")
	if err := os.MkdirAll(filepath.Dir(encPath), 0700); err != nil {
		return fmt.Errorf("create files dir: %w", err)
	}

	fmt.Printf("🔐 Encrypting %s...\n", filepath.Base(filePath))
	if err := encryptFile(filePath, encPath, key); err != nil {
		return fmt.Errorf("encrypt: %w", err)
	}

	// Hash password if provided
	var passwordHash string
	if flagPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(flagPassword), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password: %w", err)
		}
		passwordHash = string(hash)
	}

	// Generate admin token
	adminToken := randomID()

	// Create share record
	sh := &share.Share{
		ID:            shareID,
		Filename:      filepath.Base(filePath),
		EncryptedPath: encPath,
		KeyHex:        keyHex,
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(flagExpires),
		MaxDownloads:  flagMaxDownloads,
		PasswordHash:  passwordHash,
		AdminToken:    adminToken,
		Size:          fi.Size(),
	}

	if err := st.Create(cmd.Context(), sh); err != nil {
		return fmt.Errorf("create share: %w", err)
	}

	// Signal context for graceful shutdown
	ctx, cancel := signal.NotifyContext(cmd.Context(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// Pick a port
	port := flagPort
	if port == 0 {
		port = findFreePort()
	}

	// Print share info
	localURL := fmt.Sprintf("http://localhost:%d/d/%s", port, shareID)
	localAdmin := fmt.Sprintf("http://localhost:%d/admin?token=%s", port, adminToken)
	_, _ = localURL, localAdmin

	fmt.Println()
	printBanner()
	fmt.Printf("  📁 File:        %s (%s)\n", fi.Name(), humanSizeCmd(fi.Size()))
	fmt.Printf("  ⏱  Expires:     %s\n", flagExpires)
	if flagMaxDownloads > 0 {
		fmt.Printf("  ⬇  Downloads:   max %d\n", flagMaxDownloads)
	}
	if flagPassword != "" {
		fmt.Printf("  🔑 Password:    set\n")
	}
	fmt.Println()
	fmt.Printf("  🔗 Share path:  /d/%s\n", shareID)
	fmt.Printf("  🛡  Admin token: %s\n", adminToken)
	fmt.Println()

	if flagRegisterOnly {
		fmt.Println("  ✅ Share registered. Start the server with: durins-door server")
		return nil
	}

	// Auto-start tunnel unless disabled
	var tun *tunnel.Tunnel
	useTunnel := flagTunnel && !flagNoTunnel
	if useTunnel && tunnel.IsAvailable() {
		fmt.Printf("  🌍 Starting %s tunnel...\n", tunnel.Name())
		// Start server first so tunnel has something to connect to
		srv := server.New(server.Config{
			Store:      st,
			AdminToken: adminToken,
			Port:       port,
			WebFS:      webFS,
		})
		go srv.Start(ctx)
		time.Sleep(500 * time.Millisecond) // let server bind

		tun, err = tunnel.Start(ctx, port)
		if err != nil {
			fmt.Printf("  ⚠  Tunnel failed: %v\n", err)
			fmt.Printf("  📡 Falling back to local: %s\n", localURL)
		} else {
			publicURL := fmt.Sprintf("%s/d/%s", tun.PublicURL, shareID)
			publicAdmin := fmt.Sprintf("%s/admin?token=%s", tun.PublicURL, adminToken)
			fmt.Println()
			fmt.Printf("  🌍 Public URL:  %s\n", publicURL)
			fmt.Printf("  🛡  Admin:       %s\n", publicAdmin)
			fmt.Printf("  ⚡ Tunnel:       %s via %s\n", tun.PublicURL, tun.Backend)
		}
		fmt.Println()
		fmt.Println("  Press Ctrl+C to stop.")
		fmt.Println()

		// Wait for context cancellation
		<-ctx.Done()

		// Cleanup
		fmt.Println("\n✨ Shutting down...")
		if tun != nil {
			tun.Stop()
		}
		if err := st.Revoke(context.Background(), shareID); err != nil {
			log.Printf("cleanup warning: %v", err)
		}
		fmt.Println("✅ Share revoked and encrypted file deleted.")
		return nil
	}

	if !useTunnel {
		fmt.Printf("  📡 Local only (tunnel disabled)\n")
	} else {
		fmt.Printf("  💡 No tunnel tool found. Install cloudflared for auto-tunneling.\n")
	}
	fmt.Println()
	fmt.Println("  Press Ctrl+C to stop the server and revoke the share.")
	fmt.Println()

	// Start server (no-tunnel path)
	srv := server.New(server.Config{
		Store:      st,
		AdminToken: adminToken,
		Port:       port,
		WebFS:      webFS,
	})

	if err := srv.Start(ctx); err != nil {
		return fmt.Errorf("server: %w", err)
	}

	// Cleanup on exit
	fmt.Println("\n✨ Server stopped. Cleaning up...")
	if err := st.Revoke(context.Background(), shareID); err != nil {
		log.Printf("cleanup warning: %v", err)
	}
	fmt.Println("✅ Share revoked and encrypted file deleted.")
	return nil
}

func encryptFile(src, dst string, key []byte) error {
	in, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer in.Close()

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("open dest: %w", err)
	}
	defer out.Close()

	return crypto.EncryptStream(out, in, key)
}

func randomID() string {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		panic(fmt.Sprintf("crypto/rand failure: %v", err))
	}
	return hex.EncodeToString(b)
}

func dataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".durins-door"
	}
	return filepath.Join(home, ".durins-door")
}

func findFreePort() int {
	for port := 8888; port < 9000; port++ {
		ln, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			ln.Close()
			return port
		}
	}
	return 8888
}

func humanSizeCmd(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func printBanner() {
	fmt.Println("  ╔═══════════════════════════════════╗")
	fmt.Println("  ║       🚪  DURIN'S DOOR  🚪        ║")
	fmt.Println("  ║   Speak, friend, and download.    ║")
	fmt.Println("  ╚═══════════════════════════════════╝")
	fmt.Println()
}
