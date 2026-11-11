package services_test

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/config"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
)

// newAuthSvc builds an AuthService wired to fresh mocks.
func newAuthSvc(t *testing.T) (services.AuthService, *testhelpers.MockUserRepo, *testhelpers.MockOTPRepo, *testhelpers.MockEmailService) {
	t.Helper()
	userRepo  := testhelpers.NewMockUserRepo()
	tokenRepo := testhelpers.NewMockTokenRepo()
	otpRepo   := testhelpers.NewMockOTPRepo()
	emailSvc  := &testhelpers.MockEmailService{}
	logger    := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	cfg := config.JWTConfig{
		Secret:        "super-secret-key-at-least-32-chars!!",
		AccessExpiry:  15 * time.Minute,
		RefreshExpiry: 7 * 24 * time.Hour,
	}
	svc := services.NewAuthService(userRepo, tokenRepo, otpRepo, emailSvc, cfg, logger)
	return svc, userRepo, otpRepo, emailSvc
}

// ─── Signup ───────────────────────────────────────────────────────────────────

func TestSignup_Success(t *testing.T) {
	svc, userRepo, _, emailSvc := newAuthSvc(t)

	info, err := svc.Signup(services.SignupRequest{
		FirstName: "Alice",
		LastName:  "Smith",
		Email:     "alice@example.com",
		Password:  "SecurePass@1",
	})

	require.NoError(t, err)
	assert.Equal(t, "alice@example.com", info.Email)
	assert.Equal(t, "member", info.Role) // default role
	assert.False(t, info.EmailVerified)

	// User must be persisted.
	stored, _ := userRepo.FindByEmail("alice@example.com")
	require.NotNil(t, stored)
	assert.NotEmpty(t, stored.PasswordHash)

	// OTP email must have been queued.
	assert.Contains(t, emailSvc.Sent, "email_verification")
}

func TestSignup_DefaultsRoleToMember(t *testing.T) {
	svc, _, _, _ := newAuthSvc(t)

	info, err := svc.Signup(services.SignupRequest{
		FirstName: "Bob",
		LastName:  "Jones",
		Email:     "bob@example.com",
		Password:  "SecurePass@1",
	})

	require.NoError(t, err)
	assert.Equal(t, "member", info.Role)
}

func TestSignup_DuplicateEmail(t *testing.T) {
	svc, _, _, _ := newAuthSvc(t)

	req := services.SignupRequest{FirstName: "A", LastName: "B", Email: "dup@example.com", Password: "SecurePass@1"}
	_, err := svc.Signup(req)
	require.NoError(t, err)

	// Second signup with same email.
	_, err = svc.Signup(req)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_002", appErr.Code) // ErrCodeEmailExists
}

func TestSignup_ValidationErrors(t *testing.T) {
	svc, _, _, _ := newAuthSvc(t)

	cases := []struct {
		name string
		req  services.SignupRequest
	}{
		{"missing first_name", services.SignupRequest{LastName: "X", Email: "a@b.com", Password: "SecurePass@1"}},
		{"missing email", services.SignupRequest{FirstName: "A", LastName: "B", Password: "SecurePass@1"}},
		{"weak password - no uppercase", services.SignupRequest{FirstName: "A", LastName: "B", Email: "a@b.com", Password: "weakpass1!"}},
		{"weak password - no digit", services.SignupRequest{FirstName: "A", LastName: "B", Email: "a@b.com", Password: "NoDigitPass!"}},
		{"short password", services.SignupRequest{FirstName: "A", LastName: "B", Email: "a@b.com", Password: "Ab1!"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.Signup(tc.req)
			require.Error(t, err, "expected validation error for: %s", tc.name)
		})
	}
}

// ─── Login ────────────────────────────────────────────────────────────────────

