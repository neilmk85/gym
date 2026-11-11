package models

import "time"

const (
	DayPassStatusActive    = "active"
	DayPassStatusUsed      = "used"
	DayPassStatusExpired   = "expired"
	DayPassStatusCancelled = "cancelled"
)

type DayPass struct {
	ID          uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID  uint       `gorm:"not null;index" json:"facility_id"`
	GuestName   string     `gorm:"size:200;not null" json:"guest_name"`
	GuestEmail  string     `gorm:"size:200" json:"guest_email"`
	GuestPhone  string     `gorm:"size:50" json:"guest_phone"`
	PassDate    time.Time  `gorm:"type:date;not null;index" json:"pass_date"`
	ValidFrom   time.Time  `gorm:"not null" json:"valid_from"`
	ValidUntil  time.Time  `gorm:"not null" json:"valid_until"`
	Price       float64    `gorm:"type:decimal(10,2);not null" json:"price"`
	Status      string     `gorm:"size:20;not null;default:'active';index" json:"status"`
	Notes       string     `gorm:"type:text" json:"notes"`
	CreatedByID *uint      `json:"created_by_id,omitempty"`
	CheckedInAt *time.Time `json:"checked_in_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
