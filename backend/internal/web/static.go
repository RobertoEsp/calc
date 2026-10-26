// Package web serves the built single-page application and routes API traffic.
package web

import (
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// NewHandler serves files from dir. Requests for unknown paths without a file
// extension fall back to index.html so client-side routes keep working.
func NewHandler(dir string) (http.Handler, error) {
	root, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("resolve static directory: %w", err)
	}

	info, err := os.Stat(root)
	if err != nil {
		return nil, fmt.Errorf("open static directory: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("static path %q is not a directory", root)
	}

	index := filepath.Join(root, "index.html")
	info, err = os.Stat(index)
	if err != nil {
		return nil, fmt.Errorf("open static index: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("static index %q is not a file", index)
	}

	return &spaHandler{root: root}, nil
}

// NewRouter sends API and health requests to api and everything else to spa.
func NewRouter(api, spa http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/api", api)
	mux.Handle("/api/", api)
	mux.Handle("/healthz", api)
	mux.Handle("/healthz/", api)
	mux.Handle("/", spa)
	return mux
}

type spaHandler struct {
	root string
}

func (h *spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	name := path.Clean("/" + r.URL.Path)
	if name == "/" {
		h.serveIndex(w, r)
		return
	}

	file := filepath.Join(h.root, filepath.FromSlash(strings.TrimPrefix(name, "/")))
	info, err := os.Stat(file)
	switch {
	case err == nil && info.Mode().IsRegular():
		if strings.HasPrefix(name, "/assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		http.ServeFile(w, r, file)
	case err == nil:
		http.NotFound(w, r)
	case !errors.Is(err, fs.ErrNotExist):
		http.Error(w, "internal server error", http.StatusInternalServerError)
	case path.Ext(name) != "":
		http.NotFound(w, r)
	default:
		h.serveIndex(w, r)
	}
}

func (h *spaHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, filepath.Join(h.root, "index.html"))
}
