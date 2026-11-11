package models

import "time"

const (
	LockerStatusAvailable  = "available"
	LockerStatusOccupied   = "occupied"
	LockerStatusMaintenance = "maintenance"

	AllotmentStatusActive   = "active"
	AllotmentStatusExpired  = "expired"
	AllotmentStatusReleased = "released"
)

// Locker represents a physical locker unit.
type Locker struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Number     string `gorm:"size:20;uniqueIndex;not null" json:"number"`
	Location   string `gorm:"size:100" json:"location"` // e.g. "Male Changing Room - Row A"
	Status     string `gorm:"type:enum('available','occupied','maintenance');default:available;index" json:"status"`
	Notes      string `gorm:"type:text" json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// LockerAllotment tracks who has a locker for what period and at what fee.
type LockerAllotment struct {
	ID          uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	LockerID    uint    `gorm:"not null;index" json:"locker_id"`
	MemberID    uint    `gorm:"not null;index" json:"member_id"`
	StartDate   time.Time `gorm:"type:date;not null" json:"start_date"`
	EndDate     time.Time `gorm:"type:date;not null" json:"end_date"`
	FeeAmount   float64 `gorm:"type:decimal(10,2);not null" json:"fee_amount"`
	FeePaid     bool    `gorm:"default:false" json:"fee_paid"`
	Status      string  `gorm:"type:enum('active','expired','released');default:active;index" json:"status"`
	Notes       string  `gorm:"type:text" json:"notes"`
	ReleasedAt  *time.Time `json:"released_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Associations
	Locker Locker `gorm:"foreignKey:LockerID" json:"locker,omitempty"`
	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
