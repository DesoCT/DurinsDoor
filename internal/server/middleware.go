package server

import (
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// loggingMiddleware logs HTTP requests.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)
		log.Printf("[%s] %s %s %d %v",
			r.Method, r.URL.Path, r.RemoteAddr, rw.status, time.Since(start))
	})
}

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

// rateLimiter is a simple token-bucket rate limiter keyed by IP.
type rateLimiter struct {
	mu      sync.Mutex
	clients map[string]*client
	rate    int           // max requests per window
	window  time.Duration // time window
}

type client struct {
	count     int
	windowEnd time.Time
}

func newRateLimiter(rate int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		clients: make(map[string]*client),
		rate:    rate,
		window:  window,
	}
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) cleanup() {
	ticker := time.NewTicker(rl.window)
	defer ticker.Stop()
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for ip, c := range rl.clients {
			if now.After(c.windowEnd) {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	c, ok := rl.clients[ip]
	if !ok || now.After(c.windowEnd) {
		rl.clients[ip] = &client{count: 1, windowEnd: now.Add(rl.window)}
		return true
	}
	c.count++
	return c.count <= rl.rate
}

func (rl *rateLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r)
		if !rl.allow(ip) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientIP extracts the client IP from the request, checking X-Forwarded-For
// and X-Real-IP headers (for reverse proxy setups) before falling back to
// RemoteAddr. The port is stripped so all connections from one IP share a bucket.
func clientIP(r *http.Request) string {
	// Check X-Forwarded-For first (may contain "client, proxy1, proxy2")
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// First entry is the original client
		if idx := strings.IndexByte(xff, ','); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}
	// Check X-Real-IP
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// Fall back to RemoteAddr, stripping the port
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr // IPv6 without port or unexpected format
	}
	return host
}

// securityHeaders adds standard security headers to every response.
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		// CSP: allow inline styles/scripts (needed for templates) but block external
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'")
		next.ServeHTTP(w, r)
	})
}

// adminAuthMiddleware enforces bearer token or cookie-based authentication.
func adminAuthMiddleware(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token == "" {
			http.Error(w, "Admin not configured", http.StatusForbidden)
			return
		}
		// Check Authorization header
		auth := r.Header.Get("Authorization")
		if auth == "Bearer "+token {
			next.ServeHTTP(w, r)
			return
		}
		// Check session cookie (set after first header-based auth)
		if cookie, err := r.Cookie("admin_session"); err == nil && cookie.Value == token {
			next.ServeHTTP(w, r)
			return
		}
		// If token is provided as query param, set a session cookie and redirect
		// to the clean URL (so the token doesn't linger in browser history/logs).
		if r.URL.Query().Get("token") == token {
			http.SetCookie(w, &http.Cookie{
				Name:     "admin_session",
				Value:    token,
				Path:     "/admin",
				HttpOnly: true,
				SameSite: http.SameSiteStrictMode,
				MaxAge:   3600, // 1 hour
			})
			// Redirect to the same path without the token query param
			cleanURL := *r.URL
			q := cleanURL.Query()
			q.Del("token")
			cleanURL.RawQuery = q.Encode()
			http.Redirect(w, r, cleanURL.String(), http.StatusSeeOther)
			return
		}
		w.Header().Set("WWW-Authenticate", `Bearer realm="Durin's Door Admin"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	})
}
