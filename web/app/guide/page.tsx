import Link from 'next/link'

export default function GuidePage() {
  return (
    <>
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
