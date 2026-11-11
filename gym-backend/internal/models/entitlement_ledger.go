package models

import "time"

const (
	LedgerEventCreated   = "created"
	LedgerEventRenewed   = "renewed"
	LedgerEventUpgraded  = "upgraded"
	LedgerEventFrozen    = "frozen"
	LedgerEventUnfrozen  = "unfrozen"
	LedgerEventExtended  = "extended"
	LedgerEventCancelled = "cancelled"
	LedgerEventPaused    = "paused"
	LedgerEventResumed   = "resumed"
)

type EntitlementLedger struct {
	ID             uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID       uint    `gorm:"not null;index" json:"member_id"`
	SubscriptionID uint    `gorm:"not null;index" json:"subscription_id"`
	EventType      string  `gorm:"size:30;not null;index" json:"event_type"`
	Description    string  `gorm:"size:500" json:"description"`
	DaysAffected   int     `gorm:"default:0" json:"days_affected"`
	AmountAffected float64 `gorm:"type:decimal(10,2);default:0" json:"amount_affected"`
	OldEndDate     *time.Time `gorm:"type:date" json:"old_end_date,omitempty"`
	NewEndDate     *time.Time `gorm:"type:date" json:"new_end_date,omitempty"`
	ActorID        uint    `json:"actor_id"`
	ReferenceID    *uint   `json:"reference_id,omitempty"`
	ReferenceType  string  `gorm:"size:50" json:"reference_type,omitempty"`
	CreatedAt      time.Time `json:"created_at"`

	Member       Member       `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Subscription Subscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
}
