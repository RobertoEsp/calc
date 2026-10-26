package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"calc/backend/internal/calculator"
)

const maxBodyBytes = 1 << 20

type handler struct {
	logger *slog.Logger
}

type calculateResponse struct {
	Result float64 `json:"result"`
}

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Path    string `json:"path,omitempty"`
}

// NewHandler returns the HTTP handler for the calculator API.
func NewHandler(logger *slog.Logger) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}

	h := &handler{logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/calculate", h.calculate)
	mux.HandleFunc("GET /healthz", h.health)

	return withLogging(logger, withRecovery(logger, withCORS(mux)))
}

func (h *handler) calculate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	node, err := decodeRequest(r.Body)
	if err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "request_too_large", "request body exceeds the size limit", "")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid_json", err.Error(), "")
		return
	}

	result, err := calculator.Evaluate(node)
	if err != nil {
		var calcErr *calculator.Error
		if errors.As(err, &calcErr) {
			writeError(w, http.StatusUnprocessableEntity, string(calcErr.Code), calcErr.Message, calcErr.Path)
			return
		}
		h.logger.Error("evaluate expression", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", "internal error", "")
		return
	}

	writeJSON(w, http.StatusOK, calculateResponse{Result: result})
}

func (h *handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message, path string) {
	writeJSON(w, status, errorBody{
		Error: errorDetail{Code: code, Message: message, Path: path},
	})
}
