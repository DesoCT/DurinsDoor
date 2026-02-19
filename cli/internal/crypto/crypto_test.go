package crypto_test

import (
	"bytes"
	"encoding/base64"
	"testing"

	"github.com/durins-door/cli/internal/crypto"
)

func TestEncryptDecryptRoundtrip(t *testing.T) {
	plaintext := []byte("Speak, friend, and enter.")

	result, err := crypto.Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}

	if len(result.Blob) < crypto.IVSize {
		t.Fatalf("blob too short: %d bytes", len(result.Blob))
	}

	// Verify key is valid base64.
	key, err := base64.StdEncoding.DecodeString(result.KeyB64)
	if err != nil {
		t.Fatalf("key not valid base64: %v", err)
	}
	if len(key) != crypto.KeySize {
		t.Fatalf("key length %d, want %d", len(key), crypto.KeySize)
	}

	// Decrypt and check round-trip.
	got, err := crypto.Decrypt(result.Blob, result.KeyB64)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}

	if !bytes.Equal(plaintext, got) {
		t.Fatalf("plaintext mismatch:\n  want: %q\n  got:  %q", plaintext, got)
	}
}

func TestBlobFormat_IVPrepended(t *testing.T) {
	// Blob must start with exactly IVSize bytes.
	result, err := crypto.Encrypt([]byte("test"))
	if err != nil {
		t.Fatal(err)
	}

	if len(result.Blob) < crypto.IVSize+16 {
		// AES-GCM adds a 16-byte authentication tag to even a 0-byte plaintext.
		t.Fatalf("blob unexpectedly short: %d bytes", len(result.Blob))
	}

	// IV || ciphertext: first 12 bytes are the IV.
	iv := result.Blob[:crypto.IVSize]
	if len(iv) != 12 {
		t.Fatalf("IV length %d, want 12", len(iv))
	}
}

func TestDecrypt_WrongKey(t *testing.T) {
	result, err := crypto.Encrypt([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}

	// Generate a different key.
	differentKey := make([]byte, crypto.KeySize)
	differentKey[0] = ^result.Blob[0] // flip a bit
	badKeyB64 := base64.StdEncoding.EncodeToString(differentKey)

	_, err = crypto.Decrypt(result.Blob, badKeyB64)
	if err == nil {
		t.Fatal("expected error decrypting with wrong key, got nil")
	}
}

func TestDecrypt_URLSafeBase64Key(t *testing.T) {
	plaintext := []byte("URL-safe key test")

	result, err := crypto.Encrypt(plaintext)
	if err != nil {
		t.Fatal(err)
	}

	// Convert key to URL-safe base64 (no padding) and ensure Decrypt accepts it.
	keyBytes, _ := base64.StdEncoding.DecodeString(result.KeyB64)
	urlSafeKey := base64.RawURLEncoding.EncodeToString(keyBytes)

	got, err := crypto.Decrypt(result.Blob, urlSafeKey)
	if err != nil {
		t.Fatalf("Decrypt with URL-safe key: %v", err)
	}

	if !bytes.Equal(plaintext, got) {
		t.Fatalf("plaintext mismatch after URL-safe decode")
	}
}

func TestEncrypt_UniqueIVPerCall(t *testing.T) {
	// Two encryptions of the same plaintext must produce different blobs
	// (because each has a fresh random IV).
	pt := []byte("repeat me")
	r1, _ := crypto.Encrypt(pt)
	r2, _ := crypto.Encrypt(pt)

	if bytes.Equal(r1.Blob, r2.Blob) {
		t.Fatal("two encryptions produced identical blobs — IV is not random!")
	}
}
