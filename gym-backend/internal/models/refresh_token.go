package models

import "time"

type RefreshToken struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint      `gorm:"not null;index" json:"user_id"`
	TokenHash  string    `gorm:"size:255;uniqueIndex;not null" json:"-"`
	DeviceInfo string    `gorm:"size:255" json:"device_info,omitempty"`
	IPAddress  string    `gorm:"size:45" json:"ip_address,omitempty"`
	ExpiresAt  time.Time `gorm:"not null" json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
	CreatedAt  time.Time `json:"created_at"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}

func (rt *RefreshToken) IsValid() bool {
	return rt.RevokedAt == nil && time.Now().Before(rt.ExpiresAt)
}