func TestLogin_Success(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	// Pre-seed a verified user.
	hash, _ := bcrypt.GenerateFromPassword([]byte("SecurePass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active", EmailVerified: true,
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	resp, err := svc.Login(services.LoginRequest{
		Email: "alice@example.com", Password: "SecurePass@1",
	}, "127.0.0.1", "test-agent")

	require.NoError(t, err)
	assert.NotEmpty(t, resp.Tokens.AccessToken)
	assert.NotEmpty(t, resp.Tokens.RefreshToken)
	assert.Equal(t, "alice@example.com", resp.User.Email)
}

func TestLogin_WrongPassword(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("CorrectPass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active", EmailVerified: true,
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	_, err := svc.Login(services.LoginRequest{
		Email: "alice@example.com", Password: "WrongPass@1",
	}, "", "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "AUTH_001", appErr.Code)
}

func TestLogin_UnverifiedEmail(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("SecurePass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "unverified@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active", EmailVerified: false,
	}
	userRepo.EmailIdx["unverified@example.com"] = userRepo.Users[1]

	_, err := svc.Login(services.LoginRequest{
		Email: "unverified@example.com", Password: "SecurePass@1",
	}, "", "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "AUTH_005", appErr.Code) // ErrCodeEmailNotVerified
}

func TestLogin_UserNotFound(t *testing.T) {
	svc, _, _, _ := newAuthSvc(t)

	_, err := svc.Login(services.LoginRequest{
		Email: "ghost@example.com", Password: "SecurePass@1",
	}, "", "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "AUTH_001", appErr.Code)
}

func TestLogin_LockedAccount(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("SecurePass@1"), bcrypt.DefaultCost)
	lockedUntil := time.Now().Add(10 * time.Minute)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "locked@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active", EmailVerified: true,
		LockedUntil: &lockedUntil,
	}
	userRepo.EmailIdx["locked@example.com"] = userRepo.Users[1]

	_, err := svc.Login(services.LoginRequest{
		Email: "locked@example.com", Password: "SecurePass@1",
	}, "", "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "AUTH_004", appErr.Code)
}

// ─── ValidateAccessToken ──────────────────────────────────────────────────────

func TestValidateAccessToken_Success(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("SecurePass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "admin", Status: "active", EmailVerified: true,
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	resp, err := svc.Login(services.LoginRequest{
		Email: "alice@example.com", Password: "SecurePass@1",
	}, "", "")
	require.NoError(t, err)

	claims, err := svc.ValidateAccessToken(resp.Tokens.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, uint(1), claims.UserID)
	assert.Equal(t, "admin", claims.Role)
}

func TestValidateAccessToken_InvalidToken(t *testing.T) {
	svc, _, _, _ := newAuthSvc(t)

	_, err := svc.ValidateAccessToken("not.a.real.token")
	require.Error(t, err)
}

// ─── ChangePassword ───────────────────────────────────────────────────────────

func TestChangePassword_Success(t *testing.T) {
	svc, userRepo, _, emailSvc := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("OldPass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active", EmailVerified: true,
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	err := svc.ChangePassword(1, "OldPass@1", "NewPass@2")
	require.NoError(t, err)

	// Password hash must have changed.
	user := userRepo.Users[1]
	assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("NewPass@2")))

	// Email notification sent.
	assert.Contains(t, emailSvc.Sent, "password_changed")
}

func TestChangePassword_WrongCurrentPassword(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("CorrectOld@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active",
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	err := svc.ChangePassword(1, "WrongOld@1", "NewPass@2")
	require.Error(t, err)
}

func TestChangePassword_NewPasswordInHistory(t *testing.T) {
	svc, userRepo, _, _ := newAuthSvc(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("OldPass@1"), bcrypt.DefaultCost)
	// Put a previously used password in history.
	oldHistoryHash, _ := bcrypt.GenerateFromPassword([]byte("HistoryPass@1"), bcrypt.DefaultCost)
	userRepo.Users[1] = &models.User{
		ID: 1, Email: "alice@example.com", PasswordHash: string(hash),
		Role: "member", Status: "active",
		PasswordHistory: models.StringSlice{string(oldHistoryHash)},
	}
	userRepo.EmailIdx["alice@example.com"] = userRepo.Users[1]

	// Setting a new password that is NOT in history should succeed.
	err := svc.ChangePassword(1, "OldPass@1", "BrandNew@3")
	require.NoError(t, err)
}
