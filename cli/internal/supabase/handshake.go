package supabase

import (
	"fmt"
	"net/url"
	"net/http"
	"time"
)

// Handshake represents a row in the `handshakes` table.
// The table is created by the web app migration:
//
//	CREATE TABLE handshakes (
//	  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//	  code                text UNIQUE NOT NULL,
//	  receiver_public_key text NOT NULL,
//	  sender_public_key   text,          -- set by sender when they connect
//	  share_id            uuid REFERENCES shares(id),
//	  created_at          timestamptz DEFAULT now(),
//	  expires_at          timestamptz DEFAULT now() + interval '10 minutes'
//	);
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

// CreateHandshake inserts a new handshake row as the receiver.
func (c *Client) CreateHandshake(code, receiverPubKeyB64 string) (*Handshake, error) {
	payload := map[string]string{
		"code":                code,
		"receiver_public_key": receiverPubKeyB64,
	}
	var rows []Handshake
	err := c.restPost("/rest/v1/handshakes", payload, &rows, http.Header{
		"Prefer": []string{"return=representation"},
	})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("no handshake returned after insert")
	}
	return &rows[0], nil
}

// GetHandshakeByCode fetches a handshake row by its pairing code.
func (c *Client) GetHandshakeByCode(code string) (*Handshake, error) {
	path := "/rest/v1/handshakes?code=eq." + url.QueryEscape(code) + "&select=*&limit=1"
	var rows []Handshake
	if err := c.restGet(path, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("no handshake found for code %q — check the code and try again", code)
	}
	return &rows[0], nil
}

// GetHandshakeByID fetches a handshake row by its UUID.
func (c *Client) GetHandshakeByID(id string) (*Handshake, error) {
	path := "/rest/v1/handshakes?id=eq." + url.QueryEscape(id) + "&select=*&limit=1"
	var rows []Handshake
	if err := c.restGet(path, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("handshake %q not found", id)
	}
	return &rows[0], nil
}

// SetSenderPublicKey records the sender's ECDH public key on a handshake row.
func (c *Client) SetSenderPublicKey(id, senderPubKeyB64 string) error {
	path := "/rest/v1/handshakes?id=eq." + url.QueryEscape(id)
	return c.restPatch(path, map[string]string{"sender_public_key": senderPubKeyB64})
}

// SetHandshakeShareID links the uploaded share to the handshake so the
// receiver knows to start downloading.
func (c *Client) SetHandshakeShareID(id, shareID string) error {
	path := "/rest/v1/handshakes?id=eq." + url.QueryEscape(id)
	return c.restPatch(path, map[string]string{"share_id": shareID})
}

// PollForSender blocks until the handshake has a sender_public_key or the
// timeout elapses (polling every 2 seconds).
func (c *Client) PollForSender(id string, timeout time.Duration) (*Handshake, error) {
	return c.pollHandshake(id, timeout, (*Handshake).HasSender)
}

// PollForShare blocks until the handshake has a share_id or the timeout elapses.
func (c *Client) PollForShare(id string, timeout time.Duration) (*Handshake, error) {
	return c.pollHandshake(id, timeout, (*Handshake).HasShare)
}

// pollHandshake is the generic polling helper used by PollForSender/PollForShare.
func (c *Client) pollHandshake(id string, timeout time.Duration, ready func(*Handshake) bool) (*Handshake, error) {
	deadline := time.Now().Add(timeout)
	for {
		h, err := c.GetHandshakeByID(id)
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
