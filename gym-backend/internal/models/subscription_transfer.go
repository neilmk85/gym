package models

import "time"

type SubscriptionTransfer struct {
	ID                   uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SourceSubscriptionID uint      `gorm:"not null;index" json:"source_subscription_id"`
	NewSubscriptionID    *uint     `gorm:"index" json:"new_subscription_id,omitempty"`
	SourceMemberID       uint      `gorm:"not null;index" json:"source_member_id"`
	TargetMemberID       uint      `gorm:"not null;index" json:"target_member_id"`
	PlanID               uint      `gorm:"not null" json:"plan_id"`
	MonthsTransferred    int       `gorm:"not null" json:"months_transferred"`
	TransferStartDate    time.Time `gorm:"type:date;not null" json:"transfer_start_date"`
	TransferEndDate      time.Time `gorm:"type:date;not null" json:"transfer_end_date"`
	Reason               string    `gorm:"type:text" json:"reason,omitempty"`
	TransferredByID      uint      `gorm:"not null" json:"transferred_by_id"`
	CreatedAt            time.Time `json:"created_at"`
}
