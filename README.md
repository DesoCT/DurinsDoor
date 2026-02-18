# 🚪 Durin's Door

> *"Speak, friend, and enter — then download."*

**Durin's Door** is a command-line tool for encrypted, temporary file sharing. Files are encrypted with AES-256-GCM before touching disk; download links expire automatically; no accounts, no tracking — the door simply closes when the time comes.

---

## Features

- 🔐 **AES-256-GCM encryption** — files are encrypted at rest with a random key; decrypted on-the-fly at download time
- ⏱ **Auto-expiring links** — set any duration; the share vanishes when time runs out
- 🔑 **Optional password protection** — bcrypt-hashed passwords guard individual shares
- ⬇ **Download limits** — optionally cap how many times a file can be downloaded
- 🌍 **Public URL support** — works with ngrok or cloudflared for easy public sharing
- 🛡 **Admin dashboard** — browser UI to list and revoke active shares
- 🗄 **SQLite backend** — zero-dependency storage in `~/.durins-door/shares.db`
- 🎨 **Tolkien-themed UI** — dark stone arch, glowing runes, twinkling stars

---

## Installation

### From source

```bash
git clone https://github.com/unisoniq/durins-door.git
cd durins-door
make install          # installs to /usr/local/bin/durins-door
```

### Manual build

```bash
go build -o durins-door .
sudo mv durins-door /usr/local/bin/
```

**Requirements:** Go 1.22+

---

## Quick Start

```bash
# Share a file (starts a local server, auto-expires in 1 hour)
durins-door share photo.jpg

# Share with a 24-hour expiry and a password
durins-door share secret.pdf --expires 24h --password "mellon"

# Share with a download limit
durins-door share archive.zip --max-downloads 3 --expires 12h

# Make it public with ngrok
ngrok http 8888        # in another terminal
```

When you run `durins-door share`, the CLI prints a download URL like:

```
╔═══════════════════════════════════╗
║       🚪  DURIN'S DOOR  🚪        ║
║   Speak, friend, and download.    ║
╚═══════════════════════════════════╝

  📁 File:        photo.jpg (3.2 MB)
  ⏱  Expires:     1h0m0s
  🔑 Password:    set

  🔗 Share URL:   http://localhost:8888/d/a3f9...
  🛡  Admin URL:   http://localhost:8888/admin?token=...

  Press Ctrl+C to stop the server and revoke the share.
```

Share the URL. When the recipient visits it, they see a beautiful Tolkien-themed download page. When you press `Ctrl+C`, the server stops and the encrypted file is deleted.

---

## Commands

### `durins-door share <file>`

Encrypts a file and starts a temporary local HTTP server.

```
Flags:
  --expires     duration   Expiry duration (default: 1h). Examples: 30m, 24h, 7d
  --password    string     Require a password to download
  --max-downloads int      Cap the number of downloads (default: unlimited)
  --port        int        HTTP server port (default: auto, starting at 8888)
  --key         string     Custom encryption passphrase (default: random 256-bit key)
```

**Examples:**

```bash
# Default: 1 hour, no password, unlimited downloads
durins-door share report.pdf

# 48-hour link with a password
durins-door share contract.docx --expires 48h --password "speak-friend"

# One-time download link (self-destructs after first download)
durins-door share confidential.zip --max-downloads 1

# Custom port
durins-door share video.mp4 --port 9000 --expires 6h

# Persistent encryption key (reproducible — same key each time for same passphrase)
durins-door share myfile.tar.gz --key "my-secret-passphrase"
```

---

### `durins-door server`

Starts the Durin's Door HTTP server standalone, serving all existing shares from `~/.durins-door/`.

```
Flags:
  --port    int     HTTP server port (default: 8888)
  --token   string  Admin bearer token (auto-generated if empty)
```

**Example:**

```bash
# Start server on port 8080 with a known admin token
durins-door server --port 8080 --token my-admin-secret

# Then visit http://localhost:8080/admin?token=my-admin-secret
```

---

### `durins-door list`

Lists all shares (active, expired, and exhausted) in the local store.

```bash
durins-door list
```

Output:

```
ID                  FILE              SIZE      DOWNLOADS  EXPIRES               STATUS
──────────────────  ────────────────  ────────  ─────────  ────────────────────  ──────
a3f9b2c1d4e5f6a7    photo.jpg         3.2 MB    0          18 Feb 26 17:00       ✅ active
8b2e4f1c9a7d3e5f    archive.zip       45.1 MB   2 / 3      18 Feb 26 15:30       ✅ active
1c4e8a2f6b9d3e7c    old-report.pdf    1.1 MB    1          18 Feb 26 10:00       ⏰ expired
```

---

### `durins-door revoke <id>`

Revokes a share and deletes its encrypted file. Accepts a full ID or an unambiguous prefix.

```bash
# Full ID
durins-door revoke a3f9b2c1d4e5f6a78b2e4f1c9a7d3e5f

# Short prefix (as long as it's unambiguous)
durins-door revoke a3f9
```

---

## Admin Dashboard

The admin dashboard is accessible at `/admin?token=<token>` (or via `Authorization: Bearer <token>` header).

It shows all shares with their status, download counts, expiry times, and a **Revoke** button for each. Revoking a share immediately deletes the encrypted file from disk.

---

## Public URL Sharing

Durin's Door works with any HTTP tunnel tool:

```bash
# ngrok
ngrok http 8888

# cloudflared
cloudflared tunnel --url http://localhost:8888
```

The CLI auto-detects installed tunnel tools and prints instructions.

---

## How Encryption Works

1. **Key generation** — a random 256-bit key is generated (or derived from a passphrase via SHA-256).
2. **Streaming encryption** — the file is encrypted in 64 KB chunks using AES-256-GCM with per-chunk nonces derived from a file-level nonce + counter.
3. **At-rest storage** — the encrypted file is stored in `~/.durins-door/files/<id>.enc`. The plaintext never touches disk.
4. **Streaming decryption** — at download time, the encrypted file is read from disk and decrypted chunk-by-chunk into the HTTP response body. No temporary plaintext file is written.
5. **Cleanup** — when a share expires or is revoked, the encrypted file is deleted.

---

## Data Directory

All data is stored in `~/.durins-door/`:

```
~/.durins-door/
├── shares.db         # SQLite database with share metadata
└── files/
    ├── abc123....enc  # Encrypted file for share abc123...
    └── def456....enc  # Encrypted file for share def456...
```

To fully wipe all shares:

```bash
rm -rf ~/.durins-door
```

---

## API

The server exposes a JSON API for programmatic access:

```bash
# List all shares (requires admin token)
curl -H "Authorization: Bearer <token>" http://localhost:8888/api/shares

# Revoke a share
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:8888/admin/revoke/<id>
```

---

## Building

```bash
# Build binary
make

# Install to /usr/local/bin
make install

# Clean build artifacts
make clean
```

---

## License

MIT
# DurinsDoor
