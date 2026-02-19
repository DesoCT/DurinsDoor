// Package auth handles persistent JWT storage for authenticated Supabase sessions.
package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const configDir = "durins-door"
const authFile = "auth.json"

// Session represents a stored Supabase auth session.
type Session struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	UserID       string    `json:"user_id"`
	Email        string    `json:"email"`
}

// IsExpired returns true if the access token has expired (or will expire in <60s).
func (s *Session) IsExpired() bool {
	return time.Now().Add(60 * time.Second).After(s.ExpiresAt)
}

// configPath returns the path to the auth.json file.
func configPath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("finding config dir: %w", err)
	}
	return filepath.Join(dir, configDir, authFile), nil
}

// Load reads the stored session from disk. Returns nil, nil if no session exists.
func Load() (*Session, error) {
	path, err := configPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading auth file: %w", err)
	}

	var s Session
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parsing auth file: %w", err)
	}
	return &s, nil
}

// Save persists the session to disk (mode 0600).
func Save(s *Session) error {
	path, err := configPath()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return fmt.Errorf("serialising session: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing auth file: %w", err)
	}
	return nil
}

// Clear removes the stored session.
func Clear() error {
	path, err := configPath()
	if err != nil {
		return err
	}
	err = os.Remove(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}
