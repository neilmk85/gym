package constants

// Error codes returned in API responses.
const (
	// Auth
	ErrCodeInvalidCredentials = "AUTH_001"
	ErrCodeTokenExpired       = "AUTH_002"
	ErrCodeTokenInvalid       = "AUTH_003"
	ErrCodeAccountLocked      = "AUTH_004"
	ErrCodeEmailNotVerified   = "AUTH_005"
	ErrCodeOTPInvalid         = "AUTH_006"
	ErrCodeOTPExpired         = "AUTH_007"

	// Authorization
	ErrCodePermissionDenied = "AUTHZ_001"

	// Member
	ErrCodeMemberNotFound    = "MBR_001"
	ErrCodeEmailExists       = "MBR_002"
	ErrCodeInvalidPhone      = "MBR_003"

	// Validation
	ErrCodeRequiredField  = "VAL_001"
	ErrCodeInvalidType    = "VAL_002"
	ErrCodeInvalidFormat  = "VAL_003"
	ErrCodeInvalidRequest = "VAL_004"

	// Rate limit
	ErrCodeRateLimit = "LIMIT_001"

	// Server
	ErrCodeInternalServer   = "SRV_001"
	ErrCodeServiceUnavailable = "SRV_002"
)
