package cmd

import (
	"fmt"
	"os"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"golang.org/x/term"

	"github.com/durins-door/cli/internal/auth"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with Supabase (stores JWT locally)",
	Long: `Authenticates with Supabase using email and password.
The JWT is stored in ~/.config/durins-door/auth.json (mode 0600).

Login is optional for sharing — anonymous shares are supported.
Login is required for listing and revoking your shares.`,
	Args: cobra.NoArgs,
	RunE: runLogin,
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored authentication token",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := auth.Clear(); err != nil {
			return fmt.Errorf("clearing session: %w", err)
		}
		fmt.Fprintln(os.Stderr, "Logged out.")
		return nil
	},
}

func runLogin(cmd *cobra.Command, args []string) error {
	// Prompt for email.
	var email string
	fmt.Fprint(os.Stderr, "Email: ")
	if _, err := fmt.Fscan(os.Stdin, &email); err != nil {
		return fmt.Errorf("reading email: %w", err)
	}

	// Prompt for password (no echo).
	fmt.Fprint(os.Stderr, "Password: ")
	pwBytes, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Fprintln(os.Stderr)
	if err != nil {
		return fmt.Errorf("reading password: %w", err)
	}
	password := string(pwBytes)

	// Sign in.
	client, err := newClient(false)
	if err != nil {
		return err
	}

	fmt.Fprintln(os.Stderr, "Signing in …")
	resp, err := client.SignIn(email, password)
	if err != nil {
		return fmt.Errorf("sign in failed: %w", err)
	}

	// Persist session.
	session := &auth.Session{
		AccessToken:  resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresAt:    time.Now().Add(time.Duration(resp.ExpiresIn) * time.Second),
	}
	if resp.User != nil {
		session.UserID = resp.User.ID
		session.Email = resp.User.Email
	}

	if err := auth.Save(session); err != nil {
		return fmt.Errorf("saving session: %w", err)
	}

	fmt.Fprintf(os.Stderr, "✓ Logged in as %s\n", session.Email)
	return nil
}
