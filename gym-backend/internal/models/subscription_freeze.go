package models

import "time"

const (
	FreezeStatusPending   = "pending"
	FreezeStatusActive    = "active"
	FreezeStatusCompleted = "completed"
	FreezeStatusCancelled = "cancelled"
)

type SubscriptionFreeze struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	SubscriptionID uint   `gorm:"not null;index" json:"subscription_id"`
	MemberID       uint   `gorm:"not null;index" json:"member_id"`
	StartDate      time.Time `gorm:"type:date;not null" json:"start_date"`
	EndDate        time.Time `gorm:"type:date;not null" json:"end_date"`
	Reason         string    `gorm:"size:300" json:"reason,omitempty"`
	Status         string    `gorm:"type:enum('pending','active','completed','cancelled');default:active;index" json:"status"`

	// Extension tracking
	ExtensionDays    int  `gorm:"default:0" json:"extension_days"`
	ExtensionApplied bool `gorm:"default:false" json:"extension_applied"`

	ApprovedByID *uint      `json:"approved_by_id,omitempty"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	CreatedByID  uint       `json:"created_by_id"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Subscription Subscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
	Member       Member       `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
