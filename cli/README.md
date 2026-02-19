# Durin's Door — CLI

A command-line client for Durin's Door encrypted file sharing. Encrypts files locally with AES-256-GCM and uploads them to the Supabase backend. Supports direct sharing and peer-to-peer handshake mode with ECDH key exchange.

Interoperable with the [web app](../web/) — files shared from the CLI can be downloaded in the browser and vice versa.

## Getting Started

### Prerequisites

- Go 1.24+
- A Supabase project (see [root README](../README.md#supabase-setup) for setup)

### Build

```bash
make build
# Produces: ./durins-door-cli
```

### Login

```bash
./durins-door-cli login
# Enter your Supabase email and password
```

Credentials are stored locally for subsequent commands.

## Usage

### Share a file

```bash
# Basic share (24h expiry)
./durins-door-cli share document.pdf --expires 24h

# With password protection
./durins-door-cli share document.pdf --password "mellon"

# With download limit
./durins-door-cli share document.pdf --max-downloads 5

# Combined
./durins-door-cli share document.pdf --expires 7d --max-downloads 10 --password "friend"
```

The command outputs a share URL with the decryption key in the fragment:
```
https://durins-door.vercel.app/d/abc123#key=base64encodedkey
```

### Download a share

```bash
./durins-door-cli download <share-id> --key <base64-key>
```

### Handshake mode (P2P)

Handshake mode uses ECDH P-256 key exchange for peer-to-peer encrypted transfers. Both parties derive the same shared secret without it ever crossing the network.

**On the receiving device:**
```bash
./durins-door-cli receive
# Outputs a 6-character pairing code, e.g.: ARKENSTONE
# Waits for the sender to connect...
```

**On the sending device:**
```bash
./durins-door-cli send secret.pdf --to ARKENSTONE
```

**Both devices** will display a 3-word Tolkien verification phrase (e.g., `mithril shire gondor`). Confirm verbally that the phrases match — if they don't, the connection may have been intercepted.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--expires` | Expiry duration (`1h`, `24h`, `7d`, `30d`) | `24h` |
| `--max-downloads` | Maximum download count | unlimited |
| `--password` | Password-protect the share | none |
| `--to` | Pairing code for handshake send | — |

## How It Works

### Standard sharing
1. Generates a random 256-bit AES key
2. Encrypts the file with AES-256-GCM
3. Uploads the encrypted blob to Supabase Storage
4. Creates a share record in the database (metadata only — no key)
5. Returns a URL with the key in the fragment

### Handshake mode
1. Receiver generates an ECDH P-256 keypair, publishes the public key with a pairing code
2. Sender looks up the receiver's public key by code
3. Sender generates their own ECDH keypair and derives a shared secret via ECDH
4. Sender publishes their public key; receiver derives the same shared secret
5. Both compute a verification phrase: `SHA-256(shared_secret)` → 3 Tolkien word indices
6. After verbal confirmation, sender encrypts with the shared secret and uploads
7. Receiver downloads and decrypts with the same key

## Project Structure

```
cli/
├── main.go                        # Entry point
├── cmd/
│   ├── root.go                    # Cobra root command
│   ├── share.go                   # Share file command
│   ├── download.go                # Download share command
│   ├── send.go                    # Handshake send command
│   ├── receive.go                 # Handshake receive command
│   └── login.go                   # Authentication command
├── internal/
│   ├── crypto/crypto.go           # AES-256-GCM encrypt/decrypt
│   ├── handshake/handshake.go     # ECDH P-256 key derivation
│   ├── supabase/client.go         # Supabase REST API wrapper
│   └── wordlist/wordlist.go       # Tolkien word list for verification
├── Makefile                       # Build targets
├── go.mod                         # Go module definition
└── go.sum                         # Dependency checksums
```

## Makefile Targets

```
make build      # Build for current platform
make test       # Run unit tests
make release    # Cross-compile for linux/amd64, darwin/amd64, darwin/arm64, windows/amd64
make install    # Install to $GOPATH/bin
make clean      # Remove build artifacts
make tidy       # go mod tidy
```

## Cross-compilation

Build release binaries for all supported platforms:

```bash
make release
# Outputs:
#   dist/durins-door-cli-linux-amd64
#   dist/durins-door-cli-darwin-amd64
#   dist/durins-door-cli-darwin-arm64
#   dist/durins-door-cli-windows-amd64.exe
```

## Tech Stack

- **Language:** Go 1.24
- **CLI Framework:** [Cobra](https://github.com/spf13/cobra)
- **Crypto:** `crypto/aes`, `crypto/ecdh` (P-256), `golang.org/x/crypto` (bcrypt)
- **Backend:** Supabase (PostgreSQL + Storage)
