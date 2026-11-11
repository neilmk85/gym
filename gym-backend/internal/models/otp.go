package models

import "time"

const (
	OTPPurposeEmailVerification = "email_verification"
	OTPPurposePasswordReset     = "password_reset"
	OTPPurposePhoneVerification = "phone_verification"
)

type OTPCode struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	Code      string    `gorm:"size:10;not null" json:"-"`
	Purpose   string    `gorm:"type:enum('email_verification','password_reset','phone_verification');not null" json:"purpose"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	Attempts  int       `gorm:"default:0" json:"-"`
	CreatedAt time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}

func (o *OTPCode) IsValid() bool {
	return o.UsedAt == nil && time.Now().Before(o.ExpiresAt)
}
