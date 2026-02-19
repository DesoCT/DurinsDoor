# Durin's Door

*Speak, friend, and enter.*

Zero-knowledge encrypted file sharing with a Tolkien-themed UI. Files are encrypted client-side using AES-256-GCM — the server never sees your plaintext. Keys are carried in the URL fragment (`#key=...`), which browsers never send over the network.

## Architecture

```
durins-door/
├── /              # Go server — standalone self-hosted encrypted file sharing
├── cli/           # Go CLI — terminal client backed by Supabase
├── web/           # Next.js frontend — browser-based zero-knowledge sharing
├── internal/      # Shared Go packages (server, crypto, tunnel, share store)
├── cmd/           # Cobra CLI commands for the Go server
└── supabase/      # PostgreSQL migrations for the Supabase backend
```

### Three ways to share

| Method | Encryption | Storage | Best for |
|--------|-----------|---------|----------|
| **Server** (root) | AES-256-GCM, streaming | Local SQLite + filesystem | Self-hosted, air-gapped, ephemeral |
| **Web** (`/web`) | AES-256-GCM, Web Crypto API | Supabase Storage | Public sharing, zero-knowledge |
| **CLI** (`/cli`) | AES-256-GCM + ECDH P-256 | Supabase Storage | Terminal users, scripting, P2P handshake |

The web app and CLI share the same Supabase backend and are fully interoperable — a file shared from the CLI can be downloaded in the browser and vice versa.

## Features

- **Zero-knowledge encryption** — AES-256-GCM with keys embedded in the URL fragment, never sent to any server
- **Handshake mode** — peer-to-peer ECDH P-256 key exchange with Tolkien-word verification phrases for MITM detection
- **Expiring shares** — auto-delete after a time limit (1h, 24h, 7d, 30d) or download count (1, 5, 10)
- **Password protection** — optional bcrypt-hashed password as an additional layer
- **Tolkien UI** — stone-carved door, glowing Elder Futhark runes, animated starfield, mountain silhouettes, 6 hidden easter eggs
- **Auto tunneling** — self-hosted server auto-creates Cloudflare or ngrok tunnels for instant public access
- **Admin panel** — token-protected dashboard to manage and revoke shares
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

### Quick install (wget)

