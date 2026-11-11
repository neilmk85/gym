package response

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
)

type envelope struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *errBody    `json:"error,omitempty"`
	Meta    meta        `json:"meta"`
}

type errBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

type meta struct {
	Timestamp string `json:"timestamp"`
	RequestID string `json:"request_id,omitempty"`
}

type contextKey string

const RequestIDKey contextKey = "request_id"

func JSON(w http.ResponseWriter, r *http.Request, status int, data interface{}) {
	write(w, r, status, &envelope{
		Success: true,
		Data:    data,
		Meta:    buildMeta(r.Context()),
	})
}

func Error(w http.ResponseWriter, r *http.Request, err error) {
	ae, ok := apperrors.As(err)
	if !ok {
		ae = apperrors.ErrInternal
	}
	write(w, r, ae.HTTPStatus, &envelope{
		Success: false,
		Error: &errBody{
			Code:    ae.Code,
			Message: ae.Message,
			Details: ae.Details,
		},
		Meta: buildMeta(r.Context()),
	})
}

func write(w http.ResponseWriter, _ *http.Request, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("response encode error", "err", err)
	}
}

func buildMeta(ctx context.Context) meta {
	m := meta{Timestamp: time.Now().UTC().Format(time.RFC3339)}
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		m.RequestID = id
	}
	return m
}
