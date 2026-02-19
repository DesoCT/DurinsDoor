# Durin's Door — Web

The browser-based frontend for Durin's Door. A Next.js app that provides zero-knowledge encrypted file sharing with a Tolkien-themed UI. All encryption and decryption happens client-side using the Web Crypto API — the server never sees plaintext.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (see [root README](../README.md#supabase-setup) for setup)

### Install and run

```bash
npm install

# Configure environment
cp .env.local.example .env.local
# Fill in your Supabase credentials:
#   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
#   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

npm run dev      # Dev server at http://localhost:3000
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Features

### File sharing
- Drag-and-drop or click-to-upload (click the door itself)
- AES-256-GCM encryption via Web Crypto API
- Encryption key embedded in URL fragment (`#key=...`), never sent to the server
- Configurable expiry (1 hour to 30 days, or never)
- Download limits (1, 5, 10, or unlimited)
- Optional password protection (bcrypt)
- Real-time download counter

### Handshake mode (P2P)
- ECDH P-256 key exchange through Supabase Realtime
- 6-character pairing codes for device linking
- 3-word Tolkien verification phrases for MITM detection
- Available at `/handshake/send` and `/handshake/receive`

### Authentication
- Supabase Auth integration
- Login/signup at `/login`
- Gallery of your shares at `/gallery`

### Tolkien UI
- Stone-carved door SVG with interactive hover states
- Glowing Elder Futhark runes
- Animated starfield background
- Mountain silhouette horizon
- Cinzel serif typography
- 6 hidden easter eggs (Konami code, "mellon" trigger, and more)

## Project Structure

```
web/
├── app/
│   ├── page.tsx                  # Home — door UI, upload form, easter eggs
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Tolkien-themed styles (runes, glows, stone)
│   ├── d/[id]/
│   │   ├── page.tsx              # Download page (Server Component — fetches metadata)
│   │   └── DownloadClient.tsx    # Client-side decryption and download
│   ├── handshake/
│   │   ├── send/page.tsx         # Handshake sender
│   │   └── receive/page.tsx      # Handshake receiver
│   ├── login/page.tsx            # Authentication
│   └── gallery/page.tsx          # View all your shares
├── lib/
│   ├── crypto.ts                 # AES-256-GCM encrypt/decrypt, file hashing
│   ├── ecdh.ts                   # P-256 ECDH key exchange utilities
│   └── supabase/
│       ├── client.ts             # Browser Supabase client
│       └── server.ts             # Server-side Supabase client (SSR)
├── .env.local.example            # Environment variable template
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## How Encryption Works

1. User selects a file via drag-and-drop or file picker
2. A 256-bit AES key is generated with `crypto.getRandomValues()`
3. A 12-byte IV is generated randomly
4. The file is encrypted: `AES-256-GCM(key, iv, plaintext)` → `[iv][ciphertext+tag]`
5. The encrypted blob is uploaded to Supabase Storage
6. Share metadata (filename, size, expiry, password hash) is stored in the `shares` table
7. The share URL is generated: `/d/{share_id}#key={base64url_encoded_key}`
8. On download, the browser fetches the blob, extracts the IV, and decrypts client-side

The key in the URL fragment (`#key=...`) is never sent to the server — this is enforced by the browser's URL specification.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Language:** TypeScript 5
- **Crypto:** Web Crypto API (native browser)
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **SSR:** `@supabase/ssr` for server-side rendering with auth
- **Deployment:** Vercel (recommended)

## Deployment

The app is designed for Vercel deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY
```

Or deploy to any platform that supports Next.js (Netlify, Railway, Docker, etc.).
