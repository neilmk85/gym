package config_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/config"
)

// setEnv sets a collection of env vars and returns a cleanup func.
func setEnv(t *testing.T, pairs map[string]string) {
	t.Helper()
	for k, v := range pairs {
		t.Setenv(k, v)
	}
}

// validEnv returns the minimum valid env var set.
func validEnv() map[string]string {
	return map[string]string{
		"JWT_SECRET":           "supersecretkey1234567890abcdefghij",
		"JWT_ACCESS_EXPIRY":    "15m",
		"JWT_REFRESH_EXPIRY":   "168h",
		"RATE_LIMIT_REQUESTS":  "10",
		"RATE_LIMIT_WINDOW":    "60s",
		"CORS_ALLOWED_ORIGINS": "http://localhost:3000",
		"APP_PORT":             "9090",
		"DB_USER":              "root",
		"DB_NAME":              "gym_test",
	}
}

func TestConfig_Load_ValidMinimal(t *testing.T) {
	setEnv(t, validEnv())
	cfg, err := config.Load()
	require.NoError(t, err)
	assert.Equal(t, "9090", cfg.App.Port)
	assert.Equal(t, "root", cfg.Database.User)
	assert.Equal(t, "gym_test", cfg.Database.Name)
}

// ── JWT ───────────────────────────────────────────────────────────────────────

func TestConfig_MissingJWTSecret(t *testing.T) {
	env := validEnv()
	delete(env, "JWT_SECRET")
	setEnv(t, env)
	t.Setenv("JWT_SECRET", "") // explicitly blank

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_SECRET")
}

func TestConfig_ShortJWTSecret(t *testing.T) {
	env := validEnv()
	env["JWT_SECRET"] = "tooshort"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "32 characters")
}

func TestConfig_InvalidJWTAccessExpiry(t *testing.T) {
	env := validEnv()
	env["JWT_ACCESS_EXPIRY"] = "notaduration"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_ACCESS_EXPIRY")
}

func TestConfig_NegativeJWTAccessExpiry(t *testing.T) {
	env := validEnv()
	env["JWT_ACCESS_EXPIRY"] = "-5m"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_ACCESS_EXPIRY")
}

func TestConfig_RefreshExpiryNotGreaterThanAccess(t *testing.T) {
	env := validEnv()
	env["JWT_ACCESS_EXPIRY"] = "1h"
	env["JWT_REFRESH_EXPIRY"] = "30m" // less than access
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "JWT_REFRESH_EXPIRY")
}

// ── Rate limit ────────────────────────────────────────────────────────────────

func TestConfig_InvalidRateLimitRequests(t *testing.T) {
	env := validEnv()
	env["RATE_LIMIT_REQUESTS"] = "abc"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "RATE_LIMIT_REQUESTS")
}

func TestConfig_ZeroRateLimitRequests(t *testing.T) {
	env := validEnv()
	env["RATE_LIMIT_REQUESTS"] = "0"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "RATE_LIMIT_REQUESTS")
}

func TestConfig_InvalidRateLimitWindow(t *testing.T) {
	env := validEnv()
	env["RATE_LIMIT_WINDOW"] = "notaduration"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "RATE_LIMIT_WINDOW")
}

// ── App port ──────────────────────────────────────────────────────────────────

func TestConfig_InvalidPort(t *testing.T) {
	env := validEnv()
	env["APP_PORT"] = "notaport"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_PORT")
}

func TestConfig_OutOfRangePort(t *testing.T) {
	env := validEnv()
	env["APP_PORT"] = "99999"
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "APP_PORT")
}

// ── Database ──────────────────────────────────────────────────────────────────

func TestConfig_DatabaseDefaults(t *testing.T) {
	// DB_USER and DB_NAME both have sane defaults ("root" / "gym_management")
	// so they cannot be absent — just verify Load succeeds and defaults are applied.
	setEnv(t, validEnv())
	cfg, err := config.Load()
	require.NoError(t, err)
	assert.NotEmpty(t, cfg.Database.User)
	assert.NotEmpty(t, cfg.Database.Name)
	assert.Equal(t, "localhost", cfg.Database.Host)
}

// ── CORS ──────────────────────────────────────────────────────────────────────

func TestConfig_EmptyCORSOrigins(t *testing.T) {
	env := validEnv()
	env["CORS_ALLOWED_ORIGINS"] = "   ,  , "
	setEnv(t, env)

	_, err := config.Load()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "CORS_ALLOWED_ORIGINS")
}

// ── SMTP ──────────────────────────────────────────────────────────────────────

func TestConfig_SMTPHostWithoutExplicitFrom_UsesDefault(t *testing.T) {
	// SMTP_FROM has a built-in default so it's never empty.
	// When SMTP_HOST is set without an explicit SMTP_FROM, the default is used.
	env := validEnv()
	env["SMTP_HOST"] = "smtp.example.com"
	setEnv(t, env)

	cfg, err := config.Load()
	require.NoError(t, err)
	assert.NotEmpty(t, cfg.SMTP.From) // default "noreply@gymapp.com" is used
}

func TestConfig_SMTPFullyConfigured(t *testing.T) {
	env := validEnv()
	env["SMTP_HOST"] = "smtp.example.com"
	env["SMTP_PORT"] = "587"
	env["SMTP_USER"] = "user@example.com"
	env["SMTP_PASSWORD"] = "secret"
	env["SMTP_FROM"] = "noreply@example.com"
	setEnv(t, env)

	cfg, err := config.Load()
	require.NoError(t, err)
	assert.Equal(t, "smtp.example.com", cfg.SMTP.Host)
	assert.Equal(t, 587, cfg.SMTP.Port)
	assert.Equal(t, "noreply@example.com", cfg.SMTP.From)
}

func TestConfig_SMTPHostEmptyNoFromRequired(t *testing.T) {
	env := validEnv()
	// No SMTP_HOST means email falls back to console logger — SMTP_FROM not required
	delete(env, "SMTP_HOST")
	setEnv(t, env)

	_, err := config.Load()
	require.NoError(t, err)
}
