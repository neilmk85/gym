package middleware

import (
	"net"
	"net/http"
	"sync"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/response"
)

type rateLimitEntry struct {
	count    int
	windowAt time.Time
	mu       sync.Mutex
}

// RateLimit is a per-IP sliding-window rate limiter (in-memory, no Redis).
// Phase 3 will replace this with Redis-backed limiting.
func RateLimit(requests int, window time.Duration) func(http.Handler) http.Handler {
	var mu sync.Mutex
	entries := make(map[string]*rateLimitEntry)

	// Prune old entries every 5 minutes.
	go func() {
		t := time.NewTicker(5 * time.Minute)
		for range t.C {
			mu.Lock()
			now := time.Now()
			for ip, e := range entries {
				e.mu.Lock()
				if now.Sub(e.windowAt) > window {
					delete(entries, ip)
				}
				e.mu.Unlock()
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip, _, _ := net.SplitHostPort(r.RemoteAddr)
			if ip == "" {
				ip = r.RemoteAddr
			}

			mu.Lock()
			entry, ok := entries[ip]
			if !ok {
				entry = &rateLimitEntry{windowAt: time.Now()}
				entries[ip] = entry
			}
			mu.Unlock()

			entry.mu.Lock()
			now := time.Now()
			if now.Sub(entry.windowAt) > window {
				entry.count = 0
				entry.windowAt = now
			}
			entry.count++
			count := entry.count
			entry.mu.Unlock()

			if count > requests {
				response.Error(w, r, apperrors.ErrRateLimit)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
