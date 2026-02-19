package server

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/unisoniq/durins-door/internal/crypto"
	"github.com/unisoniq/durins-door/internal/share"
	"golang.org/x/crypto/bcrypt"
)

// homeData is passed to the home page template.
type homeData struct {
	ActiveShares int
	ServerURL    string
}

// downloadData is passed to the download page template.
type downloadData struct {
	Share             *share.Share
	PasswordRequired  bool
	PasswordWrong     bool
	DownloadsRemaining int
	ExpiresIn         string
	HumanSize         string
	Error             string
}

// adminData is passed to the admin page template.
type adminData struct {
	Shares  []*share.Share
	Token   string
	BaseURL string
}

// galleryData is passed to the gallery page template.
type galleryData struct {
	Shares []*share.Share
}

func humanDuration(d time.Duration) string {
	if d < 0 {
		return "expired"
	}
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		h := int(d.Hours())
		m := int(d.Minutes()) % 60
		if m == 0 {
			return fmt.Sprintf("%dh", h)
		}
		return fmt.Sprintf("%dh%dm", h, m)
	}
	return fmt.Sprintf("%dd", int(d.Hours()/24))
}

func humanSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// handleHome renders the home page.
func (s *Server) handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	count, _ := s.store.ActiveCount(r.Context())
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	data := homeData{
		ActiveShares: count,
		ServerURL:    fmt.Sprintf("%s://%s", scheme, r.Host),
	}
	s.renderTemplate(w, "home.html", data)
}

// handleDownload renders the download page for a share.
func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/d/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	sh, err := s.store.Get(r.Context(), id)
	if err != nil {
		s.renderError(w, r, "The door is sealed — this link does not exist.", http.StatusNotFound)
		return
	}
	if sh.IsExpired() {
		s.renderError(w, r, "The door has closed — this link has expired.", http.StatusGone)
		return
	}
	if sh.IsExhausted() {
		s.renderError(w, r, "The door is shut — this file has reached its download limit.", http.StatusGone)
		return
	}

	data := downloadData{
		Share:              sh,
		PasswordRequired:   sh.PasswordHash != "",
		DownloadsRemaining: sh.DownloadsRemaining(),
		ExpiresIn:          humanDuration(time.Until(sh.ExpiresAt)),
		HumanSize:          humanSize(sh.Size),
	}

	if r.Method == http.MethodGet {
		s.renderTemplate(w, "download.html", data)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// POST — handle password check + file delivery
	if sh.PasswordHash != "" {
		password := r.FormValue("password")
		if err := bcrypt.CompareHashAndPassword([]byte(sh.PasswordHash), []byte(password)); err != nil {
			data.PasswordWrong = true
			s.renderTemplate(w, "download.html", data)
			return
		}
	}

	// Deliver the file
	s.streamDecryptedFile(w, r, sh)
}

