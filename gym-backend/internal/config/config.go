package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	App       AppConfig
	Database  DatabaseConfig
	JWT       JWTConfig
	RateLimit RateLimitConfig
	CORS      CORSConfig
	SMTP      SMTPConfig
}

type SMTPConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
}

type AppConfig struct {
	Env  string
	Port string
}

type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type RateLimitConfig struct {
	Requests int
	Window   time.Duration
}

type CORSConfig struct {
	AllowedOrigins []string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{}

	// ── App ───────────────────────────────────────────────────────────────────
	cfg.App.Env = getEnv("APP_ENV", "development")
	cfg.App.Port = getEnv("APP_PORT", "9090")
	if p, err := strconv.Atoi(cfg.App.Port); err != nil || p < 1 || p > 65535 {
		return nil, fmt.Errorf("APP_PORT must be a valid port number (1-65535), got %q", cfg.App.Port)
	}

	// ── Database ──────────────────────────────────────────────────────────────
	cfg.Database.Host = getEnv("DB_HOST", "localhost")
	cfg.Database.Port = getEnv("DB_PORT", "3306")
	cfg.Database.User = getEnv("DB_USER", "root")
	cfg.Database.Password = getEnv("DB_PASSWORD", "")
	cfg.Database.Name = getEnv("DB_NAME", "gym_management")

	// ── JWT ───────────────────────────────────────────────────────────────────
	cfg.JWT.Secret = getEnv("JWT_SECRET", "")
	if cfg.JWT.Secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}
	if len(cfg.JWT.Secret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 characters")
	}

	var err error
	cfg.JWT.AccessExpiry, err = time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_EXPIRY: %w", err)
	}
	if cfg.JWT.AccessExpiry <= 0 {
		return nil, fmt.Errorf("JWT_ACCESS_EXPIRY must be positive")
	}

	cfg.JWT.RefreshExpiry, err = time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_EXPIRY: %w", err)
	}
	if cfg.JWT.RefreshExpiry <= cfg.JWT.AccessExpiry {
		return nil, fmt.Errorf("JWT_REFRESH_EXPIRY must be greater than JWT_ACCESS_EXPIRY")
	}

	// ── Rate limit ────────────────────────────────────────────────────────────
	requests, err := strconv.Atoi(getEnv("RATE_LIMIT_REQUESTS", "10"))
	if err != nil {
		return nil, fmt.Errorf("invalid RATE_LIMIT_REQUESTS: %w", err)
	}
	if requests <= 0 {
		return nil, fmt.Errorf("RATE_LIMIT_REQUESTS must be greater than 0")
	}
	cfg.RateLimit.Requests = requests

	cfg.RateLimit.Window, err = time.ParseDuration(getEnv("RATE_LIMIT_WINDOW", "60s"))
	if err != nil {
		return nil, fmt.Errorf("invalid RATE_LIMIT_WINDOW: %w", err)
	}
	if cfg.RateLimit.Window <= 0 {
		return nil, fmt.Errorf("RATE_LIMIT_WINDOW must be positive")
	}

	// ── CORS ──────────────────────────────────────────────────────────────────
	cfg.CORS.AllowedOrigins = splitTrim(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000"), ",")
	if len(cfg.CORS.AllowedOrigins) == 0 {
		return nil, fmt.Errorf("CORS_ALLOWED_ORIGINS must contain at least one origin")
	}

	// ── SMTP (optional — falls back to console logger when Host is empty) ─────
	cfg.SMTP.Host     = getEnv("SMTP_HOST", "")
	cfg.SMTP.Port, _  = strconv.Atoi(getEnv("SMTP_PORT", "587"))
	cfg.SMTP.User     = getEnv("SMTP_USER", "")
	cfg.SMTP.Password = getEnv("SMTP_PASSWORD", "")
	cfg.SMTP.From     = getEnv("SMTP_FROM", "noreply@gymapp.com")
	// SMTP_FROM has a default so it can never be empty via getEnv.
	// If SMTP_HOST is set without explicit credentials that is intentional
	// (some relays allow unauthenticated localhost delivery).

	return cfg, nil
}

func (d *DatabaseConfig) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		d.User, d.Password, d.Host, d.Port, d.Name)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func splitTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
