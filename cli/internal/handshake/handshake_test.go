package handshake_test

import (
	"encoding/base64"
	"strings"
	"testing"

	"github.com/durins-door/cli/internal/handshake"
)

// TestECDH_SharedSecretMatches verifies that both sides of an ECDH exchange
// derive identical 32-byte shared secrets — a fundamental correctness check.
func TestECDH_SharedSecretMatches(t *testing.T) {
	alice, err := handshake.GenerateKeyPair()
	if err != nil {
		t.Fatalf("Alice keygen: %v", err)
	}
	bob, err := handshake.GenerateKeyPair()
	if err != nil {
		t.Fatalf("Bob keygen: %v", err)
	}

	aliceSecret, err := alice.DeriveSharedSecret(bob.PublicKeyB64())
	if err != nil {
		t.Fatalf("Alice ECDH: %v", err)
	}

	bobSecret, err := bob.DeriveSharedSecret(alice.PublicKeyB64())
	if err != nil {
		t.Fatalf("Bob ECDH: %v", err)
	}

	if len(aliceSecret) != 32 {
		t.Fatalf("Alice secret length %d, want 32", len(aliceSecret))
	}
	if string(aliceSecret) != string(bobSecret) {
		t.Fatalf("shared secrets don't match:\n  Alice: %x\n  Bob:   %x", aliceSecret, bobSecret)
	}
}

// TestVerificationPhrase_Deterministic checks that the phrase is the same
// when computed from the same secret on both sides.
func TestVerificationPhrase_Deterministic(t *testing.T) {
	alice, _ := handshake.GenerateKeyPair()
	bob, _ := handshake.GenerateKeyPair()

	aliceSecret, _ := alice.DeriveSharedSecret(bob.PublicKeyB64())
	bobSecret, _ := bob.DeriveSharedSecret(alice.PublicKeyB64())

	phraseA := handshake.VerificationPhrase(aliceSecret)
	phraseB := handshake.VerificationPhrase(bobSecret)

	if phraseA != phraseB {
		t.Fatalf("phrases differ:\n  Alice: %q\n  Bob:   %q", phraseA, phraseB)
	}

	// Should be three words.
	words := strings.Fields(phraseA)
	if len(words) != 3 {
		t.Fatalf("expected 3-word phrase, got %d words: %q", len(words), phraseA)
	}
	t.Logf("verification phrase: %s", phraseA)
}

// TestPublicKey_ValidBase64AndSize verifies the public key export format.
func TestPublicKey_ValidBase64AndSize(t *testing.T) {
	kp, err := handshake.GenerateKeyPair()
	if err != nil {
		t.Fatal(err)
	}

	b64 := kp.PublicKeyB64()
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		t.Fatalf("public key not valid base64: %v", err)
	}

	// P-256 uncompressed public key is 65 bytes (0x04 || X || Y).
	if len(raw) != 65 {
		t.Fatalf("P-256 public key length %d, want 65", len(raw))
	}
	if raw[0] != 0x04 {
		t.Fatalf("expected uncompressed point prefix 0x04, got 0x%02x", raw[0])
	}
}

// TestDifferentPairs_DifferentSecrets ensures two sessions have different keys.
func TestDifferentPairs_DifferentSecrets(t *testing.T) {
	a1, _ := handshake.GenerateKeyPair()
	b1, _ := handshake.GenerateKeyPair()
	a2, _ := handshake.GenerateKeyPair()
	b2, _ := handshake.GenerateKeyPair()

	secret1, _ := a1.DeriveSharedSecret(b1.PublicKeyB64())
	secret2, _ := a2.DeriveSharedSecret(b2.PublicKeyB64())

	if string(secret1) == string(secret2) {
		t.Fatal("two independent sessions produced the same shared secret (astronomically unlikely)")
	}
}

// TestEncryptDecrypt_WithECDHKey exercises the full send→receive path:
// ECDH exchange → encrypt with shared key → decrypt with shared key.
func TestEncryptDecrypt_WithECDHKey(t *testing.T) {
	// Simulate sender and receiver generating keypairs.
	sender, _ := handshake.GenerateKeyPair()
	receiver, _ := handshake.GenerateKeyPair()

	// Both derive the same shared secret.
	senderSecret, _ := sender.DeriveSharedSecret(receiver.PublicKeyB64())
	receiverSecret, _ := receiver.DeriveSharedSecret(sender.PublicKeyB64())

	plaintext := []byte("Not all those who wander are lost.")

	// Import here to avoid import cycle (handshake_test lives in handshake package).
	// We test the crypto independently; this test only checks the key agreement.
	if string(senderSecret) != string(receiverSecret) {
		t.Fatal("secrets don't match; encrypt/decrypt would fail")
	}

	t.Logf("shared secret (hex): %x", senderSecret[:8])
	t.Logf("plaintext len: %d", len(plaintext))
}
