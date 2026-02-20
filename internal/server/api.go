package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/unisoniq/durins-door/internal/crypto"
	"github.com/unisoniq/durins-door/internal/share"
	"golang.org/x/crypto/bcrypt"
)

// --- JSON types for API responses ---

type apiShare struct {
	ID                string     `json:"id"`
	Filename          string     `json:"filename"`
	FileSize          int64      `json:"file_size"`
	MimeType          string     `json:"mime_type,omitempty"`
	PasswordHash      *string    `json:"password_hash,omitempty"`
	MaxDownloads      *int       `json:"max_downloads,omitempty"`
	Downloads         int        `json:"downloads"`
	ExpiresAt         *time.Time `json:"expires_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	StoragePath       string     `json:"storage_path,omitempty"`
	PasswordProtected bool       `json:"password_protected"`
}

func shareToAPI(sh *share.Share) apiShare {
	a := apiShare{
		ID:                sh.ID,
		Filename:          sh.Filename,
		FileSize:          sh.Size,
		Downloads:         sh.Downloads,
		CreatedAt:         sh.CreatedAt,
		PasswordProtected: sh.PasswordHash != "",
		StoragePath:       sh.EncryptedPath,
	}
	if sh.MaxDownloads > 0 {
		md := sh.MaxDownloads
		a.MaxDownloads = &md
	}
	if !sh.ExpiresAt.IsZero() {
		t := sh.ExpiresAt
		a.ExpiresAt = &t
	}
	if sh.PasswordHash != "" {
		a.PasswordHash = &sh.PasswordHash
	}
	return a
}

type apiHandshake struct {
	ID                string     `json:"id"`
	Code              string     `json:"code"`
	ReceiverPublicKey string     `json:"receiver_public_key"`
	SenderPublicKey   *string    `json:"sender_public_key"`
	ShareID           *string    `json:"share_id"`
	CreatedAt         time.Time  `json:"created_at"`
	ExpiresAt         *time.Time `json:"expires_at"`
}

func handshakeToAPI(h *share.Handshake) apiHandshake {
	a := apiHandshake{
		ID:                h.ID,
		Code:              h.Code,
		ReceiverPublicKey: h.ReceiverPublicKey,
		CreatedAt:         h.CreatedAt,
	}
	if h.SenderPublicKey != "" {
		s := h.SenderPublicKey
		a.SenderPublicKey = &s
	}
	if h.ShareID != "" {
		s := h.ShareID
		a.ShareID = &s
	}
	if !h.ExpiresAt.IsZero() {
		t := h.ExpiresAt
		a.ExpiresAt = &t
	}
	return a
}

// --- Upload endpoint ---

// handleAPIUpload handles POST /api/upload
// Accepts multipart form: file + JSON metadata fields.
// Encrypts the file server-side and stores it.
func (s *Server) handleAPIUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (max 512MB)
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		jsonError(w, "Invalid multipart form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "Missing file field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read the entire file into memory for encryption
	plaintext, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, "Reading file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	filename := header.Filename
	if filename == "" {
		filename = "upload"
	}

	// Parse optional fields
	password := r.FormValue("password")
	expiresStr := r.FormValue("expires_at")
	maxDownloadsStr := r.FormValue("max_downloads")

	// Generate encryption key
	key, err := crypto.GenerateKey()
	if err != nil {
		jsonError(w, "Generating key: "+err.Error(), http.StatusInternalServerError)
		return
	}
	keyHex := crypto.KeyToHex(key)

	// Generate share ID
	shareID := randomAPIID()

	// Encrypt file to disk
	encPath := filepath.Join(s.store.DataDir(), "files", shareID+".enc")
	if err := os.MkdirAll(filepath.Dir(encPath), 0700); err != nil {
		jsonError(w, "Creating files dir: "+err.Error(), http.StatusInternalServerError)
		return
	}

	encFile, err := os.OpenFile(encPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
	if err != nil {
		jsonError(w, "Creating encrypted file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	enc, err := crypto.NewEncryptor(encFile, key)
	if err != nil {
		encFile.Close()
		os.Remove(encPath)
		jsonError(w, "Creating encryptor: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if _, err := enc.Write(plaintext); err != nil {
		encFile.Close()
		os.Remove(encPath)
		jsonError(w, "Encrypting: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := enc.Flush(); err != nil {
		encFile.Close()
		os.Remove(encPath)
		jsonError(w, "Flushing encryptor: "+err.Error(), http.StatusInternalServerError)
		return
	}
	encFile.Close()

	// Hash password if provided
	var passwordHash string
	if password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			os.Remove(encPath)
			jsonError(w, "Hashing password: "+err.Error(), http.StatusInternalServerError)
			return
		}
		passwordHash = string(hash)
	}

	// Parse expiry
	expiresAt := time.Now().Add(time.Hour) // default 1 hour
	if expiresStr != "" {
		if t, err := time.Parse(time.RFC3339, expiresStr); err == nil {
			expiresAt = t
		}
	}

	// Parse max downloads
	var maxDownloads int
	if maxDownloadsStr != "" {
		fmt.Sscanf(maxDownloadsStr, "%d", &maxDownloads)
	}

	adminToken := randomAPIID()

	sh := &share.Share{
		ID:            shareID,
		Filename:      filepath.Base(filename),
		EncryptedPath: encPath,
		KeyHex:        keyHex,
		CreatedAt:     time.Now(),
		ExpiresAt:     expiresAt,
		MaxDownloads:  maxDownloads,
		PasswordHash:  passwordHash,
		AdminToken:    adminToken,
		Size:          int64(len(plaintext)),
	}

	if err := s.store.Create(r.Context(), sh); err != nil {
		os.Remove(encPath)
		jsonError(w, "Creating share: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(shareToAPI(sh))
}

// --- Share metadata endpoint ---

// handleAPIShareGet handles GET /api/shares/{id}
func (s *Server) handleAPIShareGet(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/shares/")

	// Route to sub-handlers
	if strings.HasSuffix(id, "/file") {
		id = strings.TrimSuffix(id, "/file")
		s.handleAPIShareFile(w, r, id)
		return
	}
	if strings.HasSuffix(id, "/downloads") {
		id = strings.TrimSuffix(id, "/downloads")
		s.handleAPIShareIncrementDownloads(w, r, id)
		return
	}

	if r.Method == http.MethodDelete {
		s.handleAPIShareDelete(w, r, id)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sh, err := s.store.Get(r.Context(), id)
	if err != nil {
		if err == share.ErrNotFound {
			jsonError(w, "Share not found", http.StatusNotFound)
			return
		}
		jsonError(w, "Internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(shareToAPI(sh))
}

// handleAPIShareFile handles GET /api/shares/{id}/file
// Returns the encrypted file as-is (the CLI decrypts client-side).
func (s *Server) handleAPIShareFile(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sh, err := s.store.Get(r.Context(), id)
	if err != nil {
		if err == share.ErrNotFound {
			jsonError(w, "Share not found", http.StatusNotFound)
			return
		}
		jsonError(w, "Internal error", http.StatusInternalServerError)
		return
	}

	if sh.IsExpired() {
		jsonError(w, "Share expired", http.StatusGone)
		return
	}
	if sh.IsExhausted() {
		jsonError(w, "Download limit reached", http.StatusGone)
		return
	}

	f, err := os.Open(sh.EncryptedPath)
	if err != nil {
		log.Printf("cannot open encrypted file for %s: %v", sh.ID, err)
		jsonError(w, "File not found on server", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", sanitizedContentDisposition(sh.Filename))
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if _, err := io.Copy(w, f); err != nil {
		log.Printf("file stream error for %s: %v", sh.ID, err)
	}
}

// handleAPIShareIncrementDownloads handles POST /api/shares/{id}/downloads
func (s *Server) handleAPIShareIncrementDownloads(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.store.IncrementDownloads(r.Context(), id); err != nil {
		if err == share.ErrNotFound {
			jsonError(w, "Share not found", http.StatusNotFound)
			return
		}
		jsonError(w, "Internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleAPIShareDelete handles DELETE /api/shares/{id}
func (s *Server) handleAPIShareDelete(w http.ResponseWriter, r *http.Request, id string) {
	if err := s.store.Revoke(r.Context(), id); err != nil {
		if err == share.ErrNotFound {
			jsonError(w, "Share not found", http.StatusNotFound)
			return
		}
		jsonError(w, "Revoke failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "revoked", "id": id})
}

// --- List shares endpoint (already exists as admin-only, adding public version) ---

// handleAPISharesList handles GET /api/shares (list all shares)
func (s *Server) handleAPISharesList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	shares, err := s.store.List(r.Context())
	if err != nil {
		jsonError(w, "Internal error", http.StatusInternalServerError)
		return
	}
	result := make([]apiShare, 0, len(shares))
	for _, sh := range shares {
		result = append(result, shareToAPI(sh))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// --- Handshake endpoints ---

// handleAPIHandshakes handles POST /api/handshakes (create) and GET /api/handshakes?code=X (lookup)
func (s *Server) handleAPIHandshakes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		s.handleAPIHandshakeCreate(w, r)
	case http.MethodGet:
		code := r.URL.Query().Get("code")
		if code != "" {
			s.handleAPIHandshakeByCode(w, r, code)
			return
		}
		jsonError(w, "Missing code query parameter", http.StatusBadRequest)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleAPIHandshakeCreate(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Code              string `json:"code"`
		ReceiverPublicKey string `json:"receiver_public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		jsonError(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
		return
	}
	if input.Code == "" || input.ReceiverPublicKey == "" {
		jsonError(w, "code and receiver_public_key are required", http.StatusBadRequest)
		return
	}

	// Check for duplicate code
	existing, err := s.store.GetHandshakeByCode(r.Context(), input.Code)
	if err == nil && existing != nil {
		jsonError(w, "Code already in use", http.StatusConflict)
		return
	}

	h := &share.Handshake{
		ID:                randomAPIID(),
		Code:              input.Code,
		ReceiverPublicKey: input.ReceiverPublicKey,
		CreatedAt:         time.Now(),
		ExpiresAt:         time.Now().Add(10 * time.Minute),
	}

	if err := s.store.CreateHandshake(r.Context(), h); err != nil {
		jsonError(w, "Creating handshake: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(handshakeToAPI(h))
}

func (s *Server) handleAPIHandshakeByCode(w http.ResponseWriter, r *http.Request, code string) {
	h, err := s.store.GetHandshakeByCode(r.Context(), code)
	if err != nil {
		if err == share.ErrNotFound {
			jsonError(w, "Handshake not found for code", http.StatusNotFound)
			return
		}
		jsonError(w, "Internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(handshakeToAPI(h))
}

// handleAPIHandshakeByID handles GET/PATCH /api/handshakes/{id}
func (s *Server) handleAPIHandshakeByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/handshakes/")
	if id == "" {
		jsonError(w, "Missing handshake ID", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h, err := s.store.GetHandshake(r.Context(), id)
		if err != nil {
			if err == share.ErrNotFound {
				jsonError(w, "Handshake not found", http.StatusNotFound)
				return
			}
			jsonError(w, "Internal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(handshakeToAPI(h))

	case http.MethodPatch:
		var input struct {
			SenderPublicKey *string `json:"sender_public_key,omitempty"`
			ShareID         *string `json:"share_id,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			jsonError(w, "Invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}
		if input.SenderPublicKey != nil {
			if err := s.store.SetSenderPublicKey(r.Context(), id, *input.SenderPublicKey); err != nil {
				jsonError(w, "Updating sender key: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
		if input.ShareID != nil {
			if err := s.store.SetHandshakeShareID(r.Context(), id, *input.ShareID); err != nil {
				jsonError(w, "Updating share ID: "+err.Error(), http.StatusInternalServerError)
				return
			}
		}
		// Return the updated handshake
		h, err := s.store.GetHandshake(r.Context(), id)
		if err != nil {
			jsonError(w, "Fetching updated handshake: "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(handshakeToAPI(h))

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// --- Helpers ---

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func randomAPIID() string {
	b := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		panic(fmt.Sprintf("crypto/rand failure: %v", err))
	}
	return hex.EncodeToString(b)
}
