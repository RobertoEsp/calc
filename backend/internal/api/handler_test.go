package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCalculateSuccess(t *testing.T) {
	tests := []struct {
		name string
		body string
		want float64
	}{
		{"add", `{"operation":"add","operands":[2,3]}`, 5},
		{"subtract", `{"operation":"subtract","operands":[2,3]}`, -1},
		{"multiply", `{"operation":"multiply","operands":[7,6]}`, 42},
		{"divide", `{"operation":"divide","operands":[10,4]}`, 2.5},
		{"exponentiate", `{"operation":"exponentiate","operands":[2,10]}`, 1024},
		{"square root", `{"operation":"sqrt","operands":[81]}`, 9},
		{"percent", `{"operation":"percent","operands":[25]}`, 0.25},
		{
			"flagged percent",
			`{"operation":"percent","operands":[{"value":25,"percent":true}]}`,
			0.25,
		},
		{"add percent", `{"operation":"add","operands":[200,{"value":10,"percent":true}]}`, 220},
		{"subtract percent", `{"operation":"subtract","operands":[200,{"value":10,"percent":true}]}`, 180},
		{"multiply percent", `{"operation":"multiply","operands":[200,{"value":10,"percent":true}]}`, 20},
		{"divide percent", `{"operation":"divide","operands":[200,{"value":10,"percent":true}]}`, 2000},
		{"nested", `{"operation":"add","operands":[2,{"operation":"multiply","operands":[3,4]}]}`, 14},
		{"value object", `{"operation":"add","operands":[1,{"value":2}]}`, 3},
		{"trailing whitespace", "{\"operation\":\"add\",\"operands\":[1,2]}\n", 3},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := doRequest(t, newTestHandler(), http.MethodPost, "/api/v1/calculate", test.body)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
			}
			if contentType := recorder.Header().Get("Content-Type"); contentType != "application/json; charset=utf-8" {
				t.Fatalf("Content-Type = %q", contentType)
			}

			var got calculateResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if math.Abs(got.Result-test.want) > 1e-9 {
				t.Fatalf("result = %v, want %v", got.Result, test.want)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
		wantPath   string
	}{
		{
			"malformed json",
			`{"operation":`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"empty body",
			"",
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"trailing document",
			`{"operation":"add","operands":[1,2]}{"operation":"add","operands":[1,2]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"unknown top-level field",
			`{"operation":"add","operands":[1,2],"extra":true}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"unknown expression field",
			`{"operation":"add","operands":[1,{"operation":"add","operands":[1,2],"percent":true}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"mixed operand object",
			`{"operation":"add","operands":[1,{"operation":"add","operands":[1,2],"value":3}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"null operand",
			`{"operation":"add","operands":[1,null]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"null value",
			`{"operation":"add","operands":[1,{"value":null}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"non-boolean percent",
			`{"operation":"add","operands":[1,{"value":2,"percent":"yes"}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"string operand",
			`{"operation":"add","operands":["1",2]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"operand object without value or operation",
			`{"operation":"add","operands":[1,{"percent":true}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"non-numeric value",
			`{"operation":"add","operands":[1,{"value":"two"}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"unknown value field",
			`{"operation":"add","operands":[1,{"value":2,"extra":1}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"expression without operands",
			`{"operation":"add","operands":[1,{"operation":"add"}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"expression operands not an array",
			`{"operation":"add","operands":[1,{"operation":"add","operands":5}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"expression operands null",
			`{"operation":"add","operands":[1,{"operation":"add","operands":null}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"non-string operation",
			`{"operation":"add","operands":[1,{"operation":5,"operands":[1,2]}]}`,
			http.StatusBadRequest,
			"invalid_json",
			"",
		},
		{
			"division by zero",
			`{"operation":"divide","operands":[1,0]}`,
			http.StatusUnprocessableEntity,
			"division_by_zero",
			"",
		},
		{
			"nested division by zero",
			`{"operation":"add","operands":[1,{"operation":"divide","operands":[1,0]}]}`,
			http.StatusUnprocessableEntity,
			"division_by_zero",
			"operands[1]",
		},
		{
			"unknown operation",
			`{"operation":"modulo","operands":[1,2]}`,
			http.StatusUnprocessableEntity,
			"invalid_operation",
			"",
		},
		{
			"wrong arity",
			`{"operation":"add","operands":[1]}`,
			http.StatusUnprocessableEntity,
			"invalid_operand_count",
			"",
		},
		{
			"missing operands",
			`{"operation":"add"}`,
			http.StatusUnprocessableEntity,
			"invalid_operand_count",
			"",
		},
		{
			"percentage on the left",
			`{"operation":"add","operands":[{"value":10,"percent":true},200]}`,
			http.StatusUnprocessableEntity,
			"invalid_percent_usage",
			"operands[0]",
		},
		{
			"percentage in exponentiation",
			`{"operation":"exponentiate","operands":[2,{"value":10,"percent":true}]}`,
			http.StatusUnprocessableEntity,
			"invalid_percent_usage",
			"operands[1]",
		},
		{
			"percentage in square root",
			`{"operation":"sqrt","operands":[{"value":25,"percent":true}]}`,
			http.StatusUnprocessableEntity,
			"invalid_percent_usage",
			"operands[0]",
		},
		{
			"negative square root",
			`{"operation":"sqrt","operands":[-4]}`,
			http.StatusUnprocessableEntity,
			"negative_sqrt",
			"",
		},
		{
			"non-finite result",
			`{"operation":"multiply","operands":[1e308,10]}`,
			http.StatusUnprocessableEntity,
			"non_finite_result",
			"",
		},
		{
			"non-finite power",
			`{"operation":"exponentiate","operands":[10,400]}`,
			http.StatusUnprocessableEntity,
			"non_finite_result",
			"",
		},
		{
			"too deep",
			chainBody(17),
			http.StatusUnprocessableEntity,
			"expression_too_deep",
			"operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1].operands[1]",
		},
		{
			"too large",
			fullTreeBody(7),
			http.StatusUnprocessableEntity,
			"expression_too_large",
			"operands[1]",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := doRequest(t, newTestHandler(), http.MethodPost, "/api/v1/calculate", test.body)

			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, test.wantStatus, recorder.Body.String())
			}

			var got errorBody
			if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if got.Error.Code != test.wantCode {
				t.Fatalf("code = %q, want %q (body: %s)", got.Error.Code, test.wantCode, recorder.Body.String())
			}
			if got.Error.Path != test.wantPath {
				t.Fatalf("path = %q, want %q", got.Error.Path, test.wantPath)
			}
			if got.Error.Message == "" {
				t.Fatal("expected a non-empty error message")
			}
		})
	}
}

func TestRequestBodyTooLarge(t *testing.T) {
	body := `{"operation":"add","operands":[1,2],"padding":"` +
		strings.Repeat("x", maxBodyBytes) + `"}`

	recorder := doRequest(t, newTestHandler(), http.MethodPost, "/api/v1/calculate", body)
	if recorder.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusRequestEntityTooLarge)
	}

	var got errorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if got.Error.Code != "request_too_large" {
		t.Fatalf("code = %q", got.Error.Code)
	}
}

func TestHealth(t *testing.T) {
	recorder := doRequest(t, newTestHandler(), http.MethodGet, "/healthz", "")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if body := strings.TrimSpace(recorder.Body.String()); body != `{"status":"ok"}` {
		t.Fatalf("body = %q", body)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	recorder := doRequest(t, newTestHandler(), http.MethodGet, "/api/v1/calculate", "")
	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
	if allow := recorder.Header().Get("Allow"); !strings.Contains(allow, http.MethodPost) {
		t.Fatalf("Allow = %q, want it to contain POST", allow)
	}
}

func TestPreflight(t *testing.T) {
	recorder := doRequest(t, newTestHandler(), http.MethodOptions, "/api/v1/calculate", "")
	if recorder.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if origin := recorder.Header().Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q", origin)
	}
}

func TestRecovery(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	panicking := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	})

	recorder := httptest.NewRecorder()
	withRecovery(logger, panicking).ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/boom", nil))

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
	var got errorBody
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if got.Error.Code != "internal_error" {
		t.Fatalf("code = %q", got.Error.Code)
	}
}

func newTestHandler() http.Handler {
	return NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func doRequest(t *testing.T, handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	handler.ServeHTTP(recorder, request)
	return recorder
}

// chainBody builds an expression nested to the given depth:
// add(1, add(1, ...)).
func chainBody(depth int) string {
	body := `{"operation":"add","operands":[1,2]}`
	for i := 1; i < depth; i++ {
		body = fmt.Sprintf(`{"operation":"add","operands":[1,%s]}`, body)
	}
	return body
}

// fullTreeBody builds a complete binary tree with the given number of levels.
func fullTreeBody(levels int) string {
	if levels == 1 {
		return `{"operation":"add","operands":[1,2]}`
	}
	child := fullTreeBody(levels - 1)
	return fmt.Sprintf(`{"operation":"add","operands":[%s,%s]}`, child, child)
}
