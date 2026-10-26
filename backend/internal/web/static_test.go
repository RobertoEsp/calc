package web

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewHandlerRejectsInvalidDirectories(t *testing.T) {
	dir := t.TempDir()

	file := filepath.Join(dir, "not-a-directory")
	if err := os.WriteFile(file, []byte("file"), 0o600); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name string
		dir  string
	}{
		{"missing", filepath.Join(dir, "missing")},
		{"not a directory", file},
		{"missing index", dir},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if _, err := NewHandler(test.dir); err == nil {
				t.Fatal("NewHandler() error = nil, want an error")
			}
		})
	}
}

func TestHandlerServesStaticFiles(t *testing.T) {
	root := staticFixture(t)

	tests := []struct {
		name        string
		path        string
		wantStatus  int
		wantBody    string
		wantCache   string
		wantContent string
	}{
		{
			name:        "index",
			path:        "/",
			wantStatus:  http.StatusOK,
			wantBody:    "<!doctype html><title>Calc</title>",
			wantCache:   "no-cache",
			wantContent: "text/html",
		},
		{
			name:        "asset",
			path:        "/assets/app.js",
			wantStatus:  http.StatusOK,
			wantBody:    "console.log('calc')",
			wantCache:   "public, max-age=31536000, immutable",
			wantContent: "javascript",
		},
		{
			name:        "client route falls back to the index",
			path:        "/calculations/42",
			wantStatus:  http.StatusOK,
			wantBody:    "<!doctype html><title>Calc</title>",
			wantCache:   "no-cache",
			wantContent: "text/html",
		},
		{
			name:       "missing asset",
			path:       "/assets/missing.js",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "directory",
			path:       "/assets/",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "rejects path traversal",
			path:       "/../secret",
			wantStatus: http.StatusBadRequest,
		},
	}

	handler, err := NewHandler(root)
	if err != nil {
		t.Fatal(err)
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, test.wantStatus, recorder.Body)
			}
			if test.wantBody != "" && !strings.Contains(recorder.Body.String(), test.wantBody) {
				t.Fatalf("body = %q, want it to contain %q", recorder.Body, test.wantBody)
			}
			if test.wantCache != "" && recorder.Header().Get("Cache-Control") != test.wantCache {
				t.Fatalf("Cache-Control = %q, want %q", recorder.Header().Get("Cache-Control"), test.wantCache)
			}
			if test.wantContent != "" && !strings.Contains(recorder.Header().Get("Content-Type"), test.wantContent) {
				t.Fatalf("Content-Type = %q, want it to contain %q", recorder.Header().Get("Content-Type"), test.wantContent)
			}
		})
	}
}

func TestHandlerRejectsUnsupportedMethods(t *testing.T) {
	handler, err := NewHandler(staticFixture(t))
	if err != nil {
		t.Fatal(err)
	}

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/", nil))

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
	if got := recorder.Header().Get("Allow"); got != "GET, HEAD" {
		t.Fatalf("Allow = %q, want %q", got, "GET, HEAD")
	}
}

func TestRouterSplitsAPIAndStaticTraffic(t *testing.T) {
	api := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, "api "+r.URL.Path)
	})
	spa := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = io.WriteString(w, "spa")
	})
	router := NewRouter(api, spa)

	tests := []struct {
		path string
		want string
	}{
		{"/api", "api /api"},
		{"/api/v1/calculate", "api /api/v1/calculate"},
		{"/healthz", "api /healthz"},
		{"/healthz/status", "api /healthz/status"},
		{"/", "spa"},
		{"/calculations/42", "spa"},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))

			if got := recorder.Body.String(); got != test.want {
				t.Fatalf("body = %q, want %q", got, test.want)
			}
		})
	}
}

func staticFixture(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "index.html"),
		[]byte("<!doctype html><title>Calc</title>"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(root, "assets", "app.js"),
		[]byte("console.log('calc')"),
		0o600,
	); err != nil {
		t.Fatal(err)
	}
	return root
}
