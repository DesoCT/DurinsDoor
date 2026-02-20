// Package webcrypto provides AES-256-GCM encryption compatible with the
// Web Crypto API used by the Durin's Door browser client.
//
// Wire format: IV (12 bytes) || GCM ciphertext+tag
// This is a simpler single-block format (NOT the chunked streaming format
// used by the server's internal/crypto package).
package webcrypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
)

const (
	KeySize = 32
	IVSize  = 12
)

// EncryptResult holds the encrypted payload and the base64-encoded key.
type EncryptResult struct {
	Blob   []byte
	KeyB64 string
}

// Encrypt generates a fresh AES-256 key and encrypts plaintext.
// Returns IV || ciphertext+tag.
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
	blob := make([]byte, IVSize+len(ciphertext))
	copy(blob[:IVSize], iv)
	copy(blob[IVSize:], ciphertext)
	return blob, nil
}

// Decrypt decrypts a blob (IV || ciphertext+tag) using the given base64-encoded key.
func Decrypt(blob []byte, keyB64 string) ([]byte, error) {
	key, err := decodeBase64Key(keyB64)
	if err != nil {
		return nil, fmt.Errorf("decoding key: %w", err)
	}
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key length %d, expected %d", len(key), KeySize)
	}
	return decryptRaw(blob, key)
}

// EncryptWithKey encrypts with a caller-supplied 32-byte key.
func EncryptWithKey(plaintext, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("key must be %d bytes, got %d", KeySize, len(key))
	}
	return encryptWithKey(plaintext, key)
}

// DecryptRaw decrypts a blob using a raw 32-byte key.
func DecryptRaw(blob, key []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, fmt.Errorf("key must be %d bytes, got %d", KeySize, len(key))
	}
	return decryptRaw(blob, key)
}

func decryptRaw(blob, key []byte) ([]byte, error) {
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

func decodeBase64Key(s string) ([]byte, error) {
	for _, enc := range []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	} {
		if b, err := enc.DecodeString(s); err == nil {
			return b, nil
		}
	}
	return nil, fmt.Errorf("not valid base64")
}
