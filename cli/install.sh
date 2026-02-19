#!/usr/bin/env sh
# Durin's Door CLI — one-liner installer
# Usage: curl -sSL https://durins-door.vercel.app/install.sh | sh
set -e

REPO="durins-door/cli"
BINARY="durins-door-cli"
INSTALL_DIR="/usr/local/bin"

# ── Detect OS and architecture ─────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  os="linux" ;;
  Darwin*) os="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) os="windows" ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64) arch="amd64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

# ── Build the download URL ─────────────────────────────────────────────────────
# Fetch the latest release tag from GitHub.
LATEST_TAG="$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"

if [ -z "$LATEST_TAG" ]; then
  echo "Could not determine the latest release version." >&2
  echo "Check https://github.com/${REPO}/releases for available versions." >&2
  exit 1
fi

if [ "$os" = "windows" ]; then
  ASSET="${BINARY}-${os}-${arch}.exe"
else
  ASSET="${BINARY}-${os}-${arch}"
fi

URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${ASSET}"

echo "Installing ${BINARY} ${LATEST_TAG} (${os}/${arch}) …"

# ── Download ───────────────────────────────────────────────────────────────────
TMP="$(mktemp)"
if command -v curl > /dev/null 2>&1; then
  curl -sSL -o "$TMP" "$URL"
elif command -v wget > /dev/null 2>&1; then
  wget -qO "$TMP" "$URL"
else
  echo "Neither curl nor wget found. Please install one and retry." >&2
  exit 1
fi

# ── Install ────────────────────────────────────────────────────────────────────
chmod +x "$TMP"

if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "${INSTALL_DIR}/${BINARY}"
else
  echo "Installing to ${INSTALL_DIR} (requires sudo) …"
  sudo mv "$TMP" "${INSTALL_DIR}/${BINARY}"
fi

echo "✓ Installed to ${INSTALL_DIR}/${BINARY}"
echo ""
echo "Run: ${BINARY} --help"