// handleDirectDownload handles the actual file download (GET with token or POST).
func (s *Server) streamDecryptedFile(w http.ResponseWriter, r *http.Request, sh *share.Share) {
	// Re-validate atomically
	if sh.IsExpired() || sh.IsExhausted() {
		http.Error(w, "Share no longer available", http.StatusGone)
		return
	}

	// Increment downloads before streaming (prevent race condition double-download)
	if err := s.store.IncrementDownloads(r.Context(), sh.ID); err != nil {
		log.Printf("error incrementing downloads for %s: %v", sh.ID, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	key, err := crypto.KeyFromHex(sh.KeyHex)
	if err != nil {
		log.Printf("invalid key for share %s: %v", sh.ID, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	f, err := os.Open(sh.EncryptedPath)
	if err != nil {
		log.Printf("cannot open encrypted file for %s: %v", sh.ID, err)
		http.Error(w, "File not found on server", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, sh.Filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if err := crypto.DecryptStream(w, f, key); err != nil {
		// Can't change status after headers sent; log the error
		log.Printf("decrypt stream error for %s: %v", sh.ID, err)
	}
}

// handleGallery renders the public gallery of active shares.
func (s *Server) handleGallery(w http.ResponseWriter, r *http.Request) {
	shares, err := s.store.List(r.Context())
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	data := galleryData{Shares: shares}
	s.renderTemplate(w, "gallery.html", data)
}

// handleGuide renders the static how-to-use guide page.
func (s *Server) handleGuide(w http.ResponseWriter, r *http.Request) {
	s.renderTemplate(w, "guide.html", nil)
}

// handleAdmin renders the admin dashboard.
func (s *Server) handleAdmin(w http.ResponseWriter, r *http.Request) {
	shares, err := s.store.List(r.Context())
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	data := adminData{
		Shares:  shares,
		Token:   s.adminToken,
		BaseURL: fmt.Sprintf("%s://%s", scheme, r.Host),
	}
	s.renderTemplate(w, "admin.html", data)
}

// handleRevoke handles share revocation from the admin page.
func (s *Server) handleRevoke(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/admin/revoke/")
	if id == "" {
		http.Error(w, "Missing share ID", http.StatusBadRequest)
		return
	}
	if err := s.store.Revoke(r.Context(), id); err != nil {
		http.Error(w, fmt.Sprintf("Revoke failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Return JSON for API calls, redirect for browser
	if r.Header.Get("Accept") == "application/json" {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "revoked", "id": id})
		return
	}
	http.Redirect(w, r, "/admin?token="+s.adminToken, http.StatusSeeOther)
}

// handleAPIShares returns JSON list of active shares.
func (s *Server) handleAPIShares(w http.ResponseWriter, r *http.Request) {
	shares, err := s.store.List(r.Context())
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	type shareJSON struct {
		ID                 string    `json:"id"`
		Filename           string    `json:"filename"`
		Size               int64     `json:"size"`
		CreatedAt          time.Time `json:"created_at"`
		ExpiresAt          time.Time `json:"expires_at"`
		Downloads          int       `json:"downloads"`
		MaxDownloads       int       `json:"max_downloads"`
		PasswordProtected  bool      `json:"password_protected"`
	}
	result := make([]shareJSON, 0, len(shares))
	for _, sh := range shares {
		result = append(result, shareJSON{
			ID:                sh.ID,
			Filename:          sh.Filename,
			Size:              sh.Size,
			CreatedAt:         sh.CreatedAt,
			ExpiresAt:         sh.ExpiresAt,
			Downloads:         sh.Downloads,
			MaxDownloads:      sh.MaxDownloads,
			PasswordProtected: sh.PasswordHash != "",
		})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// renderTemplate renders a named template with data.
func (s *Server) renderTemplate(w http.ResponseWriter, name string, data any) {
	tmpl, err := template.New(name).Funcs(template.FuncMap{
		"humanDuration": humanDuration,
		"humanSize":     humanSize,
		"until":         func(t time.Time) time.Duration { return time.Until(t) },
		"isExpired":     func(sh *share.Share) bool { return sh.IsExpired() },
		"isExhausted":   func(sh *share.Share) bool { return sh.IsExhausted() },
		// add is used by the admin template for simple integer arithmetic.
		"add": func(a, b int) int { return a + b },
		// formatTime formats a time.Time using the given layout string.
		"formatTime": func(t time.Time, layout string) string { return t.Format(layout) },
	// main.go embeds as "web/templates/…", so we must use that full path.
	}).ParseFS(s.templates, "web/templates/"+name)
	if err != nil {
		log.Printf("template parse error for %s: %v", name, err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		log.Printf("template execute error for %s: %v", name, err)
	}
}

// renderError renders a themed error page.
func (s *Server) renderError(w http.ResponseWriter, r *http.Request, msg string, status int) {
	w.WriteHeader(status)
	data := downloadData{Error: msg}
	s.renderTemplate(w, "download.html", data)
}

// handleFileStream handles streaming decryption for direct download links.
func (s *Server) handleFileStream(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/dl/")
	if id == "" {
		http.NotFound(w, r)
		return
	}

	sh, err := s.store.Get(r.Context(), id)
	if err != nil {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}
	if sh.IsExpired() {
		http.Error(w, "Expired", http.StatusGone)
		return
	}
	if sh.IsExhausted() {
		http.Error(w, "Download limit reached", http.StatusGone)
		return
	}
	if sh.PasswordHash != "" {
		http.Error(w, "Password required — use the download page", http.StatusForbidden)
		return
	}

	s.streamDecryptedFile(w, r, sh)
}

// copyBody discards the body to help with connection reuse.
func copyBody(r *http.Request) {
	io.Copy(io.Discard, r.Body)
	r.Body.Close()
}
