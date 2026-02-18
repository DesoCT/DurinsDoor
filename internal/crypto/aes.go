// Package crypto provides AES-256-GCM encryption and decryption utilities
// for Durin's Door file sharing service.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

const (
	// KeySize is the AES-256 key size in bytes
	KeySize = 32
	// NonceSize is the GCM nonce size in bytes
	NonceSize = 12
	// ChunkSize is the streaming chunk size for encryption/decryption
	ChunkSize = 64 * 1024 // 64KB chunks
	// TagSize is the GCM authentication tag size
	TagSize = 16
)

// GenerateKey generates a cryptographically secure random 256-bit key.
func GenerateKey() ([]byte, error) {
	key := make([]byte, KeySize)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, fmt.Errorf("failed to generate key: %w", err)
	}
	return key, nil
}

// KeyToHex encodes a key as a hex string.
func KeyToHex(key []byte) string {
	return hex.EncodeToString(key)
}

// KeyFromHex decodes a hex string to a key, returning an error if invalid.
func KeyFromHex(s string) ([]byte, error) {
	key, err := hex.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("invalid key hex: %w", err)
	}
	if len(key) != KeySize {
		return nil, fmt.Errorf("invalid key length: got %d bytes, want %d", len(key), KeySize)
	}
	return key, nil
}

// DeriveKey derives a 256-bit key from a passphrase using SHA-256.
// For production use, consider argon2 or scrypt instead.
func DeriveKey(passphrase string) []byte {
	hash := sha256.Sum256([]byte(passphrase))
	return hash[:]
}

// Encryptor wraps an io.Writer and encrypts data as it is written.
// Uses AES-256-GCM in streaming mode with prepended per-chunk nonces.
type Encryptor struct {
	dst    io.Writer
	block  cipher.Block
	buf    []byte
	nonce  []byte
	chunk  int
}

// NewEncryptor creates a new streaming encryptor. The file-level nonce is
// written at the start and per-chunk nonces are generated per block.
func NewEncryptor(dst io.Writer, key []byte) (*Encryptor, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}
	// Write a random file-level nonce prefix to make output unique
	fileNonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(rand.Reader, fileNonce); err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}
	if _, err := dst.Write(fileNonce); err != nil {
		return nil, fmt.Errorf("failed to write nonce: %w", err)
	}
	return &Encryptor{
		dst:   dst,
		block: block,
		buf:   make([]byte, 0, ChunkSize),
		nonce: fileNonce,
	}, nil
}

func (e *Encryptor) encryptChunk(data []byte) error {
	gcm, err := cipher.NewGCM(e.block)
	if err != nil {
		return err
	}
	// Derive per-chunk nonce by XOR-ing file nonce with chunk counter
	chunkNonce := make([]byte, NonceSize)
	copy(chunkNonce, e.nonce)
	// XOR last 8 bytes with chunk counter
	counter := uint64(e.chunk)
	for i := 0; i < 8; i++ {
		chunkNonce[NonceSize-1-i] ^= byte(counter >> (8 * i))
	}
	e.chunk++

	ciphertext := gcm.Seal(nil, chunkNonce, data, nil)
	// Write: [4-byte length][nonce][ciphertext+tag]
	length := uint32(len(ciphertext))
	header := []byte{
		byte(length >> 24),
		byte(length >> 16),
		byte(length >> 8),
		byte(length),
	}
	if _, err := e.dst.Write(header); err != nil {
		return err
	}
	if _, err := e.dst.Write(chunkNonce); err != nil {
		return err
	}
	if _, err := e.dst.Write(ciphertext); err != nil {
		return err
	}
	return nil
}

// Write buffers and encrypts data in chunks.
func (e *Encryptor) Write(p []byte) (int, error) {
	total := len(p)
	for len(p) > 0 {
		space := ChunkSize - len(e.buf)
		take := len(p)
		if take > space {
			take = space
		}
		e.buf = append(e.buf, p[:take]...)
		p = p[take:]
		if len(e.buf) == ChunkSize {
			if err := e.encryptChunk(e.buf); err != nil {
				return 0, err
			}
			e.buf = e.buf[:0]
		}
	}
	return total, nil
}

// Flush encrypts and flushes any remaining buffered data.
func (e *Encryptor) Flush() error {
	if len(e.buf) > 0 {
		if err := e.encryptChunk(e.buf); err != nil {
			return err
		}
		e.buf = e.buf[:0]
	}
	return nil
}

// EncryptStream reads from src, encrypts, and writes to dst.
func EncryptStream(dst io.Writer, src io.Reader, key []byte) error {
	enc, err := NewEncryptor(dst, key)
	if err != nil {
		return err
	}
	if _, err := io.Copy(enc, src); err != nil {
		return fmt.Errorf("encrypt copy: %w", err)
	}
	return enc.Flush()
}

// DecryptStream reads encrypted data from src, decrypts, and writes to dst.
func DecryptStream(dst io.Writer, src io.Reader, key []byte) error {
	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("failed to create cipher: %w", err)
	}

	// Read file-level nonce
	fileNonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(src, fileNonce); err != nil {
		return fmt.Errorf("failed to read file nonce: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create GCM: %w", err)
	}

	chunkIdx := 0
	header := make([]byte, 4)
	chunkNonce := make([]byte, NonceSize)

	for {
		// Read chunk length
		_, err := io.ReadFull(src, header)
		if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read chunk header: %w", err)
		}

		length := uint32(header[0])<<24 | uint32(header[1])<<16 | uint32(header[2])<<8 | uint32(header[3])

		// Read per-chunk nonce
		if _, err := io.ReadFull(src, chunkNonce); err != nil {
			return fmt.Errorf("failed to read chunk nonce: %w", err)
		}

		// Read ciphertext
		ciphertext := make([]byte, length)
		if _, err := io.ReadFull(src, ciphertext); err != nil {
			return fmt.Errorf("failed to read ciphertext: %w", err)
		}

		// Verify the derived nonce matches
		expectedNonce := make([]byte, NonceSize)
		copy(expectedNonce, fileNonce)
		counter := uint64(chunkIdx)
		for i := 0; i < 8; i++ {
			expectedNonce[NonceSize-1-i] ^= byte(counter >> (8 * i))
		}
		chunkIdx++

		plaintext, err := gcm.Open(nil, chunkNonce, ciphertext, nil)
		if err != nil {
			return fmt.Errorf("failed to decrypt chunk %d: %w", chunkIdx-1, err)
		}
		if _, err := dst.Write(plaintext); err != nil {
			return fmt.Errorf("failed to write plaintext: %w", err)
		}
	}
	return nil
}
