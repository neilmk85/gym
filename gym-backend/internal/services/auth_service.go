package services

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"regexp"
	"time"
	"unicode"

	"golang.org/x/crypto/bcrypt"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/config"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"

	"github.com/golang-jwt/jwt/v5"
)

const (
	maxFailedLogins     = 20
	lockDuration        = 30 * time.Minute
	maxOTPRequestsPerHr = 3
	maxOTPAttempts      = 5
	maxActiveTokens     = 3
	passwordHistorySize = 5
)

// ─── DTOs ───────────────────────────────────────────────────────────────────

type SignupRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Phone     string `json:"phone"`
	Password  string `json:"password"`
	Role      string `json:"role"` // omit = "member"
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

type UserInfo struct {
	ID            uint   `json:"id"`
	Email         string `json:"email"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	Role          string `json:"role"`
	EmailVerified bool   `json:"email_verified"`
}

type LoginResponse struct {
	Tokens TokenPair `json:"tokens"`
	User   UserInfo  `json:"user"`
}

type Claims struct {
	UserID        uint   `json:"user_id"`
	Email         string `json:"email"`
	Role          string `json:"role"`
	EmailVerified bool   `json:"email_verified"`
	jwt.RegisteredClaims
}

// ─── Service ─────────────────────────────────────────────────────────────────

type AuthService interface {
	Signup(req SignupRequest) (*UserInfo, error)
	VerifyEmail(email, otp string) error
	ResendVerification(email string) error
	Login(req LoginRequest, ipAddress, userAgent string) (*LoginResponse, error)
	RefreshToken(rawToken string) (*TokenPair, error)
	Logout(rawToken string) error
	ForgotPassword(email string) error
	ResetPassword(email, otp, newPassword string) error
	ChangePassword(userID uint, currentPassword, newPassword string) error
	ValidateAccessToken(tokenStr string) (*Claims, error)
	GetUserByID(userID uint) (*models.User, error)
	UpdateProfile(userID uint, firstName, lastName, phone string) (*models.User, error)
}

type authService struct {
	userRepo    repositories.UserRepository
	tokenRepo   repositories.RefreshTokenRepository
	otpRepo     repositories.OTPRepository
	emailSvc    EmailService
	jwtCfg      config.JWTConfig
	logger      *slog.Logger
}

func NewAuthService(
	userRepo repositories.UserRepository,
	tokenRepo repositories.RefreshTokenRepository,
	otpRepo repositories.OTPRepository,
	emailSvc EmailService,
	jwtCfg config.JWTConfig,
	logger *slog.Logger,
) AuthService {
	return &authService{
		userRepo:  userRepo,
		tokenRepo: tokenRepo,
		otpRepo:   otpRepo,
		emailSvc:  emailSvc,
		jwtCfg:    jwtCfg,
		logger:    logger,
	}
}

// ─── Signup ──────────────────────────────────────────────────────────────────

func (s *authService) Signup(req SignupRequest) (*UserInfo, error) {
	if err := validateSignupRequest(req); err != nil {
		return nil, err
	}

	existing, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if existing != nil {
		return nil, apperrors.ErrEmailExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, apperrors.ErrInternal
	}

	role := req.Role
	if role == "" {
		role = "member"
	}

	user := &models.User{
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: string(hash),
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         role,
		Status:       "active",
	}
	if err := s.userRepo.Create(user); err != nil {
		s.logger.Error("create user failed", "err", err)
		return nil, apperrors.ErrInternal
	}

	if err := s.sendEmailVerificationOTP(user); err != nil {
		s.logger.Error("send verification otp failed", "user_id", user.ID, "err", err)
	}

	return toUserInfo(user), nil
}

// ─── Email Verification ──────────────────────────────────────────────────────

func (s *authService) VerifyEmail(email, otp string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		return apperrors.ErrMemberNotFound
	}
	if user.EmailVerified {
		return nil // idempotent
	}

	return s.validateAndConsumeOTP(user.ID, models.OTPPurposeEmailVerification, otp, func() error {
		return s.userRepo.MarkEmailVerified(user.ID)
	})
}

func (s *authService) ResendVerification(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		return apperrors.ErrMemberNotFound
	}
	if user.EmailVerified {
		return nil
	}
	return s.sendEmailVerificationOTP(user)
}

// ─── Login ───────────────────────────────────────────────────────────────────

func (s *authService) Login(req LoginRequest, ipAddress, userAgent string) (*LoginResponse, error) {
	if req.Email == "" || req.Password == "" {
		return nil, apperrors.ErrValidation("email and password are required")
	}

	user, err := s.userRepo.FindByEmail(req.Email)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if user == nil {
		return nil, apperrors.ErrInvalidCredentials
	}

	if user.IsLocked() {
		return nil, apperrors.ErrAccountLocked
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		s.handleFailedLogin(user)
		return nil, apperrors.ErrInvalidCredentials
	}

	if !user.EmailVerified {
		return nil, apperrors.ErrEmailNotVerified
	}

	// Reset failed login counter on success.
	_ = s.userRepo.ResetFailedLogins(user.ID)

	// Enforce max concurrent sessions.
	count, _ := s.tokenRepo.CountActiveForUser(user.ID)
	if count >= maxActiveTokens {
		// Revoke oldest tokens to make room — simplest: revoke all then issue fresh.
		_ = s.tokenRepo.RevokeAllForUser(user.ID)
	}

	tokens, err := s.issueTokenPair(user, ipAddress, userAgent)
	if err != nil {
		return nil, err
	}

	return &LoginResponse{Tokens: *tokens, User: *toUserInfo(user)}, nil
}

func (s *authService) handleFailedLogin(user *models.User) {
	_ = s.userRepo.IncrementFailedLogins(user.ID)
	// Re-fetch to get updated count.
	updated, err := s.userRepo.FindByID(user.ID)
	if err != nil || updated == nil {
		return
	}
	if updated.FailedLoginAttempts >= maxFailedLogins {
		until := time.Now().Add(lockDuration)
		_ = s.userRepo.LockAccount(user.ID, until)
		s.logger.Warn("account locked", "user_id", user.ID, "until", until)
	}
}

// ─── Token Refresh ───────────────────────────────────────────────────────────

func (s *authService) RefreshToken(rawToken string) (*TokenPair, error) {
	hash := hashToken(rawToken)
	stored, err := s.tokenRepo.FindByHash(hash)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if stored == nil || !stored.IsValid() {
		return nil, apperrors.ErrTokenInvalid
	}

	user, err := s.userRepo.FindByID(stored.UserID)
	if err != nil || user == nil || user.Status != "active" {
		return nil, apperrors.ErrTokenInvalid
	}

	// Rotate: revoke old, issue new.
	_ = s.tokenRepo.Revoke(stored.ID)
	return s.issueTokenPair(user, stored.IPAddress, stored.DeviceInfo)
}

// ─── Logout ──────────────────────────────────────────────────────────────────

func (s *authService) Logout(rawToken string) error {
	hash := hashToken(rawToken)
	stored, err := s.tokenRepo.FindByHash(hash)
	if err != nil {
		return apperrors.ErrInternal
	}
	if stored == nil {
		return nil // already gone
	}
	return s.tokenRepo.Revoke(stored.ID)
}

// ─── Forgot Password ─────────────────────────────────────────────────────────

func (s *authService) ForgotPassword(email string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil {
		return apperrors.ErrInternal
	}
	// Don't reveal whether email exists.
	if user == nil {
		return nil
	}

	// Rate-limit: max 3 OTPs per hour.
	count, err := s.otpRepo.CountRecentByUserAndPurpose(user.ID, models.OTPPurposePasswordReset, time.Now().Add(-time.Hour))
	if err != nil {
		return apperrors.ErrInternal
	}
	if count >= maxOTPRequestsPerHr {
		return apperrors.New(http.StatusTooManyRequests, "AUTH_008", "Too many reset requests", "Max 3 requests per hour")
	}

	otp, err := generateOTP(6)
	if err != nil {
		return apperrors.ErrInternal
	}

	otpRecord := &models.OTPCode{
		UserID:    user.ID,
		Code:      otp,
		Purpose:   models.OTPPurposePasswordReset,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.otpRepo.Create(otpRecord); err != nil {
		return apperrors.ErrInternal
	}

	_ = s.emailSvc.SendPasswordReset(user.Email, user.FirstName, otp)
	return nil
}

// ─── Reset Password ──────────────────────────────────────────────────────────

func (s *authService) ResetPassword(email, otp, newPassword string) error {
	user, err := s.userRepo.FindByEmail(email)
	if err != nil || user == nil {
		return apperrors.ErrMemberNotFound
	}

	if err := validatePassword(newPassword); err != nil {
		return err
	}

	if err := s.validateAndConsumeOTP(user.ID, models.OTPPurposePasswordReset, otp, func() error {
		return s.updatePassword(user, newPassword)
	}); err != nil {
		return err
	}

	// Revoke all sessions after password reset.
	_ = s.tokenRepo.RevokeAllForUser(user.ID)
	_ = s.emailSvc.SendPasswordChanged(user.Email, user.FirstName)
	return nil
}

// ─── Change Password ─────────────────────────────────────────────────────────

func (s *authService) ChangePassword(userID uint, currentPassword, newPassword string) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil || user == nil {
		return apperrors.ErrMemberNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return apperrors.ErrInvalidCredentials
	}

	if err := validatePassword(newPassword); err != nil {
		return err
	}
	if err := s.updatePassword(user, newPassword); err != nil {
		return err
	}

	_ = s.emailSvc.SendPasswordChanged(user.Email, user.FirstName)
	return nil
}

// ─── Validate Access Token ───────────────────────────────────────────────────

func (s *authService) ValidateAccessToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.jwtCfg.Secret), nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, apperrors.ErrTokenExpired
		}
		return nil, apperrors.ErrTokenInvalid
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, apperrors.ErrTokenInvalid
	}
	return claims, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func (s *authService) issueTokenPair(user *models.User, ipAddress, deviceInfo string) (*TokenPair, error) {
	now := time.Now()
	claims := Claims{
		UserID:        user.ID,
		Email:         user.Email,
		Role:          user.Role,
		EmailVerified: user.EmailVerified,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   fmt.Sprintf("%d", user.ID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.jwtCfg.AccessExpiry)),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.jwtCfg.Secret))
	if err != nil {
		return nil, apperrors.ErrInternal
	}

	// Generate a secure random refresh token.
	rawToken, err := generateSecureToken(32)
	if err != nil {
		return nil, apperrors.ErrInternal
	}

	rtRecord := &models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  hashToken(rawToken),
		DeviceInfo: deviceInfo,
		IPAddress:  ipAddress,
		ExpiresAt:  now.Add(s.jwtCfg.RefreshExpiry),
	}
	if err := s.tokenRepo.Create(rtRecord); err != nil {
		return nil, apperrors.ErrInternal
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawToken,
		TokenType:    "Bearer",
		ExpiresIn:    int(s.jwtCfg.AccessExpiry.Seconds()),
	}, nil
}

func (s *authService) sendEmailVerificationOTP(user *models.User) error {
	otp, err := generateOTP(6)
	if err != nil {
		return err
	}
	otpRecord := &models.OTPCode{
		UserID:    user.ID,
		Code:      otp,
		Purpose:   models.OTPPurposeEmailVerification,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := s.otpRepo.Create(otpRecord); err != nil {
		return err
	}
	return s.emailSvc.SendEmailVerification(user.Email, user.FirstName, otp)
}

func (s *authService) validateAndConsumeOTP(userID uint, purpose, code string, onSuccess func() error) error {
	record, err := s.otpRepo.FindLatestByUserAndPurpose(userID, purpose)
	if err != nil {
		return apperrors.ErrInternal
	}
	if record == nil {
		return apperrors.ErrOTPInvalid
	}
	if !record.IsValid() {
		return apperrors.ErrOTPExpired
	}
	if record.Attempts >= maxOTPAttempts {
		return apperrors.New(http.StatusBadRequest, "AUTH_009", "OTP locked", "Too many invalid attempts")
	}
	if record.Code != code {
		_ = s.otpRepo.IncrementAttempts(record.ID)
		return apperrors.ErrOTPInvalid
	}
	if err := s.otpRepo.MarkUsed(record.ID); err != nil {
		return apperrors.ErrInternal
	}
	return onSuccess()
}

func (s *authService) updatePassword(user *models.User, newPassword string) error {
	// Check password history (last 5).
	for _, oldHash := range user.PasswordHistory {
		if err := bcrypt.CompareHashAndPassword([]byte(oldHash), []byte(newPassword)); err == nil {
			return apperrors.ErrValidation("password must differ from your last 5 passwords")
		}
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return apperrors.ErrInternal
	}

	// Prepend current hash to history, keep last 5.
	history := append(models.StringSlice{user.PasswordHash}, user.PasswordHistory...)
	if len(history) > passwordHistorySize {
		history = history[:passwordHistorySize]
	}

	return s.userRepo.UpdatePassword(user.ID, string(newHash), history)
}

// ─── Pure helpers (no receivers) ─────────────────────────────────────────────

func toUserInfo(u *models.User) *UserInfo {
	return &UserInfo{
		ID:            u.ID,
		Email:         u.Email,
		FirstName:     u.FirstName,
		LastName:      u.LastName,
		Role:          u.Role,
		EmailVerified: u.EmailVerified,
	}
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func generateOTP(digits int) (string, error) {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", digits, n), nil
}

func generateSecureToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

var emailRe = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

func validateSignupRequest(req SignupRequest) error {
	if req.FirstName == "" {
		return apperrors.ErrValidation("first_name is required")
	}
	if req.LastName == "" {
		return apperrors.ErrValidation("last_name is required")
	}
	if req.Email == "" || !emailRe.MatchString(req.Email) {
		return apperrors.ErrValidation("valid email is required")
	}
	return validatePassword(req.Password)
}

func validatePassword(p string) error {
	if len(p) < 8 {
		return apperrors.ErrValidation("password must be at least 8 characters")
	}
	var hasUpper, hasDigit, hasSpecial bool
	for _, c := range p {
		switch {
		case unicode.IsUpper(c):
			hasUpper = true
		case unicode.IsDigit(c):
			hasDigit = true
		case unicode.IsPunct(c) || unicode.IsSymbol(c):
			hasSpecial = true
		}
	}
	if !hasUpper {
		return apperrors.ErrValidation("password must contain at least one uppercase letter")
	}
	if !hasDigit {
		return apperrors.ErrValidation("password must contain at least one number")
	}
	if !hasSpecial {
		return apperrors.ErrValidation("password must contain at least one special character")
	}
	return nil
}

func (s *authService) GetUserByID(userID uint) (*models.User, error) {
	u, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperrors.New(http.StatusNotFound, "AUTH_010", "user not found", "")
	}
	return u, nil
}

func (s *authService) UpdateProfile(userID uint, firstName, lastName, phone string) (*models.User, error) {
	u, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperrors.New(http.StatusNotFound, "AUTH_010", "user not found", "")
	}
	if firstName != "" {
		u.FirstName = firstName
	}
	if lastName != "" {
		u.LastName = lastName
	}
	u.Phone = phone
	if err := s.userRepo.Update(u); err != nil {
		return nil, err
	}
	return u, nil
}
