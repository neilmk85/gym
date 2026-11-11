package apperrors

import (
	"errors"
	"fmt"
	"net/http"

	"gym-backend/internal/constants"
)

// AppError is a structured error with an HTTP status, error code, and message.
type AppError struct {
	HTTPStatus int
	Code       string
	Message    string
	Details    string
}

func (e *AppError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func New(httpStatus int, code, message, details string) *AppError {
	return &AppError{HTTPStatus: httpStatus, Code: code, Message: message, Details: details}
}

// As unwraps to *AppError for errors.As.
func As(err error) (*AppError, bool) {
	var ae *AppError
	if errors.As(err, &ae) {
		return ae, true
	}
	return nil, false
}

// Predefined errors.
var (
	ErrInvalidCredentials = New(http.StatusUnauthorized, constants.ErrCodeInvalidCredentials, "Invalid credentials", "")
	ErrTokenExpired       = New(http.StatusUnauthorized, constants.ErrCodeTokenExpired, "Token has expired", "")
	ErrTokenInvalid       = New(http.StatusUnauthorized, constants.ErrCodeTokenInvalid, "Token is invalid", "")
	ErrAccountLocked      = New(http.StatusUnauthorized, constants.ErrCodeAccountLocked, "Account is locked", "Too many failed login attempts")
	ErrEmailNotVerified   = New(http.StatusUnauthorized, constants.ErrCodeEmailNotVerified, "Email not verified", "Please verify your email before logging in")
	ErrOTPInvalid         = New(http.StatusBadRequest, constants.ErrCodeOTPInvalid, "Invalid OTP", "")
	ErrOTPExpired         = New(http.StatusBadRequest, constants.ErrCodeOTPExpired, "OTP has expired", "")
	ErrPermissionDenied   = New(http.StatusForbidden, constants.ErrCodePermissionDenied, "Permission denied", "")
	ErrMemberNotFound     = New(http.StatusNotFound, constants.ErrCodeMemberNotFound, "Member not found", "")
	ErrUserNotFound       = New(http.StatusNotFound, "USR_001", "User not found", "")
	ErrEmailExists        = New(http.StatusConflict, constants.ErrCodeEmailExists, "Email already registered", "")
	ErrInternal           = New(http.StatusInternalServerError, constants.ErrCodeInternalServer, "Internal server error", "")
	ErrRateLimit          = New(http.StatusTooManyRequests, constants.ErrCodeRateLimit, "Rate limit exceeded", "Too many requests. Please try again later.")
)

func ErrValidation(details string) *AppError {
	return New(http.StatusBadRequest, constants.ErrCodeInvalidRequest, "Validation failed", details)
}
