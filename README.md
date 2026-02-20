# Durin's Door

*Speak, friend, and enter.*

Zero-knowledge encrypted file sharing with a Tolkien-themed UI. Files are encrypted client-side using AES-256-GCM — the server never sees your plaintext. Keys are carried in the URL fragment (`#key=...`), which browsers never send over the network.

## Architecture

```
durins-door/
├── /              # Go binary — CLI client + optional self-hosted server
├── web/           # Next.js frontend — browser-based zero-knowledge sharing
├── internal/      # Shared Go packages (server, crypto, tunnel, share store)
├── cmd/           # Cobra CLI commands (server, share, download, upload, send, receive)
└── supabase/      # PostgreSQL migrations for the Supabase backend
```

### Two ways to use

| Method | How | Best for |
|--------|-----|----------|
| **Web** (durinsdoor.io) | Browser — drag & drop, handshake mode | Anyone, zero setup |
| **CLI** (`durins-door`) | Single binary, talks to durinsdoor.io by default | Terminal users, scripting, automation |

The CLI and web app share the same backend and are fully interoperable — a file sent from the CLI can be received in the browser and vice versa. You can also self-host the server if you prefer.

## Features

- **Zero-knowledge encryption** — AES-256-GCM with keys embedded in the URL fragment, never sent to any server
- **Handshake mode** — peer-to-peer ECDH P-256 key exchange with Tolkien-word verification phrases for MITM detection
- **Expiring shares** — auto-delete after a time limit (1h, 24h, 7d, 30d) or download count (1, 5, 10)
- **Password protection** — optional password as an additional layer
- **Tolkien UI** — stone-carved door, glowing Elder Futhark runes, animated starfield, mountain silhouettes, 6 hidden easter eggs
- **Auto tunneling** — self-hosted server auto-creates Cloudflare or ngrok tunnels for instant public access
- **Cross-platform** — works in the browser, terminal, or as a standalone server

## Install

### Quick install (curl)

```bash
# Linux (x86_64)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-amd64 -o durins-door
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# Linux (ARM64)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-arm64 -o durins-door
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# macOS (Apple Silicon)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-darwin-arm64 -o durins-door
chmod +x durins-door && mv durins-door /usr/local/bin/

# macOS (Intel)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-darwin-amd64 -o durins-door
chmod +x durins-door && mv durins-door /usr/local/bin/
```

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-windows-amd64.exe -OutFile durins-door.exe
```

### Build from source

```bash
go install github.com/unisoniq/durins-door@latest
```

Or browse all binaries at [GitHub Releases](https://github.com/DesoCT/DurinsDoor/releases).

---

## Quick Start

```bash
# Send a file to someone (they open Handshake > Receive on durinsdoor.io)
durins-door send file.pdf --to HXMP3K

# Receive a file (displays a pairing code for the sender)
durins-door receive

# Upload a file and get a share link
durins-door upload secret.pdf --expires 24h

# List active shares
durins-door list

# Revoke a share
durins-door revoke <share-id>
```

The CLI connects to **https://durinsdoor.io** by default. No server setup needed.

---

## CLI Reference

### `durins-door send <file> --to <CODE>`

Send a file to a waiting receiver via ECDH handshake.

```bash
durins-door send file.pdf --to HXMP3K
durins-door send file.pdf --to HXMP3K --password "extra-secret"
durins-door send file.pdf --to HXMP3K --expires 24h --max-downloads 1
```

| Flag | Default | Description |
|------|---------|-------------|
| `--to` | **(required)** | Pairing code from the receiver |
| `--password` | none | Additional password layer on top of ECDH |
| `--expires` | none | Share expiry (`24h`, `7d`) |
| `--max-downloads` | `0` (unlimited) | Max download count |

### `durins-door receive`

Wait for a peer to send you a file via ECDH handshake.

```bash
durins-door receive
durins-door receive -o ~/Downloads
```

1. Generates an ECDH P-256 keypair
2. Publishes a pairing code (e.g. `HXMP3K`)
3. Both parties see a 3-word verification phrase — speak it aloud to confirm no MITM
4. File is downloaded and decrypted automatically

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output` | `.` (current dir) | Directory to save the received file |

### `durins-door upload <file>`

Upload a file to the server.

```bash
durins-door upload secret.pdf
durins-door upload archive.zip --password "mellon" --expires 24h --max-downloads 5
```

| Flag | Default | Description |
|------|---------|-------------|
| `--password` | none | Password-protect the share |
| `--expires` | none | Expiry duration (`24h`, `7d`, `30d`) |
| `--max-downloads` | `0` (unlimited) | Max download count |

