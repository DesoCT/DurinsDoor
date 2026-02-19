// Package server provides the HTTP server and routing for Durin's Door.
package server

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/unisoniq/durins-door/internal/share"
)

// Server is the Durin's Door HTTP server.
type Server struct {
	store      *share.Store
	adminToken string
	mux        *http.ServeMux
	httpServer *http.Server
	templates  embed.FS
	staticFS   fs.FS
	port       int
}

// Config holds server configuration.
type Config struct {
	Store      *share.Store
	AdminToken string
	Port       int
	WebFS      embed.FS
}

// New creates and configures a new Server.
func New(cfg Config) *Server {
	s := &Server{
		store:      cfg.Store,
		adminToken: cfg.AdminToken,
		mux:        http.NewServeMux(),
		templates:  cfg.WebFS,
		port:       cfg.Port,
	}

	// Build a sub-FS for static assets.
	// main.go embeds "web/templates" and "web/static", so paths inside webFS
	// are "web/static/…". We sub into "web/static" so the file server sees
	// them as plain "style.css", etc.
	staticFS, err := fs.Sub(cfg.WebFS, "web/static")
	if err != nil {
		log.Fatalf("failed to create static FS: %v", err)
	}
	s.staticFS = staticFS

	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	rl := newRateLimiter(60, time.Minute)

	// Static assets
	s.mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.FS(s.staticFS))))

	// Public routes
	s.mux.Handle("/", loggingMiddleware(rl.middleware(http.HandlerFunc(s.handleHome))))
	s.mux.Handle("/d/", loggingMiddleware(rl.middleware(http.HandlerFunc(s.handleDownload))))
	s.mux.Handle("/dl/", loggingMiddleware(rl.middleware(http.HandlerFunc(s.handleFileStream))))
	s.mux.Handle("/gallery", loggingMiddleware(rl.middleware(http.HandlerFunc(s.handleGallery))))
	s.mux.Handle("/guide", loggingMiddleware(rl.middleware(http.HandlerFunc(s.handleGuide))))

	// Admin routes (token-protected)
	adminHandler := adminAuthMiddleware(s.adminToken, http.HandlerFunc(s.handleAdmin))
	revokeHandler := adminAuthMiddleware(s.adminToken, http.HandlerFunc(s.handleRevoke))
	apiSharesHandler := adminAuthMiddleware(s.adminToken, http.HandlerFunc(s.handleAPIShares))

	s.mux.Handle("/admin", loggingMiddleware(adminHandler))
	s.mux.Handle("/admin/", loggingMiddleware(adminHandler))
	s.mux.Handle("/admin/revoke/", loggingMiddleware(revokeHandler))
	s.mux.Handle("/api/shares", loggingMiddleware(apiSharesHandler))
}

// Start starts the HTTP server and blocks until the context is cancelled.
func (s *Server) Start(ctx context.Context) error {
	addr := fmt.Sprintf(":%d", s.port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen %s: %w", addr, err)
	}

	s.httpServer = &http.Server{
		Handler:      s.mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // no write timeout for large file streams
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("Durin's Door listening on %s", addr)

	// Shutdown on context cancellation
	go func() {
		<-ctx.Done()
		log.Println("Shutting down server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		s.httpServer.Shutdown(shutdownCtx)
	}()

	// Run cleanup ticker
	go s.runCleanup(ctx)

	if err := s.httpServer.Serve(ln); err != nil && !isClosedErr(err) {
		return fmt.Errorf("http server: %w", err)
	}
	return nil
}

// Port returns the configured port.
func (s *Server) Port() int {
	return s.port
}

func (s *Server) runCleanup(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := s.store.Purge(ctx)
			if err != nil {
				log.Printf("cleanup error: %v", err)
			} else if n > 0 {
				log.Printf("cleaned up %d expired share(s)", n)
			}
		}
	}
}

func isClosedErr(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "use of closed network connection") ||
		strings.Contains(s, "http: Server closed")
}
