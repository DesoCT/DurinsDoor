package server

import (
	"log"
	"net/http"
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
		ip := r.RemoteAddr
		if !rl.allow(ip) {
			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// adminAuthMiddleware enforces bearer token authentication on the admin endpoint.
func adminAuthMiddleware(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token == "" {
			http.Error(w, "Admin not configured", http.StatusForbidden)
			return
		}
		auth := r.Header.Get("Authorization")
		if auth == "Bearer "+token {
			next.ServeHTTP(w, r)
			return
		}
		// Also accept token as query param for browser convenience
		if r.URL.Query().Get("token") == token {
			next.ServeHTTP(w, r)
			return
		}
		w.Header().Set("WWW-Authenticate", `Bearer realm="Durin's Door Admin"`)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	})
}
