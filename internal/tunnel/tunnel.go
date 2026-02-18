// Package tunnel provides automatic public URL tunneling for Durin's Door.
package tunnel

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// Backend represents a tunneling backend.
type Backend string

const (
	BackendCloudflared Backend = "cloudflared"
	BackendNgrok       Backend = "ngrok"
	BackendNone        Backend = "none"
)

// Tunnel represents a running tunnel process.
type Tunnel struct {
	Backend   Backend
	PublicURL string
	cmd       *exec.Cmd
	cancel    context.CancelFunc
}

// DetectBackend detects which tunnel backend is available.
// Prefers cloudflared (free, no account needed).
func DetectBackend() Backend {
	if _, err := exec.LookPath("cloudflared"); err == nil {
		return BackendCloudflared
	}
	if _, err := exec.LookPath("ngrok"); err == nil {
		return BackendNgrok
	}
	return BackendNone
}

// Start starts a tunnel to the given local port and returns the public URL.
// It auto-detects the best available backend (prefers cloudflared).
func Start(ctx context.Context, port int) (*Tunnel, error) {
	backend := DetectBackend()
	if backend == BackendNone {
		return nil, fmt.Errorf("no tunnel backend found — install cloudflared or ngrok")
	}

	switch backend {
	case BackendCloudflared:
		return startCloudflared(ctx, port)
	case BackendNgrok:
		return startNgrok(ctx, port)
	default:
		return nil, fmt.Errorf("unsupported backend: %s", backend)
	}
}

// Stop stops the tunnel process.
func (t *Tunnel) Stop() {
	if t.cancel != nil {
		t.cancel()
	}
	if t.cmd != nil && t.cmd.Process != nil {
		t.cmd.Process.Kill()
	}
}

func startCloudflared(parentCtx context.Context, port int) (*Tunnel, error) {
	ctx, cancel := context.WithCancel(parentCtx)

	cmd := exec.CommandContext(ctx, "cloudflared", "tunnel", "--url", fmt.Sprintf("http://localhost:%d", port))
	cmd.Env = append(os.Environ(), "NO_AUTOUPDATE=1")

	// cloudflared prints the URL to stderr
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start cloudflared: %w", err)
	}

	// Parse the public URL from stderr output
	urlCh := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(stderr)
		re := regexp.MustCompile(`https://[a-zA-Z0-9-]+\.trycloudflare\.com`)
		for scanner.Scan() {
			line := scanner.Text()
			if match := re.FindString(line); match != "" {
				urlCh <- match
				return
			}
		}
	}()

	// Wait for URL with timeout
	select {
	case url := <-urlCh:
		return &Tunnel{
			Backend:   BackendCloudflared,
			PublicURL: url,
			cmd:       cmd,
			cancel:    cancel,
		}, nil
	case <-time.After(30 * time.Second):
		cancel()
		cmd.Process.Kill()
		return nil, fmt.Errorf("timed out waiting for cloudflared URL")
	case <-ctx.Done():
		cancel()
		return nil, ctx.Err()
	}
}

func startNgrok(parentCtx context.Context, port int) (*Tunnel, error) {
	ctx, cancel := context.WithCancel(parentCtx)

	cmd := exec.CommandContext(ctx, "ngrok", "http", fmt.Sprintf("%d", port), "--log=stdout", "--log-format=logfmt")

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("start ngrok: %w", err)
	}

	urlCh := make(chan string, 1)
	go func() {
		scanner := bufio.NewScanner(stdout)
		re := regexp.MustCompile(`url=(https://[^\s]+)`)
		for scanner.Scan() {
			line := scanner.Text()
			if match := re.FindStringSubmatch(line); len(match) > 1 {
				urlCh <- match[1]
				return
			}
		}
	}()

	select {
	case url := <-urlCh:
		return &Tunnel{
			Backend:   BackendNgrok,
			PublicURL: url,
			cmd:       cmd,
			cancel:    cancel,
		}, nil
	case <-time.After(30 * time.Second):
		cancel()
		cmd.Process.Kill()
		return nil, fmt.Errorf("timed out waiting for ngrok URL")
	case <-ctx.Done():
		cancel()
		return nil, ctx.Err()
	}
}

// Instructions returns manual instructions if auto-tunnel fails.
func Instructions(port int) string {
	return fmt.Sprintf(
		"cloudflared tunnel --url http://localhost:%d\n"+
			"  # or\n"+
			"  ngrok http %d", port, port)
}

// IsAvailable returns true if any tunnel backend is available.
func IsAvailable() bool {
	return DetectBackend() != BackendNone
}

// Name returns a human-readable name of the available backend.
func Name() string {
	switch DetectBackend() {
	case BackendCloudflared:
		return "Cloudflare"
	case BackendNgrok:
		return "ngrok"
	default:
		return "none"
	}
}

// LocalURL returns the local server URL.
func LocalURL(port int) string {
	return fmt.Sprintf("http://localhost:%d", port)
}

// TrimProtocol removes the http(s):// prefix from a URL.
func TrimProtocol(url string) string {
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	return url
}
