import Link from 'next/link'
import GuideAnimations from '@/components/GuideAnimations'

export default function GuidePage() {
  return (
    <>
      <GuideAnimations />
      <div className="mist-layer" />
      <div className="guide-wrapper">
        <nav className="guide-nav">
          <Link href="/" className="guide-back">← Durin&apos;s Door</Link>
          <Link href="/gallery" className="guide-back">The Vaults →</Link>
        </nav>

        <article className="manuscript fade-in-up">
          <div className="ms-border-top" />

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <svg width="48" height="60" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 1.2rem', opacity: 0.8 }} aria-hidden="true">
              <defs><filter id="gs3"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
              <path fill="#0d1525" stroke="#2a3a5c" strokeWidth="1" fillRule="evenodd" d="M 0 64 L 0 0 L 48 0 L 48 64 Z M 8 62 L 8 34 Q 7 8 24 4 Q 41 8 40 34 L 40 62 Z"/>
              <path fill="#060910" d="M 8 62 L 8 34 Q 7 8 24 4 Q 41 8 40 34 L 40 62 Z"/>
              <path fill="none" stroke="var(--gold)" strokeWidth="0.8" d="M 8 34 Q 7 8 24 4 Q 41 8 40 34"/>
              <g filter="url(#gs3)" transform="translate(24,30)">
                <line x1="0" y1="-10" x2="0" y2="10" stroke="var(--silver-glow)" strokeWidth="0.9"/>
                <line x1="-10" y1="0" x2="10" y2="0" stroke="var(--silver-glow)" strokeWidth="0.9"/>
                <line x1="-7" y1="-7" x2="7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8"/>
                <line x1="7" y1="-7" x2="-7" y2="7" stroke="var(--silver-glow)" strokeWidth="0.8"/>
                <circle r="2.5" fill="var(--silver-glow)"/>
              </g>
            </svg>
            <h1 className="ms-chapter">The Lore-Book</h1>
            <p className="ms-chapter-sub">A treatise on encrypted passage, swift delivery &amp; the Handshake of Fellowship</p>
            <p style={{ textAlign: 'center', color: 'var(--border-rune)', letterSpacing: '0.35em', fontSize: '0.75rem', opacity: 0.6, marginTop: '0.8rem' }}>
              · · ᛞ ᚢ ᚱ ᛁ ᚾ · ᚠ ᚱᛖᛟᚾᛞ · ᛖᚾᛏᛖᚱ · ·
            </p>
          </div>

          {/* Chapter I */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᚠ</span> What is Durin&apos;s Door?</h2>
            <p className="ms-body">
              <strong>Durin&apos;s Door</strong> is a zero-knowledge encrypted file-sharing web application.
              Like the ancient gate of Moria — it reveals itself only to those who know the word —
              Durin&apos;s Door encrypts your files <em>entirely in your browser</em> before they ever
              reach the server. The key lives only in the URL fragment, which is never sent to the server.
            </p>
            <ul className="ms-list">
              <li data-rune="🔐"><strong>Zero-knowledge encryption</strong> — AES-256-GCM, key stays in the URL fragment (#), never sent to the server</li>
              <li data-rune="⏳"><strong>Auto-expiry</strong> — links vanish after the time you set</li>
              <li data-rune="🔢"><strong>Download limits</strong> — restrict to N downloads and the door seals itself</li>
              <li data-rune="🔑"><strong>Optional password</strong> — adds a verification gate atop the key</li>
              <li data-rune="⇄"><strong>Handshake mode</strong> — peer-to-peer ECDH key exchange, no shared URL needed</li>
              <li data-rune="🚫"><strong>Zero server-side decryption</strong> — the server stores encrypted blobs only</li>
            </ul>
          </section>

          <div className="ms-rune-divider">· · · ᚢ · · ·</div>

          {/* Chapter II — Share */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᚢ</span> How to Share a File</h2>
            <p className="ms-body">
              To place an artifact in the vault, drag a file onto the door — or click it to browse.
              The door will encrypt your file in-browser, upload the ciphertext, and carve a link.
            </p>
            <ol className="ms-steps">
              <li><div className="step-body"><strong>Drag or click</strong> the door on the home page to select your file</div></li>
              <li><div className="step-body"><strong>Set options</strong> — expiry, download limit, optional password</div></li>
              <li><div className="step-body"><strong>Click &ldquo;Send Through the Door&rdquo;</strong> — your browser encrypts with AES-256-GCM before upload</div></li>
              <li><div className="step-body"><strong>Copy the link</strong> — the decryption key is in the <code style={{ fontFamily: 'monospace', color: 'var(--elvish)', fontSize: '0.85em' }}>#fragment</code>, invisible to the server</div></li>
            </ol>
            <div className="shield-box">
              <span className="shield-box-icon">🛡️</span>
              <p className="shield-box-text">
                <strong>The key is NEVER sent to the server.</strong> URL fragments (the <code style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>#key=…</code> part) are a browser-only construct — they don&apos;t appear in server logs, proxies, or CDN records. Share the full URL with your recipient.
              </p>
            </div>
          </section>

          <div className="ms-rune-divider">· · · ᚱ · · ·</div>

          {/* Chapter III — Download */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᚱ</span> How to Download</h2>
            <p className="ms-body">
              The bearer of the link visits the download page. The door presents what
              lies within. If a password was set, the door asks for the word. Speak truly, and it opens.
              <strong> Decryption happens entirely in your browser</strong> — plaintext never touches the server.
            </p>
            <ol className="ms-steps">
              <li><div className="step-body"><strong>Open the link</strong> — the download page shows file details</div></li>
              <li><div className="step-body"><strong>Enter password</strong> (if required) — verified locally against a hash</div></li>
              <li><div className="step-body"><strong>Click &ldquo;Open the Door &amp; Download&rdquo;</strong> — encrypted blob fetched, decrypted in browser, saved to device</div></li>
            </ol>
          </section>

          <div className="ms-rune-divider">· · · ᚨ · · ·</div>

          {/* Chapter IV — Handshake */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᚨ</span> Handshake Mode — Peer-to-Peer Transfer</h2>
            <p className="ms-body">
              <strong>Handshake Mode</strong> enables direct peer-to-peer encrypted transfers without
              sharing a URL. The receiver generates a short pairing code; the sender enters it.
              An ECDH (P-256) key exchange derives a shared secret — the server never sees the key.
            </p>
            <ol className="ms-steps">
              <li><div className="step-body"><strong>Receiver clicks &ldquo;Handshake&rdquo;</strong> → gets a 6-character code (e.g. <span style={{ fontFamily: 'Cinzel, serif', color: 'var(--elvish)' }}>GANDALF</span>)</div></li>
              <li><div className="step-body"><strong>Receiver shares the code</strong> with the sender verbally or via any channel</div></li>
              <li><div className="step-body"><strong>Sender enters the code</strong> on the send page — ECDH keys are exchanged</div></li>
              <li><div className="step-body"><strong>Both see a verification phrase</strong> — 3 Tolkien words derived from the shared secret. Confirm they match!</div></li>
              <li><div className="step-body"><strong>Sender uploads file</strong> — encrypted with the ECDH-derived AES key</div></li>
              <li><div className="step-body"><strong>Receiver auto-downloads</strong> — decrypted in their browser with the same derived key</div></li>
            </ol>
            <div className="shield-box">
              <span className="shield-box-icon">🤝</span>
              <p className="shield-box-text">
                The verification phrase (3 Tolkien words) works like Signal safety numbers — both sides must see <strong>identical words</strong> to confirm the shared secret was derived correctly and no man-in-the-middle is present.
              </p>
            </div>
          </section>

          <div className="ms-rune-divider">· · · ᛊ · · ·</div>

          {/* Chapter V — Security */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᛊ</span> Security &amp; Encryption</h2>
            <div className="shield-box">
              <span className="shield-box-icon">🛡️</span>
              <p className="shield-box-text">
                <strong>AES-256-GCM</strong> authenticated encryption. Each file gets a unique 256-bit key.
                For Handshake mode, <strong>ECDH P-256</strong> derives the shared key — mathematically impossible
                to recover without one party&apos;s private key. Passwords use <strong>SHA-256</strong> for the web version.
              </p>
            </div>
            <ul className="ms-list">
              <li data-rune="🔐"><strong>AES-256-GCM</strong> — authenticated encryption detects tampering</li>
              <li data-rune="🎲"><strong>Unique key per share</strong> — compromise of one share exposes nothing else</li>
              <li data-rune="⇄"><strong>ECDH P-256</strong> — Handshake keys derived in-browser, never transmitted</li>
              <li data-rune="🌊"><strong>Browser-side decryption</strong> — plaintext never written to any server</li>
              <li data-rune="💀"><strong>Auto-expiry</strong> — expired files are purged from storage</li>
              <li data-rune="📵"><strong>Zero-knowledge</strong> — the server stores only encrypted blobs</li>
            </ul>
          </section>

          <div className="ms-rune-divider">· · · ᛏ · · ·</div>

          {/* Chapter VI — Install */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᛏ</span> Install the CLI</h2>
            <p className="ms-body">
              Durin&apos;s Door also comes as a <strong>command-line tool</strong> — a single binary, no dependencies.
              Download it from <a href="https://github.com/DesoCT/DurinsDoor/releases" style={{ color: 'var(--elvish)', textDecoration: 'underline' }}>GitHub Releases</a> or
              use one of the incantations below.
            </p>

            <div className="guide-code-block">
              <div className="guide-code-label">Terminal · Install</div>
              <code className="guide-code">{
`# Linux (x86_64)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-amd64 -o durins-door
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# Linux (ARM64 / Raspberry Pi)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-arm64 -o durins-door
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# macOS (Apple Silicon)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-darwin-arm64 -o durins-door
chmod +x durins-door && mv durins-door /usr/local/bin/

# macOS (Intel)
curl -fSL https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-darwin-amd64 -o durins-door
chmod +x durins-door && mv durins-door /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-windows-amd64.exe -OutFile durins-door.exe

# Or with wget
wget -qO durins-door https://github.com/DesoCT/DurinsDoor/releases/latest/download/durins-door-linux-amd64
chmod +x durins-door && sudo mv durins-door /usr/local/bin/

# Or build from source
go install github.com/unisoniq/durins-door@latest`
              }</code>
            </div>
          </section>

          <div className="ms-rune-divider">· · · ᛈ · · ·</div>

          {/* Chapter VII — Server CLI */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᛈ</span> Server CLI Reference</h2>
            <p className="ms-body">
              The self-hosted server encrypts files locally with AES-256-GCM, stores them on disk,
              and serves them over HTTP with optional Cloudflare/ngrok tunneling. All incantations of the <em>durins-door</em> command:
            </p>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.5rem 0 0.5rem' }}>
              durins-door server [flags]
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">--port</td><td className="default-cell">8888</td><td className="desc-cell">HTTP server port</td></tr>
                <tr><td className="flag-cell">--token</td><td className="default-cell">auto-generated</td><td className="desc-cell">Admin bearer token for the dashboard</td></tr>
                <tr><td className="flag-cell">--tunnel</td><td className="default-cell">true</td><td className="desc-cell">Auto-create Cloudflare/ngrok tunnel</td></tr>
                <tr><td className="flag-cell">--no-tunnel</td><td className="default-cell">false</td><td className="desc-cell">Disable automatic tunnel (LAN only)</td></tr>
              </tbody>
            </table>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              durins-door share [flags] &lt;file&gt;
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">--key</td><td className="default-cell">auto-generated</td><td className="desc-cell">Custom encryption key passphrase</td></tr>
                <tr><td className="flag-cell">--expires</td><td className="default-cell">1h</td><td className="desc-cell">Expiry duration (1h, 24h, 7d)</td></tr>
                <tr><td className="flag-cell">--password</td><td className="default-cell">(none)</td><td className="desc-cell">Require a password to download</td></tr>
                <tr><td className="flag-cell">--max-downloads</td><td className="default-cell">0 (unlimited)</td><td className="desc-cell">Max number of downloads before the link seals</td></tr>
                <tr><td className="flag-cell">--port</td><td className="default-cell">0 (auto)</td><td className="desc-cell">HTTP server port</td></tr>
                <tr><td className="flag-cell">--no-tunnel</td><td className="default-cell">false</td><td className="desc-cell">Disable tunnel</td></tr>
                <tr><td className="flag-cell">--register-only</td><td className="default-cell">false</td><td className="desc-cell">Encrypt and register without starting a server</td></tr>
              </tbody>
            </table>

            <div className="guide-code-block">
              <div className="guide-code-label">Terminal · Server Examples</div>
              <code className="guide-code">{
`# Start the server
durins-door server --port 8888

# Share a file (starts server + tunnel automatically)
durins-door share secret.pdf --expires 24h --max-downloads 3

# Password-protected, custom key
durins-door share mithril.zip --password "mellon" --key "speak-friend"

# One-time download link
durins-door share one-ring.bin --max-downloads 1 --expires 1h

# List all active shares
durins-door list

# Revoke a share (full ID or prefix)
durins-door revoke abc123

# Check version
durins-door --version`
              }</code>
            </div>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              durins-door download &lt;url&gt;
            </p>
            <p className="ms-body">
              Download and decrypt a shared file from a remote Durin&apos;s Door server.
              The encryption key is extracted from the URL fragment.
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">-o, --output</td><td className="default-cell">original filename</td><td className="desc-cell">Output file path</td></tr>
              </tbody>
            </table>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              durins-door upload &lt;file&gt;
            </p>
            <p className="ms-body">
              Upload a file to a remote Durin&apos;s Door server. Requires <code style={{ fontFamily: 'monospace', color: 'var(--elvish)', fontSize: '0.85em' }}>--api-token</code> or the <code style={{ fontFamily: 'monospace', color: 'var(--elvish)', fontSize: '0.85em' }}>DURINS_DOOR_TOKEN</code> environment variable.
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">--password</td><td className="default-cell">(none)</td><td className="desc-cell">Password-protect the share</td></tr>
                <tr><td className="flag-cell">--expires</td><td className="default-cell">(none)</td><td className="desc-cell">Expiry duration (24h, 7d, 30d)</td></tr>
                <tr><td className="flag-cell">--max-downloads</td><td className="default-cell">0 (unlimited)</td><td className="desc-cell">Max download count</td></tr>
              </tbody>
            </table>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              durins-door send &lt;file&gt; --to &lt;CODE&gt;
            </p>
            <p className="ms-body">
              Send a file to a waiting receiver via ECDH P-256 handshake against a remote server.
              Both parties see a 3-word Tolkien verification phrase to confirm no man-in-the-middle.
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">--to</td><td className="default-cell">(required)</td><td className="desc-cell">Pairing code from the receiver</td></tr>
                <tr><td className="flag-cell">--password</td><td className="default-cell">(none)</td><td className="desc-cell">Additional password layer on top of ECDH</td></tr>
                <tr><td className="flag-cell">--expires</td><td className="default-cell">(none)</td><td className="desc-cell">Share expiry (24h, 7d)</td></tr>
                <tr><td className="flag-cell">--max-downloads</td><td className="default-cell">0 (unlimited)</td><td className="desc-cell">Max download count</td></tr>
              </tbody>
            </table>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              durins-door receive
            </p>
            <p className="ms-body">
              Wait for a peer to send you a file via ECDH handshake. Generates a Tolkien-word pairing code,
              then auto-downloads and decrypts the file when the sender uploads it. Times out after 10 minutes.
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">-o, --output</td><td className="default-cell">. (current dir)</td><td className="desc-cell">Directory to save the received file</td></tr>
              </tbody>
            </table>

            <p style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.8rem 0 0.5rem' }}>
              Global flags (all commands)
            </p>
            <table className="rune-table">
              <thead><tr><th>Flag</th><th>Default</th><th>Description</th></tr></thead>
              <tbody>
                <tr><td className="flag-cell">--server-url</td><td className="default-cell">https://durinsdoor.io</td><td className="desc-cell">Durin&apos;s Door server URL</td></tr>
                <tr><td className="flag-cell">--api-token</td><td className="default-cell">(none)</td><td className="desc-cell">Admin bearer token (also via DURINS_DOOR_TOKEN env var)</td></tr>
                <tr><td className="flag-cell">--version</td><td className="default-cell"></td><td className="desc-cell">Print version and build date</td></tr>
              </tbody>
            </table>
          </section>

          <div className="ms-rune-divider">· · · ᛞ · · ·</div>

          {/* Chapter VIII — Using CLI with the Web */}
          <section className="ms-section">
            <h2 className="ms-heading"><span className="ms-heading-rune">ᛞ</span> Using the CLI with durinsdoor.io</h2>
            <p className="ms-body">
              The CLI talks directly to <strong>durinsdoor.io</strong> by default — no self-hosted server needed.
              Encrypt locally, upload ciphertext to the cloud. Zero-knowledge — the server never sees your key or plaintext.
            </p>

            <div className="guide-code-block">
              <div className="guide-code-label">Terminal · Quick Start</div>
              <code className="guide-code">{
`# Send a file to someone (they open Handshake > Receive in the browser)
durins-door send file.pdf --to HXMP3K

# Receive a file (displays a pairing code)
durins-door receive

# Upload a file and get a share link
durins-door upload secret.pdf --expires 24h

# List active shares
durins-door list

# Revoke a share
durins-door revoke <share-id>`
              }</code>
            </div>

            <p className="ms-body" style={{ marginTop: '1rem' }}>
              The CLI connects to <code style={{ fontFamily: 'monospace', color: 'var(--elvish)', fontSize: '0.85em' }}>https://durinsdoor.io</code> by default.
              Override with <code style={{ fontFamily: 'monospace', color: 'var(--elvish)', fontSize: '0.85em' }}>--server-url</code> to
              point at a self-hosted server or local dev instance.
            </p>
          </section>

          <div className="ms-border-bot" />

          <p className="ms-footer-quote">
            &ldquo;Not all those who wander are lost.&rdquo; — J.R.R. Tolkien<br />
            <span style={{ fontSize: '0.78rem', display: 'block', marginTop: '0.4rem', letterSpacing: '0.25em', opacity: 0.5 }}>
              · · ᛁ ᛜ ᛞ ᚢ ᚱ ᛁ ᚾ · ·
            </span>
          </p>
        </article>

        <div style={{ textAlign: 'center', marginTop: '2rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="guide-back">← The Door</Link>
          <Link href="/gallery" className="guide-back">The Vaults →</Link>
        </div>
      </div>
    </>
  )
}
