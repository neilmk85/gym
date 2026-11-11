package models

import "time"

const (
	CommissionRuleTypePct    = "percentage"
	CommissionRuleTypeFixed  = "fixed"

	CommissionStatusPending   = "pending"
	CommissionStatusApproved  = "approved"
	CommissionStatusPaid      = "paid"
	CommissionStatusCancelled = "cancelled"
)

// CommissionRule defines how much a staff member earns per event type.
type CommissionRule struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	StaffID      uint    `gorm:"not null;index" json:"staff_id"` // User.ID
	EventType    string  `gorm:"size:100;not null" json:"event_type"` // e.g. "new_subscription", "pt_session", "pos_sale"
	RuleType     string  `gorm:"type:enum('percentage','fixed');not null" json:"rule_type"`
	Value        float64 `gorm:"not null" json:"value"` // pct (0-100) or fixed paise
	IsActive     bool    `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CommissionEntry is an earned commission record for a staff member.
type CommissionEntry struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	StaffID     uint      `gorm:"not null;index" json:"staff_id"`
	RuleID      *uint     `gorm:"index" json:"rule_id,omitempty"`
	EventType   string    `gorm:"size:100;not null;index" json:"event_type"`
	RefModel    string    `gorm:"size:50" json:"ref_model,omitempty"` // "Subscription", "PTSession", "POSOrder"
	RefID       uint      `gorm:"index" json:"ref_id,omitempty"`
	BaseAmtPaise int64    `gorm:"default:0" json:"base_amt_paise"` // the transaction value used
	CommPaise   int64     `gorm:"not null" json:"comm_paise"`       // actual commission amount
	Status      string    `gorm:"type:enum('pending','approved','paid','cancelled');default:pending;index" json:"status"`
	ApprovedAt  *time.Time `json:"approved_at,omitempty"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	Notes       string    `gorm:"size:255" json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Staff User `gorm:"foreignKey:StaffID" json:"staff,omitempty"`
}

// CommissionPayout groups multiple commission entries into a single payment batch.
type CommissionPayout struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	StaffID     uint      `gorm:"not null;index" json:"staff_id"`
	PeriodStart time.Time `gorm:"type:date;not null" json:"period_start"`
	PeriodEnd   time.Time `gorm:"type:date;not null" json:"period_end"`
	TotalPaise  int64     `gorm:"not null" json:"total_paise"`
	Status      string    `gorm:"type:enum('pending','paid');default:pending;index" json:"status"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	Notes       string    `gorm:"size:255" json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Staff User `gorm:"foreignKey:StaffID" json:"staff,omitempty"`
}
