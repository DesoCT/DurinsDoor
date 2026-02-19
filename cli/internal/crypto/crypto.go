// Package crypto provides AES-256-GCM encryption and decryption that matches
// the Web Crypto API implementation used by the Durin's Door browser client.
//
// Wire format: IV (12 bytes) || GCM ciphertext+tag
// Key encoding: standard base64 (URL-safe base64 without padding in URL fragment)
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

const (
	// KeySize is 256 bits (32 bytes), matching Web Crypto AES-GCM 256.
	KeySize = 32
	// IVSize is 12 bytes, the standard GCM nonce size.
	IVSize = 12
)

// EncryptResult holds the encrypted payload and the base64-encoded key
// that should be embedded in the share URL fragment.
type EncryptResult struct {
	// Blob is IV || ciphertext (ready to upload).
	Blob []byte
	// KeyB64 is the raw key encoded as standard base64, used in the URL fragment.
	KeyB64 string
}

// Encrypt generates a fresh random AES-256 key, encrypts plaintext with
// AES-256-GCM, and returns the IV-prepended ciphertext along with the
// base64-encoded key.
//
// Wire format: IV (12 bytes) || GCM ciphertext+auth tag
func Encrypt(plaintext []byte) (*EncryptResult, error) {
	key := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("generating key: %w", err)
	}

	blob, err := encryptWithKey(plaintext, key)
	if err != nil {
		return nil, err
	}

	return &EncryptResult{
		Blob:   blob,
		KeyB64: base64.StdEncoding.EncodeToString(key),
	}, nil
}

// encryptWithKey encrypts plaintext using the given AES-256 key.
// Returns IV || ciphertext+tag.
func encryptWithKey(plaintext, key []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	iv := make([]byte, IVSize)
	if _, err := io.ReadFull(rand.Reader, iv); err != nil {
		return nil, fmt.Errorf("generating IV: %w", err)
	}

	ciphertext := gcm.Seal(nil, iv, plaintext, nil)

	// Prepend IV: IV || ciphertext+tag
	blob := make([]byte, IVSize+len(ciphertext))
	copy(blob[:IVSize], iv)
	copy(blob[IVSize:], ciphertext)

	return blob, nil
}

// Decrypt decrypts a blob (IV || ciphertext+tag) using the given base64-encoded key.
// keyB64 must be standard base64 encoding of the raw 32-byte AES key.
func Decrypt(blob []byte, keyB64 string) ([]byte, error) {
	// Accept both standard and URL-safe base64, with or without padding.
	key, err := decodeBase64Key(keyB64)
	if err != nil {
		return nil, fmt.Errorf("decoding key: %w", err)
	}

	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key length %d, expected %d", len(key), KeySize)
	}

	if len(blob) < IVSize {
		return nil, fmt.Errorf("blob too short: %d bytes", len(blob))
	}

	iv := blob[:IVSize]
	ciphertext := blob[IVSize:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypting: %w (wrong key or corrupted data)", err)
	}

	return plaintext, nil
}

// EncryptWithKey encrypts plaintext using a caller-supplied 32-byte AES-256 key.
// Returns IV || ciphertext+tag (same wire format as Encrypt).
// Used by the handshake flow where the key is derived via ECDH rather than random.
func EncryptWithKey(plaintext, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("key must be %d bytes, got %d", KeySize, len(key))
	}
	return encryptWithKey(plaintext, key)
}

// DecryptRaw decrypts a blob (IV || ciphertext+tag) using a raw 32-byte key.
// Used by the handshake flow where the key is already available as bytes.
func DecryptRaw(blob, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("key must be %d bytes, got %d", KeySize, len(key))
	}
	if len(blob) < IVSize {
		return nil, fmt.Errorf("blob too short: %d bytes", len(blob))
	}

	iv := blob[:IVSize]
	ciphertext := blob[IVSize:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("creating cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("creating GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, iv, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypting: %w (wrong key or corrupted data)", err)
	}
	return plaintext, nil
}

// decodeBase64Key tries standard, then URL-safe base64 (with and without padding).
func decodeBase64Key(s string) ([]byte, error) {
	// Try standard base64 first
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	// Try standard base64 without padding
	if b, err := base64.RawStdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	// Try URL-safe base64
	if b, err := base64.URLEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	// Try URL-safe base64 without padding
	if b, err := base64.RawURLEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return nil, fmt.Errorf("not valid base64")
}
