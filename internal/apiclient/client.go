// Package apiclient provides an HTTP client for the Durin's Door server API.
// This replaces the old Supabase client — the CLI now talks to the Go server.
package apiclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client is an HTTP client for the Durin's Door server API.
type Client struct {
	BaseURL    string
	AdminToken string
	http       *http.Client
}

// New creates a Client.
func New(baseURL, adminToken string) *Client {
	return &Client{
		BaseURL:    strings.TrimRight(baseURL, "/"),
		AdminToken: adminToken,
		http:       &http.Client{Timeout: 120 * time.Second},
	}
}

// --- Types matching server API responses ---

// Share represents a share returned by the API.
type Share struct {
	ID                string     `json:"id"`
	Filename          string     `json:"filename"`
	FileSize          int64      `json:"file_size"`
	MimeType          string     `json:"mime_type,omitempty"`
	PasswordHash      *string    `json:"password_hash,omitempty"`
	MaxDownloads      *int       `json:"max_downloads,omitempty"`
	Downloads         int        `json:"downloads"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	StoragePath       string     `json:"storage_path,omitempty"`
	PasswordProtected bool       `json:"password_protected"`
}

// Handshake represents a handshake returned by the API.
type Handshake struct {
	ID                string     `json:"id"`
	Code              string     `json:"code"`
	ReceiverPublicKey string     `json:"receiver_public_key"`
	SenderPublicKey   *string    `json:"sender_public_key"`
	ShareID           *string    `json:"share_id"`
	CreatedAt         time.Time  `json:"created_at"`
	ExpiresAt         *time.Time `json:"expires_at"`
}

// HasSender returns true once the sender has connected.
func (h *Handshake) HasSender() bool {
	return h.SenderPublicKey != nil && *h.SenderPublicKey != ""
}

// HasShare returns true once the sender has uploaded and linked a share.
func (h *Handshake) HasShare() bool {
	return h.ShareID != nil && *h.ShareID != ""
}

// --- Share operations ---

// UploadInput contains the parameters for uploading a file.
type UploadInput struct {
	Filename     string
	FileData     io.Reader
	FileSize     int64
	Password     string
	ExpiresAt    string // RFC3339
	MaxDownloads int
}

// Upload encrypts and uploads a file to the server, returning the created share.
func (c *Client) Upload(input UploadInput) (*Share, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	fw, err := mw.CreateFormFile("file", input.Filename)
	if err != nil {
		return nil, fmt.Errorf("creating form file: %w", err)
	}
	if _, err := io.Copy(fw, input.FileData); err != nil {
		return nil, fmt.Errorf("writing file data: %w", err)
	}

	if input.Password != "" {
		mw.WriteField("password", input.Password)
	}
	if input.ExpiresAt != "" {
		mw.WriteField("expires_at", input.ExpiresAt)
	}
	if input.MaxDownloads > 0 {
		mw.WriteField("max_downloads", fmt.Sprintf("%d", input.MaxDownloads))
	}
	mw.Close()

	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/upload", &buf)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", mw.FormDataContentType())

	var share Share
	if err := c.doJSON(req, &share); err != nil {
		return nil, err
	}
	return &share, nil
}

// GetShare fetches share metadata by ID.
func (c *Client) GetShare(id string) (*Share, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+"/api/shares/"+id, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	var share Share
	if err := c.doJSON(req, &share); err != nil {
		return nil, err
	}
	return &share, nil
}

// ListShares returns all shares.
func (c *Client) ListShares() ([]Share, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+"/api/shares", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	var shares []Share
	if err := c.doJSON(req, &shares); err != nil {
		return nil, err
	}
	return shares, nil
}

// DownloadFile downloads the encrypted file for a share.
func (c *Client) DownloadFile(id string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+"/api/shares/"+id+"/file", nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("downloading file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("download failed (%d): %s", resp.StatusCode, string(body))
	}

	return io.ReadAll(resp.Body)
}

// IncrementDownloads bumps the download counter.
func (c *Client) IncrementDownloads(id string) error {
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/shares/"+id+"/downloads", nil)
	if err != nil {
		return err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}

// DeleteShare revokes a share.
func (c *Client) DeleteShare(id string) error {
	req, err := http.NewRequest(http.MethodDelete, c.BaseURL+"/api/shares/"+id, nil)
	if err != nil {
		return err
	}
	c.setAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("delete failed (%d)", resp.StatusCode)
	}
	return nil
}

// --- Handshake operations ---

// CreateHandshake creates a new handshake session.
func (c *Client) CreateHandshake(code, receiverPubKeyB64 string) (*Handshake, error) {
	payload := map[string]string{
		"code":                code,
		"receiver_public_key": receiverPubKeyB64,
	}
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/api/handshakes", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")

	var hs Handshake
	if err := c.doJSON(req, &hs); err != nil {
		return nil, err
	}
	return &hs, nil
}

// GetHandshakeByCode looks up a handshake by pairing code.
func (c *Client) GetHandshakeByCode(code string) (*Handshake, error) {
	req, err := http.NewRequest(http.MethodGet,
		c.BaseURL+"/api/handshakes?code="+url.QueryEscape(code), nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	var hs Handshake
	if err := c.doJSON(req, &hs); err != nil {
		return nil, err
	}
	return &hs, nil
}

// GetHandshake fetches a handshake by ID.
func (c *Client) GetHandshake(id string) (*Handshake, error) {
	req, err := http.NewRequest(http.MethodGet, c.BaseURL+"/api/handshakes/"+id, nil)
	if err != nil {
		return nil, err
	}
	c.setAuth(req)
	var hs Handshake
	if err := c.doJSON(req, &hs); err != nil {
		return nil, err
	}
	return &hs, nil
}

// SetSenderPublicKey updates the sender's public key on a handshake.
func (c *Client) SetSenderPublicKey(id, senderPubKeyB64 string) error {
	payload := map[string]string{"sender_public_key": senderPubKeyB64}
	return c.patchHandshake(id, payload)
}

// SetHandshakeShareID links a share to a handshake.
func (c *Client) SetHandshakeShareID(id, shareID string) error {
	payload := map[string]string{"share_id": shareID}
	return c.patchHandshake(id, payload)
}

// PollForSender blocks until the handshake has a sender_public_key.
func (c *Client) PollForSender(id string, timeout time.Duration) (*Handshake, error) {
	return c.pollHandshake(id, timeout, (*Handshake).HasSender)
}

// PollForShare blocks until the handshake has a share_id.
func (c *Client) PollForShare(id string, timeout time.Duration) (*Handshake, error) {
	return c.pollHandshake(id, timeout, (*Handshake).HasShare)
}

func (c *Client) pollHandshake(id string, timeout time.Duration, ready func(*Handshake) bool) (*Handshake, error) {
	deadline := time.Now().Add(timeout)
	for {
		h, err := c.GetHandshake(id)
		if err != nil {
			return nil, err
		}
		if ready(h) {
			return h, nil
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("timed out after %s waiting for peer", timeout)
		}
		time.Sleep(2 * time.Second)
	}
}

func (c *Client) patchHandshake(id string, payload interface{}) error {
	b, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPatch, c.BaseURL+"/api/handshakes/"+id, bytes.NewReader(b))
	if err != nil {
		return err
	}
	c.setAuth(req)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("patch failed (%d)", resp.StatusCode)
	}
	return nil
}

// --- Internal helpers ---

func (c *Client) setAuth(req *http.Request) {
	if c.AdminToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.AdminToken)
	}
}

func (c *Client) doJSON(req *http.Request, out interface{}) error {
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var errResp struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(body, &errResp)
		msg := errResp.Error
		if msg == "" {
			msg = string(body)
		}
		return fmt.Errorf("API error %d: %s", resp.StatusCode, msg)
	}

	if out != nil && len(body) > 0 {
		if err := json.Unmarshal(body, out); err != nil {
			return fmt.Errorf("decoding response: %w", err)
		}
	}
	return nil
}
