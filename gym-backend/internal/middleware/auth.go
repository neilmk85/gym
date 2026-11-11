package middleware

import (
	"context"
	"net/http"
	"strings"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type authContextKey string

const (
	ClaimsKey authContextKey = "claims"
)

// Authenticate validates the JWT and injects claims into the request context.
func Authenticate(authSvc services.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := extractBearerToken(r)
			if token == "" {
				response.Error(w, r, apperrors.ErrTokenInvalid)
				return
			}

			claims, err := authSvc.ValidateAccessToken(token)
			if err != nil {
				response.Error(w, r, err)
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireRoles returns a middleware that allows only the given roles.
func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := ClaimsFromContext(r.Context())
			if claims == nil {
				response.Error(w, r, apperrors.ErrPermissionDenied)
				return
			}
			if _, ok := allowed[claims.Role]; !ok {
				response.Error(w, r, apperrors.ErrPermissionDenied)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// ClaimsFromContext extracts JWT claims from the context (nil if not present).
func ClaimsFromContext(ctx context.Context) *services.Claims {
	c, _ := ctx.Value(ClaimsKey).(*services.Claims)
	return c
}

func extractBearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return parts[1]
}
