package models

import "time"

const (
	BookingStatusConfirmed  = "confirmed"
	BookingStatusWaitlisted = "waitlisted"
	BookingStatusCancelled  = "cancelled"
	BookingStatusAttended   = "attended"
	BookingStatusNoShow     = "no_show"
)

type ClassBooking struct {
	ID         uint  `gorm:"primaryKey;autoIncrement" json:"id"`
	ClassID    uint  `gorm:"not null;index" json:"class_id"`
	MemberID   *uint `gorm:"index" json:"member_id,omitempty"`
	DayPassID  *uint `gorm:"index" json:"day_pass_id,omitempty"`

	Status           string `gorm:"type:enum('confirmed','waitlisted','cancelled','attended','no_show');default:confirmed;index" json:"status"`
	WaitlistPosition *int   `json:"waitlist_position,omitempty"` // 1-based; nil when confirmed

	BookedAt     time.Time  `gorm:"not null" json:"booked_at"`
	CancelledAt  *time.Time `json:"cancelled_at,omitempty"`
	CancelReason string     `gorm:"size:200" json:"cancel_reason,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Associations
	Class   Class    `gorm:"foreignKey:ClassID" json:"class,omitempty"`
	Member  *Member  `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	DayPass *DayPass `gorm:"foreignKey:DayPassID" json:"day_pass,omitempty"`
}
