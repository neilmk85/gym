package models

import "time"

// GymSetting stores gym-wide configuration as a key-value pair.
type GymSetting struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ExpiredScanAttempt records every biometric scan from a member whose
// membership has already expired or been cancelled.
type ExpiredScanAttempt struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	DeviceUserID string    `gorm:"size:30;not null;index" json:"device_user_id"`
	MemberID     *uint     `gorm:"index" json:"member_id,omitempty"`
	MemberName   string    `gorm:"size:255" json:"member_name"`
	ScannedAt    time.Time `gorm:"not null;index" json:"scanned_at"`
	FacilityID   *uint     `gorm:"index" json:"facility_id,omitempty"`
}
