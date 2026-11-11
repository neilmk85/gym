package models

import "time"

type UpgradeQuote struct {
	ID             uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	SubscriptionID uint    `gorm:"not null;index" json:"subscription_id"`
	MemberID       uint    `gorm:"not null;index" json:"member_id"`
	FromPlanID     uint    `json:"from_plan_id"`
	ToPlanID       uint    `json:"to_plan_id"`
	DaysRemaining  int     `json:"days_remaining"`
	ProratedCredit float64 `gorm:"type:decimal(10,2)" json:"prorated_credit"`
	NewPlanCharge  float64 `gorm:"type:decimal(10,2)" json:"new_plan_charge"`
	AmountDue      float64 `gorm:"type:decimal(10,2)" json:"amount_due"`
	Currency       string  `gorm:"size:3;default:INR" json:"currency"`
	ExpiresAt      time.Time `json:"expires_at"`
	Used           bool    `gorm:"default:false" json:"used"`
	CreatedByID    uint    `json:"created_by_id"`
	CreatedAt      time.Time `json:"created_at"`

	FromPlan Plan `gorm:"foreignKey:FromPlanID" json:"from_plan,omitempty"`
	ToPlan   Plan `gorm:"foreignKey:ToPlanID" json:"to_plan,omitempty"`
}
