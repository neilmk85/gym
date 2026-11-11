package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// IntSlice is a JSON-serialised []int stored as TEXT in MySQL.
type IntSlice []int

func (s IntSlice) Value() (driver.Value, error) {
	b, err := json.Marshal([]int(s))
	return string(b), err
}

func (s *IntSlice) Scan(value interface{}) error {
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	case nil:
		*s = IntSlice{}
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into IntSlice", value)
	}
	return json.Unmarshal(raw, s)
}

// StringSlice is a JSON-serialised []string stored as TEXT in MySQL.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(value interface{}) error {
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	case nil:
		*s = StringSlice{}
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into StringSlice", value)
	}
	return json.Unmarshal(raw, s)
}

type User struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Email      string `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Phone      string `gorm:"size:20" json:"phone"`
	PasswordHash string `gorm:"size:255;not null" json:"-"`
	// Last 5 password hashes for history check
	PasswordHistory StringSlice `gorm:"type:text" json:"-"`
	FirstName  string `gorm:"size:100;not null" json:"first_name"`
	LastName   string `gorm:"size:100;not null" json:"last_name"`
	DateOfBirth *time.Time `gorm:"type:date" json:"date_of_birth,omitempty"`
	Gender     *string `gorm:"type:enum('M','F','Other')" json:"gender,omitempty"`

	Role   string `gorm:"type:enum('admin','manager','trainer','trainer_assistant','member');not null" json:"role"`
	Status string `gorm:"type:enum('active','inactive','suspended','locked');default:active" json:"status"`

	ProfilePhotoURL string `gorm:"size:500" json:"profile_photo_url,omitempty"`
	FacilityID      *uint  `gorm:"index" json:"facility_id,omitempty"`

	HeightCm   *int     `json:"height_cm,omitempty"`
	WeightKg   *float64 `gorm:"type:decimal(5,2)" json:"weight_kg,omitempty"`

	EmergencyContactName         string `gorm:"size:100" json:"emergency_contact_name,omitempty"`
	EmergencyContactPhone        string `gorm:"size:20" json:"emergency_contact_phone,omitempty"`
	EmergencyContactRelationship string `gorm:"size:50" json:"emergency_contact_relationship,omitempty"`

	// Security
	FailedLoginAttempts int        `gorm:"default:0" json:"-"`
	LockedUntil         *time.Time `json:"-"`
	EmailVerified       bool       `gorm:"default:false" json:"email_verified"`
	EmailVerifiedAt     *time.Time `json:"email_verified_at,omitempty"`
	PhoneVerified       bool       `gorm:"default:false" json:"phone_verified"`
	TwoFactorEnabled    bool       `gorm:"default:false" json:"two_factor_enabled"`

	// Soft delete
	DeletedAt       *time.Time `gorm:"index" json:"-"`
	DeletionReason  *string    `gorm:"type:enum('gdpr_request','account_closure','admin_removal','spam')" json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

func (u *User) IsLocked() bool {
	if u.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*u.LockedUntil)
}
