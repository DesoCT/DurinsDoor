# 🚪 Durin's Door

*Speak, friend, and enter.*

Zero-knowledge encrypted file sharing with a Tolkien-themed UI. Files are encrypted client-side — the server never sees your plaintext.

## Architecture

```
durins-door/
├── /              # Go server — standalone encrypted file sharing
├── cli/           # Go CLI — client for the web service (Supabase backend)
├── web/           # Next.js frontend — browser-based encrypt/decrypt
└── supabase/      # Shared database migrations
```

### Three ways to share

| Method | Encryption | Storage | Best for |
|--------|-----------|---------|----------|
| **Server** (root) | AES-256-GCM, server-side | Local SQLite + filesystem | Self-hosted, air-gapped, ephemeral |
| **Web** (`/web`) | AES-256-GCM, browser Web Crypto API | Supabase Storage | Public sharing, zero-knowledge |
| **CLI** (`/cli`) | AES-256-GCM, local | Supabase Storage | Terminal users, scripting, CI/CD |

Web and CLI share the same Supabase backend and crypto format — fully interoperable.

## Features

- 🔐 **Zero-knowledge** — encryption key lives in the URL fragment (`#key=...`), never sent to the server
- 🤝 **Handshake mode** — ECDH key exchange with Tolkien-word verification phrases
- 🏔️ **Tolkien UI** — stone-carved door, glowing runes, 6 hidden easter eggs
- ⏱️ **Expiring shares** — auto-delete after time or download count
- 🔑 **Password protection** — optional additional layer
- 📱 **Cross-platform** — browser, CLI, or self-hosted server

## Quick Start

### Self-hosted server
```bash
go build -o durins-door .
./durins-door server --port 8888
# Cloudflare tunnel auto-created for public access
```

### Web app (Vercel)
```bash
cd web
npm install
# Add Supabase credentials to .env.local
npm run dev
```

### CLI client
```bash
cd cli
go build -o durins-door-cli .

# Share a file
./durins-door-cli share secret.pdf --expires 24h

# Handshake (peer-to-peer)
./durins-door-cli receive              # → shows pairing code
./durins-door-cli send file.pdf --to ARKENSTONE  # on other device
```

## Supabase Setup

1. Create a Supabase project
2. Run migrations in order: `supabase/migrations/001_shares.sql`, `002_handshakes.sql`
3. Create a storage bucket called `encrypted-files` (public read)
4. Copy `.env.local.example` → `.env.local` and fill in credentials

## Easter Eggs 🥚

There are 6 hidden LOTR easter eggs on the home page. Can you find them all?

## License

MIT
