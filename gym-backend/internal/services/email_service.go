package services

import (
	"fmt"
	"log/slog"
	"net/smtp"

	"gym-backend/internal/config"
)

// EmailService sends transactional emails.
type EmailService interface {
	SendEmailVerification(to, firstName, otp string) error
	SendPasswordReset(to, firstName, otp string) error
	SendPasswordChanged(to, firstName string) error
}

// ─── Factory ──────────────────────────────────────────────────────────────────

// NewEmailService returns a real SMTP implementation when SMTP_HOST is
// configured, otherwise falls back to the console logger (development).
func NewEmailService(cfg config.SMTPConfig, logger *slog.Logger) EmailService {
	if cfg.Host == "" {
		logger.Warn("SMTP_HOST not set — emails will be logged to console only")
		return NewConsoleEmailService(logger)
	}
	return &smtpEmailService{
		host:     cfg.Host,
		port:     cfg.Port,
		user:     cfg.User,
		password: cfg.Password,
		from:     cfg.From,
		logger:   logger,
	}
}

// ─── SMTP implementation ──────────────────────────────────────────────────────

type smtpEmailService struct {
	host     string
	port     int
	user     string
	password string
	from     string
	logger   *slog.Logger
}

func (s *smtpEmailService) send(to, subject, htmlBody string) error {
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)
	msg := []byte(
		"From: " + s.from + "\r\n" +
			"To: " + to + "\r\n" +
			"Subject: " + subject + "\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"\r\n" +
			htmlBody,
	)
	if err := smtp.SendMail(addr, auth, s.from, []string{to}, msg); err != nil {
		s.logger.Error("smtp send failed", "to", to, "subject", subject, "err", err)
		return err
	}
	return nil
}

func (s *smtpEmailService) SendEmailVerification(to, firstName, otp string) error {
	subject := "Verify your email — Gym App"
	body := fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2>Hi %s 👋</h2>
<p>Welcome! Please verify your email address using the code below.</p>
<div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
  <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a1a">%s</span>
</div>
<p>This code expires in <strong>10 minutes</strong>.</p>
<p>If you didn't create an account, you can safely ignore this email.</p>
</body></html>`, firstName, otp)
	return s.send(to, subject, body)
}

func (s *smtpEmailService) SendPasswordReset(to, firstName, otp string) error {
	subject := "Reset your password — Gym App"
	body := fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2>Hi %s,</h2>
<p>We received a request to reset your password. Use the code below to proceed.</p>
<div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
  <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a1a1a">%s</span>
</div>
<p>This code expires in <strong>10 minutes</strong>.</p>
<p>If you didn't request a password reset, please ignore this email or contact support.</p>
</body></html>`, firstName, otp)
	return s.send(to, subject, body)
}

func (s *smtpEmailService) SendPasswordChanged(to, firstName string) error {
	subject := "Your password was changed — Gym App"
	body := fmt.Sprintf(`<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2>Hi %s,</h2>
<p>Your Gym App password was successfully changed.</p>
<p>If you made this change, no action is needed.</p>
<p>If you did <strong>not</strong> make this change, please contact support immediately.</p>
</body></html>`, firstName)
	// Non-critical — log error but don't surface it to the caller.
	if err := s.send(to, subject, body); err != nil {
		s.logger.Error("password-changed email failed", "to", to, "err", err)
	}
	return nil
}

// ─── Console implementation (development fallback) ────────────────────────────

type consoleEmailService struct {
	logger *slog.Logger
}

func NewConsoleEmailService(logger *slog.Logger) EmailService {
	return &consoleEmailService{logger: logger}
}

func (s *consoleEmailService) SendEmailVerification(to, firstName, otp string) error {
	s.logger.Info("📧 email_verification",
		"to", to, "name", firstName, "otp", otp,
		"note", "set SMTP_HOST to send real emails",
	)
	return nil
}

func (s *consoleEmailService) SendPasswordReset(to, firstName, otp string) error {
	s.logger.Info("📧 password_reset",
		"to", to, "name", firstName, "otp", otp,
		"note", "set SMTP_HOST to send real emails",
	)
	return nil
}

func (s *consoleEmailService) SendPasswordChanged(to, firstName string) error {
	s.logger.Info("📧 password_changed", "to", to, "name", firstName)
	return nil
}
