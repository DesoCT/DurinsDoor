// Package handshake implements the ECDH P-256 key exchange that matches
// the Web Crypto API implementation used by the Durin's Door browser client.
//
// Flow:
//  1. Both parties generate a P-256 keypair.
//  2. They exchange public keys via Supabase (the handshakes table).
//  3. Each derives the shared secret: privKey.ECDH(otherPubKey) → 32 bytes.
//  4. SHA-256(sharedSecret)[0:3] → 3 Tolkien words = verification phrase.
//  5. The shared secret is used directly as an AES-256-GCM key (32 bytes).
package handshake

import (
	"crypto/ecdh"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"

	"github.com/durins-door/cli/internal/wordlist"
)

// KeyPair holds a generated P-256 ECDH key pair.
type KeyPair struct {
	priv *ecdh.PrivateKey
}

// GenerateKeyPair creates a fresh P-256 ECDH key pair.
func GenerateKeyPair() (*KeyPair, error) {
	priv, err := ecdh.P256().GenerateKey(rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generating ECDH keypair: %w", err)
	}
	return &KeyPair{priv: priv}, nil
}

// PublicKeyBytes returns the uncompressed (65-byte) public key.
// This is the value exchanged via Supabase and matches Web Crypto's
// SubtleCrypto.exportKey("raw", ecdhPublicKey) output.
func (kp *KeyPair) PublicKeyBytes() []byte {
	return kp.priv.PublicKey().Bytes()
}

// PublicKeyB64 returns the public key as standard base64, ready for storage.
func (kp *KeyPair) PublicKeyB64() string {
	return base64.StdEncoding.EncodeToString(kp.PublicKeyBytes())
}

// DeriveSharedSecret performs ECDH with the remote party's public key and
// returns the raw 32-byte shared secret.
//
// The shared secret can be used directly as an AES-256-GCM key (KeySize == 32).
// This matches Web Crypto's deriveBits(ecdhParams, privateKey, 256) output.
func (kp *KeyPair) DeriveSharedSecret(otherPubKeyB64 string) ([]byte, error) {
	rawPub, err := decodeB64(otherPubKeyB64)
	if err != nil {
		return nil, fmt.Errorf("decoding remote public key: %w", err)
	}

	otherPub, err := ecdh.P256().NewPublicKey(rawPub)
	if err != nil {
		return nil, fmt.Errorf("parsing remote public key: %w", err)
	}

	secret, err := kp.priv.ECDH(otherPub)
	if err != nil {
		return nil, fmt.Errorf("ECDH: %w", err)
	}

	if len(secret) != 32 {
		// Defensive: P-256 shared secret is always 32 bytes.
		return nil, fmt.Errorf("unexpected shared secret length %d", len(secret))
	}
	return secret, nil
}

// VerificationPhrase derives a 3-word human-verifiable phrase from a shared secret.
// Both parties compute the same phrase; verbal confirmation proves no MITM.
//
// Algorithm: SHA-256(sharedSecret) → first 3 bytes → Tolkien wordlist indices.
// This matches the web app implementation.
func VerificationPhrase(sharedSecret []byte) string {
	h := sha256.Sum256(sharedSecret)
	return wordlist.Phrase(h[0], h[1], h[2])
}

// decodeB64 accepts standard, raw-standard, URL-safe, or raw-URL-safe base64.
func decodeB64(s string) ([]byte, error) {
	encodings := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	for _, enc := range encodings {
		if b, err := enc.DecodeString(s); err == nil {
			return b, nil
		}
	}
	return nil, fmt.Errorf("not valid base64")
}
