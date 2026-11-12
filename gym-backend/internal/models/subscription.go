package models

import "time"

const (
	SubStatusActive    = "active"
	SubStatusPaused    = "paused"
	SubStatusExpired   = "expired"
	SubStatusCancelled = "cancelled"
)

type Subscription struct {
	ID       uint `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID uint `gorm:"not null;index" json:"member_id"`
	PlanID   uint `gorm:"not null" json:"plan_id"`

	StartDate time.Time `gorm:"type:date;not null" json:"start_date"`
	EndDate   time.Time `gorm:"type:date;not null" json:"end_date"`
	Status    string    `gorm:"type:enum('active','paused','expired','cancelled');default:active;index" json:"status"`

	// Pause info
	PausedAt      *time.Time `json:"paused_at,omitempty"`
	PausedUntil   *time.Time `gorm:"type:date" json:"paused_until,omitempty"`
	PauseReason   string     `gorm:"size:200" json:"pause_reason,omitempty"`
	PauseCount    int        `gorm:"default:0" json:"pause_count"`

	// Pricing
	OriginalAmount float64 `gorm:"type:decimal(10,2)" json:"original_amount"`
	DiscountAmount float64 `gorm:"type:decimal(10,2);default:0" json:"discount_amount"`
	PromoCodeID    *uint   `json:"promo_code_id,omitempty"`
	FinalAmount    float64 `gorm:"type:decimal(10,2)" json:"final_amount"`
	Currency       string  `gorm:"size:3;default:INR" json:"currency"`

	// Renewal
	AutoRenew       bool       `gorm:"default:true" json:"auto_renew"`
	NextRenewalDate *time.Time `gorm:"type:date;index" json:"next_renewal_date,omitempty"`
	LastPaymentID   *uint      `json:"last_payment_id,omitempty"`

	// Freeze tracking
	FreezeCount     int `gorm:"default:0" json:"freeze_count"`
	TotalFrozenDays int `gorm:"default:0" json:"total_frozen_days"`

	// Couple / Group linking
	PartnerMemberID *uint `gorm:"index" json:"partner_member_id,omitempty"`
	GroupSubID      *uint `gorm:"index" json:"group_sub_id,omitempty"`
	GroupLeaderSub  bool  `gorm:"default:false" json:"group_leader_sub"`

	// Free time granted
	FreeMonthsAdded int `gorm:"default:0" json:"free_months_added"`
	FreeDaysAdded   int `gorm:"default:0" json:"free_days_added"`

	// Cancellation
	CancelledAt            *time.Time `json:"cancelled_at,omitempty"`
	CancellationReason     string     `gorm:"size:200" json:"cancellation_reason,omitempty"`
	CancellationFeedback   string     `gorm:"type:text" json:"cancellation_feedback,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Plan   Plan   `gorm:"foreignKey:PlanID"   json:"plan,omitempty"`
	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
