package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/middleware"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type AuthHandler struct {
	authSvc services.AuthService
}

func NewAuthHandler(authSvc services.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

// POST /api/v1/auth/signup
func (h *AuthHandler) Signup(w http.ResponseWriter, r *http.Request) {
	var req services.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	user, err := h.authSvc.Signup(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusCreated, map[string]interface{}{
		"message": "Account created. Please check your email for a verification code.",
		"user":    user,
	})
}

// POST /api/v1/auth/verify-email
func (h *AuthHandler) VerifyEmail(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
		OTP   string `json:"otp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.Email == "" || req.OTP == "" {
		response.Error(w, r, apperrors.ErrValidation("email and otp are required"))
		return
	}

	if err := h.authSvc.VerifyEmail(req.Email, req.OTP); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Email verified successfully"})
}

// POST /api/v1/auth/resend-verification
func (h *AuthHandler) ResendVerification(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.Email == "" {
		response.Error(w, r, apperrors.ErrValidation("email is required"))
		return
	}

	_ = h.authSvc.ResendVerification(req.Email) // don't reveal existence
	response.JSON(w, r, http.StatusOK, map[string]string{
		"message": "If that email is registered, a verification code has been sent.",
	})
}

// POST /api/v1/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req services.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}

	ipAddress := r.RemoteAddr
	userAgent := r.UserAgent()

	resp, err := h.authSvc.Login(req, ipAddress, userAgent)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, resp)
}

// POST /api/v1/auth/refresh-token
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.RefreshToken == "" {
		response.Error(w, r, apperrors.ErrValidation("refresh_token is required"))
		return
	}

	tokens, err := h.authSvc.RefreshToken(req.RefreshToken)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, tokens)
}

// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.RefreshToken == "" {
		response.Error(w, r, apperrors.ErrValidation("refresh_token is required"))
		return
	}

	_ = h.authSvc.Logout(req.RefreshToken)
	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

// POST /api/v1/auth/forgot-password
func (h *AuthHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.Email == "" {
		response.Error(w, r, apperrors.ErrValidation("email is required"))
		return
	}

	_ = h.authSvc.ForgotPassword(req.Email) // don't reveal existence
	response.JSON(w, r, http.StatusOK, map[string]string{
		"message": "If that email is registered, a password reset code has been sent.",
	})
}

// POST /api/v1/auth/reset-password
func (h *AuthHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email       string `json:"email"`
		OTP         string `json:"otp"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.Email == "" || req.OTP == "" || req.NewPassword == "" {
		response.Error(w, r, apperrors.ErrValidation("email, otp, and new_password are required"))
		return
	}

	if err := h.authSvc.ResetPassword(req.Email, req.OTP, req.NewPassword); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Password reset successfully"})
}

// POST /api/v1/auth/change-password  (requires JWT)
func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Error(w, r, apperrors.ErrPermissionDenied)
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid JSON body"))
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		response.Error(w, r, apperrors.ErrValidation("current_password and new_password are required"))
		return
	}

	if err := h.authSvc.ChangePassword(claims.UserID, req.CurrentPassword, req.NewPassword); err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]string{"message": "Password changed successfully"})
}

// GET /api/v1/auth/me  (requires JWT)
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Error(w, r, apperrors.ErrPermissionDenied)
		return
	}
	user, err := h.authSvc.GetUserByID(claims.UserID)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"id":             user.ID,
		"email":          user.Email,
		"first_name":     user.FirstName,
		"last_name":      user.LastName,
		"phone":          user.Phone,
		"role":           user.Role,
		"email_verified": user.EmailVerified,
	})
}

// PATCH /api/v1/auth/me  (requires JWT)
func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		response.Error(w, r, apperrors.ErrPermissionDenied)
		return
	}
	var req struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Phone     string `json:"phone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, r, apperrors.ErrValidation("invalid request body"))
		return
	}
	user, err := h.authSvc.UpdateProfile(claims.UserID, req.FirstName, req.LastName, req.Phone)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"id":             user.ID,
		"email":          user.Email,
		"first_name":     user.FirstName,
		"last_name":      user.LastName,
		"phone":          user.Phone,
		"role":           user.Role,
		"email_verified": user.EmailVerified,
	})
}