```bash
# Linux (x86_64)
wget -qO durins-door https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-amd64
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# Linux (ARM64)
wget -qO durins-door https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-arm64
chmod +x durins-door && sudo mv durins-door /usr/local/bin/
```

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-windows-amd64.exe -OutFile durins-door.exe
```

### GitHub CLI

```bash
gh release download --repo DesoCT/DurinsDoor -p "durins-door-linux-amd64"
```

### Build from source

```bash
go install github.com/unisoniq/durins-door@latest
```

Or browse all binaries at [GitHub Releases](https://github.com/DesoCT/DurinsDoor/releases).

---

## CLI Reference — Self-hosted Server

The standalone server binary (`durins-door`) encrypts files locally with AES-256-GCM, stores them on disk, and serves them over HTTP with optional Cloudflare/ngrok tunneling.

### `durins-door server`

Start the HTTP server to serve all existing shares.

```bash
durins-door server                    # Default: port 8888, auto-tunnel
durins-door server --port 9000        # Custom port
durins-door server --no-tunnel        # LAN only, no public tunnel
durins-door server --token mysecret   # Set a specific admin token
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8888` | HTTP server port |
| `--token` | auto-generated | Admin bearer token |
| `--tunnel` | `true` | Auto-create Cloudflare/ngrok tunnel |
| `--no-tunnel` | `false` | Disable automatic tunnel |

### `durins-door share <file>`

Encrypt a file and start serving it immediately.

```bash
durins-door share myfile.zip                                    # 1h expiry (default)
durins-door share myfile.zip --expires 24h                      # Expires in 24 hours
durins-door share myfile.zip --expires 24h --max-downloads 3    # 3 downloads max
durins-door share secret.pdf --password "mellon"                # Password-protected
durins-door share secret.pdf --key "my-custom-passphrase"       # Custom encryption key
durins-door share doc.pdf --register-only                       # Encrypt only, don't start server
durins-door share doc.pdf --no-tunnel --port 9000               # LAN only on port 9000
```

| Flag | Default | Description |
|------|---------|-------------|
| `--key` | auto-generated | Custom encryption key passphrase |
| `--expires` | `1h` | Expiry duration (e.g. `1h`, `24h`, `7d`) |
| `--password` | none | Require a password to download |
| `--max-downloads` | `0` (unlimited) | Max number of downloads |
| `--port` | `0` (auto) | HTTP server port |
| `--tunnel` | `true` | Auto-create public tunnel |
| `--no-tunnel` | `false` | Disable tunnel |
| `--register-only` | `false` | Encrypt and register without starting a server |

### `durins-door list`

List all active shares.

```bash
durins-door list
```

Output columns: ID, FILE, SIZE, DOWNLOADS, EXPIRES, STATUS

### `durins-door revoke <share-id>`

Revoke a share and delete its encrypted file. Supports prefix matching.

```bash
durins-door revoke abc123def456       # Full ID
durins-door revoke abc1               # Prefix (if unambiguous)
```

### `durins-door --version`

```bash
durins-door --version                 # e.g. "durins-door v0.1.0 (built 2025-06-01T00:00:00Z)"
```

---

## CLI Reference — Cloud Client (`durins-door-cli`)

The cloud CLI (`cli/`) encrypts locally and uploads ciphertext to Supabase Storage. Zero-knowledge — the server never sees your key or plaintext.

### `durins-door-cli login`

Authenticate with Supabase (stores JWT in `~/.config/durins-door/auth.json`).

```bash
durins-door-cli login
# Email: gandalf@shire.me
# Password: ••••••••
```

### `durins-door-cli logout`

Remove stored authentication token.

```bash
durins-door-cli logout
```

### `durins-door-cli share <file>`

Encrypt and upload a file, returns a share link with the key in the URL fragment.

```bash
durins-door-cli share secret.pdf                                   # Basic share
durins-door-cli share secret.pdf --expires 24h                     # Expires in 24h
durins-door-cli share secret.pdf --expires 7d --max-downloads 5    # 7 days, 5 downloads
durins-door-cli share secret.pdf --password "mellon"               # Password-protected
```

| Flag | Default | Description |
|------|---------|-------------|
| `--password` | none | Password-protect the share |
| `--expires` | none (never) | Expiry duration (`24h`, `7d`, `30d`) |
| `--max-downloads` | `0` (unlimited) | Max download count |
| `--url` | `https://durins-door.vercel.app` | Base URL for the share link |

Output: `https://durins-door.vercel.app/share/<id>#<key>`

### `durins-door-cli download <url>`

Download and decrypt a shared file.

```bash
durins-door-cli download "https://durins-door.vercel.app/share/abc123#keyhere"
durins-door-cli download "https://durins-door.vercel.app/share/abc123#keyhere" -o myfile.pdf
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output` | original filename | Output file path |

### `durins-door-cli list`

List your shares (requires `login`).

```bash
durins-door-cli list
```

Output columns: ID, FILE, SIZE, DOWNLOADS, EXPIRES, CREATED

### `durins-door-cli revoke <id>`

Delete a share you own (requires `login`).

```bash
durins-door-cli revoke abc123def456          # Interactive confirmation
durins-door-cli revoke abc123def456 --force  # Skip confirmation
```

| Flag | Default | Description |
|------|---------|-------------|
| `-f, --force` | `false` | Skip confirmation prompt |

### `durins-door-cli receive`

Wait for a peer to send you a file via ECDH handshake.

```bash
durins-door-cli receive                # Displays a pairing code
durins-door-cli receive -o ~/Downloads # Save to specific directory
```