### `durins-door download <url>`

Download and decrypt a shared file.

```bash
durins-door download "https://durinsdoor.io/d/abc123#base64key"
durins-door download "https://durinsdoor.io/d/abc123#base64key" -o myfile.pdf
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output` | original filename | Output file path |

### `durins-door list`

List all active shares.

```bash
durins-door list
```

### `durins-door revoke <share-id>`

Revoke a share and delete its encrypted file.

```bash
durins-door revoke abc123def456
durins-door revoke abc1               # Prefix match
```

### Global flags

| Flag | Default | Description |
|------|---------|-------------|
| `--server-url` | `https://durinsdoor.io` | Server URL (override for self-hosted) |
| `--api-token` | none | Bearer token (also via `DURINS_DOOR_TOKEN` env var) |
| `--version` | | Print version and build date |

---

## Self-hosted Server

You can also run your own server — all data stays on your machine.

### `durins-door server`

```bash
durins-door server                    # Default: port 8888, auto-tunnel
durins-door server --port 9000        # Custom port
durins-door server --no-tunnel        # LAN only
durins-door server --token mysecret   # Set admin token
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8888` | HTTP server port |
| `--token` | auto-generated | Admin bearer token |
| `--tunnel` | `true` | Auto-create Cloudflare/ngrok tunnel |
| `--no-tunnel` | `false` | Disable automatic tunnel |

### `durins-door share <file>`

Encrypt a file and start serving it immediately (self-hosted only).

```bash
durins-door share myfile.zip --expires 24h --max-downloads 3
durins-door share secret.pdf --password "mellon"
```

| Flag | Default | Description |
|------|---------|-------------|
| `--key` | auto-generated | Custom encryption key passphrase |
| `--expires` | `1h` | Expiry duration (e.g. `1h`, `24h`, `7d`) |
| `--password` | none | Require a password to download |
| `--max-downloads` | `0` (unlimited) | Max number of downloads |
| `--port` | `0` (auto) | HTTP server port |
| `--no-tunnel` | `false` | Disable tunnel |
| `--register-only` | `false` | Encrypt and register without starting a server |

Point the CLI at your self-hosted server:

```bash
durins-door send file.pdf --to HXMP3K --server-url http://myserver:8888
durins-door upload secret.pdf --server-url http://myserver:8888 --api-token mytoken
```

---

## Web App Setup

```bash
cd web
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

## Supabase Setup

1. Create a [Supabase](https://supabase.com) project
2. Run the migrations:
   ```bash
   supabase/migrations/001_shares.sql
   supabase/migrations/002_handshakes.sql
   ```
3. Create a storage bucket called `encrypted-files` with public read access
4. Fill in `web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## How Encryption Works

### Standard sharing

1. A random 256-bit AES key is generated client-side
2. The file is encrypted with AES-256-GCM (authenticated encryption)
3. The encrypted blob is uploaded to storage
4. The key is placed in the URL fragment: `https://durinsdoor.io/d/{id}#key={base64url}`
5. The recipient's browser decrypts entirely client-side — the server only ever sees ciphertext

### Handshake mode (P2P)

1. The **receiver** generates an ECDH P-256 keypair and publishes the public key with a 6-character pairing code
2. The **sender** looks up the receiver's public key, generates their own keypair, and derives a shared secret
3. Both parties compute a verification phrase (3 Tolkien words from SHA-256 of the shared secret) and confirm out-of-band
4. The sender encrypts the file with the shared secret and uploads it
5. The receiver decrypts with the same derived key

This prevents man-in-the-middle attacks — if the verification phrases don't match, the exchange has been tampered with.

## Security

- **AES-256-GCM** — authenticated encryption, tamper-evident
- **Zero-knowledge** — server never sees plaintext or encryption keys
- **ECDH P-256** — ephemeral key exchange for handshake mode
- **Row-level security** — Supabase RLS policies restrict data access
- **Rate limiting** — public endpoints are rate-limited
- **Automatic expiry** — expired shares are cleaned up automatically

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Server | Go 1.24, `net/http`, Cobra, SQLite |
| Web | Next.js 16, React 19, TypeScript |
| Crypto | AES-256-GCM, ECDH P-256, Web Crypto API |
| Database | SQLite (self-hosted), PostgreSQL via Supabase |
| Storage | Local filesystem (self-hosted), Supabase Storage |
| Tunneling | Cloudflare Tunnel, ngrok |
| Deployment | Vercel (web), any server (Go binary) |

## Easter Eggs

There are 6 hidden Lord of the Rings easter eggs on the home page. Can you find them all?

## License

MIT
