package models

import "time"

// Branch represents a physical gym location.
// In Phase 1 there is typically a single branch; this model lays the
// structural foundation so multi-branch filtering can be added later.
type Branch struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:200;not null" json:"name"`
	Address   string    `gorm:"type:text" json:"address,omitempty"`
	City      string    `gorm:"size:100" json:"city,omitempty"`
	State     string    `gorm:"size:100" json:"state,omitempty"`
	Phone     string    `gorm:"size:20" json:"phone,omitempty"`
	Email     string    `gorm:"size:200" json:"email,omitempty"`
	IsActive  bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
