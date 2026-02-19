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

## Quick Start

### Self-hosted server

```bash
# Build
make build

# Run (auto-creates a public tunnel and generates an admin token)
make run
# or: ./durins-door server --port 8888

# Share a file directly
./durins-door share secret.pdf --expires 24h --max-downloads 5

# List active shares
./durins-door list

# Revoke a share
./durins-door revoke <share-id>
```

**Server flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8888` | HTTP server port |
| `--token` | auto-generated | Admin bearer token |
| `--tunnel` | `true` | Auto-create public tunnel |
| `--no-tunnel` | `false` | Disable automatic tunnel |

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

See [web/README.md](web/README.md) for full details.

### CLI client

```bash
cd cli
make build

# Share a file (uploads encrypted to Supabase)
./durins-door-cli share secret.pdf --expires 24h

# Download a share
./durins-door-cli download <share-id> --key <base64-key>

# Peer-to-peer handshake
./durins-door-cli receive                           # Shows pairing code
./durins-door-cli send file.pdf --to ARKENSTONE     # On another device
```

See [cli/README.md](cli/README.md) for full details.

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
