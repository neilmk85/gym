package middleware

import (
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
)

// maxBodyBytes is the maximum accepted request body size (1 MiB).
const maxBodyBytes = 1 << 20 // 1 MiB

// BodyLimit caps the incoming request body at maxBodyBytes to prevent
// memory exhaustion attacks.
func BodyLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body != nil {
			r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		}
		next.ServeHTTP(w, r)
	})
}

// handleBodyTooLarge checks whether the reader hit the MaxBytesReader limit
// and writes a 413 response. Call this in handlers after json.Decode if you
// want a friendly error message.
func HandleBodyTooLarge(w http.ResponseWriter, r *http.Request, err error) bool {
	if err != nil && err.Error() == "http: request body too large" {
		response.Error(w, r, apperrors.New(http.StatusRequestEntityTooLarge, "REQ_001",
			"Request body too large (max 1 MiB)", ""))
		return true
	}
	return false
}