1. Generates an ECDH P-256 keypair
2. Displays a pairing code (share with the sender out-of-band)
3. Both parties see a 3-word Tolkien verification phrase — speak it aloud to confirm no MITM
4. File is downloaded and decrypted automatically

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output` | `.` (current dir) | Directory to save the received file |

### `durins-door-cli send <file> --to <CODE>`

Send a file to a waiting receiver via ECDH handshake.

```bash
durins-door-cli send file.pdf --to ARKENSTONE
durins-door-cli send file.pdf --to ARKENSTONE --password "extra-secret"
durins-door-cli send file.pdf --to ARKENSTONE --expires 24h --max-downloads 1
```

| Flag | Default | Description |
|------|---------|-------------|
| `--to` | **(required)** | Pairing code from the receiver |
| `--password` | none | Additional password layer on top of ECDH |
| `--expires` | none | Share expiry (`24h`, `7d`) |
| `--max-downloads` | `0` (unlimited) | Max download count |

### Global flags (cloud CLI)

| Flag | Default | Description |
|------|---------|-------------|
| `--supabase-url` | built-in project URL | Supabase project URL |
| `--supabase-key` | built-in anon key | Supabase anon/service key |

---

## Quick Start

### Self-hosted server

```bash
# One-liner: download and run
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-amd64 -o durins-door && chmod +x durins-door
./durins-door server --port 8888

# Share a file directly
./durins-door share secret.pdf --expires 24h --max-downloads 5

# List active shares
./durins-door list

# Revoke a share
./durins-door revoke <share-id>
```

### Web app

```bash
cd web
npm install

# Configure Supabase credentials
cp .env.local.example .env.local
# Edit .env.local with your Supabase project URL and keys

npm run dev      # Development server at localhost:3000
npm run build    # Production build
npm start        # Serve production build
```

### CLI client (cloud)

```bash
cd cli
make build

# Share a file (uploads encrypted to Supabase)
./durins-door-cli share secret.pdf --expires 24h

# Download a share
./durins-door-cli download "https://durins-door.vercel.app/share/abc123#keyhere"

# Peer-to-peer handshake
./durins-door-cli receive                           # Shows pairing code
./durins-door-cli send file.pdf --to ARKENSTONE     # On another device
```

## Supabase Setup

1. Create a [Supabase](https://supabase.com) project
2. Run the migrations in order:
   ```bash
   # In the Supabase SQL editor or via the CLI
   supabase/migrations/001_shares.sql
   supabase/migrations/002_handshakes.sql
   ```
3. Create a storage bucket called `encrypted-files` with public read access
4. Copy `web/.env.local.example` to `web/.env.local` and fill in your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

## How Encryption Works

### Standard sharing

1. A random 256-bit AES key is generated client-side
2. The file is encrypted with AES-256-GCM (authenticated encryption)
3. The encrypted blob is uploaded to storage (Supabase or local filesystem)
4. The key is placed in the URL fragment: `https://example.com/d/{id}#key={base64url}`
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
- **bcrypt** — password hashing (cost 12)
- **Row-level security** — Supabase RLS policies restrict data access
- **Rate limiting** — public endpoints are rate-limited on the self-hosted server
- **Automatic expiry** — expired shares are cleaned up automatically

## Makefile Targets

```
make build      # Compile the durins-door binary
make run        # Build and run the server on port 8888
make test       # Run unit tests with race detection
make install    # Install to /usr/local/bin
make uninstall  # Remove installed binary
make fmt        # Format Go source files
make vet        # Run static analysis
make tidy       # go mod tidy
make clean      # Remove build artifacts
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Server | Go 1.24, `net/http`, Cobra, SQLite |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| CLI | Go 1.24, Cobra |
| Crypto | AES-256-GCM, ECDH P-256, bcrypt, Web Crypto API |
| Database | SQLite (self-hosted), PostgreSQL via Supabase |
| Storage | Local filesystem (self-hosted), Supabase Storage |
| Tunneling | Cloudflare Tunnel, ngrok |
| Deployment | Vercel (web), any server (Go binary) |

## Easter Eggs

There are 6 hidden Lord of the Rings easter eggs on the home page. Can you find them all?

## License

MIT
