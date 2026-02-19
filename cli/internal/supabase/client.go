// Package supabase provides a minimal HTTP client for Supabase REST, Auth,
// and Storage APIs. No official SDK dependency — pure net/http + encoding/json.
package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is a thin Supabase REST client.
type Client struct {
	BaseURL string
	AnonKey string
	Token   string // JWT access token (optional; set after login)
	http    *http.Client
}

// New creates a Client with default timeouts.
func New(baseURL, anonKey string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		AnonKey: anonKey,
		http:    &http.Client{Timeout: 120 * time.Second},
	}
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

// SignInResponse is the JSON response from /auth/v1/token?grant_type=password.
type SignInResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"` // seconds
	User         *AuthUser `json:"user"`
}

// AuthUser is the nested user object in Supabase auth responses.
type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// SignIn authenticates with email + password and returns the session.
func (c *Client) SignIn(email, password string) (*SignInResponse, error) {
	payload := map[string]string{
		"email":    email,
		"password": password,
	}
	var resp SignInResponse
	if err := c.authPost("/auth/v1/token?grant_type=password", payload, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// --------------------------------------------------------------------------
// Shares (PostgREST)
// --------------------------------------------------------------------------

// Share represents a row in the `shares` table.
type Share struct {
	ID           string     `json:"id"`
	UserID       *string    `json:"user_id"`
	StoragePath  string     `json:"storage_path"`
	Filename     string     `json:"filename"`
	FileSize     int64      `json:"file_size"`
	MimeType     string     `json:"mime_type"`
	PasswordHash *string    `json:"password_hash"`
	MaxDownloads *int       `json:"max_downloads"`
	Downloads    int        `json:"downloads"`
	ExpiresAt    *time.Time `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

// CreateShareInput is the payload for inserting a new share row.
type CreateShareInput struct {
	StoragePath  string  `json:"storage_path"`
	Filename     string  `json:"filename"`
	FileSize     int64   `json:"file_size"`
	MimeType     string  `json:"mime_type"`
	PasswordHash *string `json:"password_hash,omitempty"`
	MaxDownloads *int    `json:"max_downloads,omitempty"`
	ExpiresAt    *string `json:"expires_at,omitempty"` // RFC3339
}

// CreateShare inserts a new share row and returns the created record.
func (c *Client) CreateShare(input CreateShareInput) (*Share, error) {
	var shares []Share
	if err := c.restPost("/rest/v1/shares", input, &shares, http.Header{
		"Prefer": []string{"return=representation"},
	}); err != nil {
		return nil, err
	}
	if len(shares) == 0 {
		return nil, fmt.Errorf("no share returned after insert")
	}
	return &shares[0], nil
}

// GetShare fetches a single share by ID (public endpoint — no auth required).
func (c *Client) GetShare(id string) (*Share, error) {
	var shares []Share
	path := fmt.Sprintf("/rest/v1/shares?id=eq.%s&select=*&limit=1", id)
	if err := c.restGet(path, &shares); err != nil {
		return nil, err
	}
	if len(shares) == 0 {
		return nil, fmt.Errorf("share %q not found", id)
	}
	return &shares[0], nil
}

// ListShares returns all shares belonging to the authenticated user.
func (c *Client) ListShares() ([]Share, error) {
	var shares []Share
	if err := c.restGet("/rest/v1/shares?select=*&order=created_at.desc", &shares); err != nil {
		return nil, err
	}
	return shares, nil
}

// DeleteShare removes a share by ID (RLS ensures ownership).
func (c *Client) DeleteShare(id string) error {
	path := fmt.Sprintf("/rest/v1/shares?id=eq.%s", id)
	return c.restDelete(path)
}

// IncrementDownloads bumps the download counter via a RPC or direct update.
func (c *Client) IncrementDownloads(id string) error {
	// Use PostgREST PATCH with a raw SQL expression isn't straightforward,
	// so we call an RPC if available; otherwise fall back to a plain PATCH.
	// The web app typically uses a DB function `increment_downloads(share_id uuid)`.
	payload := map[string]string{"share_id": id}
	return c.restRPC("/rest/v1/rpc/increment_downloads", payload)
}

// --------------------------------------------------------------------------
// Storage
// --------------------------------------------------------------------------

const storageBucket = "shares"

// UploadFile uploads an encrypted blob to Supabase Storage.
// storagePath is the object key inside the bucket (e.g., "<uuid>.enc").
func (c *Client) UploadFile(storagePath string, data []byte, contentType string) error {
	return c.UploadFileReader(storagePath, bytes.NewReader(data), int64(len(data)), contentType)
}

// UploadFileReader uploads from an io.Reader, allowing the caller to wrap it
// with a progress tracker. size must be the exact byte count.
func (c *Client) UploadFileReader(storagePath string, r io.Reader, size int64, contentType string) error {
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.BaseURL, storageBucket, storagePath)

	req, err := http.NewRequest(http.MethodPost, uploadURL, r)
	if err != nil {
		return fmt.Errorf("building upload request: %w", err)
	}
	req.ContentLength = size
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", contentType)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("uploading file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage upload failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

// DownloadFile fetches an encrypted blob from Supabase Storage.
func (c *Client) DownloadFile(storagePath string) ([]byte, error) {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.BaseURL, storageBucket, storagePath)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("building download request: %w", err)
	}
	c.setAuthHeaders(req)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("downloading file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("storage download failed (%d): %s", resp.StatusCode, string(body))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}
	return data, nil
}

// DeleteFile removes an object from Supabase Storage.
func (c *Client) DeleteFile(storagePath string) error {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.BaseURL, storageBucket, storagePath)
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("storage delete failed (%d)", resp.StatusCode)
	}
	return nil
}

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

func (c *Client) setAuthHeaders(req *http.Request) {
	req.Header.Set("apikey", c.AnonKey)
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	} else {
		req.Header.Set("Authorization", "Bearer "+c.AnonKey)
	}
}

func (c *Client) restGet(path string, out interface{}) error {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	return c.doJSON(req, out)
}

func (c *Client) restPost(path string, body interface{}, out interface{}, extra http.Header) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	for k, vs := range extra {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	return c.doJSON(req, out)
}

func (c *Client) restPatch(path string, body interface{}) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPatch, c.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("patch request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body2, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("patch failed (%d): %s", resp.StatusCode, string(body2))
	}
	return nil
}

func (c *Client) restDelete(path string) error {
	req, err := http.NewRequest(http.MethodDelete, c.BaseURL+path, nil)
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed (%d): %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *Client) restRPC(path string, body interface{}) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	c.setAuthHeaders(req)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	// 200 or 204 are both fine for RPC
	if resp.StatusCode >= 400 {
		body2, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("rpc failed (%d): %s", resp.StatusCode, string(body2))
	}
	return nil
}

func (c *Client) authPost(path string, body interface{}, out interface{}) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.AnonKey)
	req.Header.Set("Content-Type", "application/json")
	return c.doJSON(req, out)
}

func (c *Client) doJSON(req *http.Request, out interface{}) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode >= 400 {
		// Try to extract a human-readable Supabase error message.
		var errResp struct {
			Message string `json:"message"`
			Error   string `json:"error"`
			Msg     string `json:"msg"`
			Hint    string `json:"hint"`
		}
		_ = json.Unmarshal(respBody, &errResp)
		msg := errResp.Message
		if msg == "" {
			msg = errResp.Error
		}
		if msg == "" {
			msg = errResp.Msg
		}
		if msg == "" {
			msg = string(respBody)
		}
		if errResp.Hint != "" {
			msg += " (" + errResp.Hint + ")"
		}
		return fmt.Errorf("API error %d: %s", resp.StatusCode, msg)
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}
