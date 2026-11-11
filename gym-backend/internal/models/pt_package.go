package models

import "time"

const (
	PTPackageStatusActive   = "active"
	PTPackageStatusInactive = "inactive"

	PTSessionStatusScheduled = "scheduled"
	PTSessionStatusCompleted = "completed"
	PTSessionStatusCancelled = "cancelled"
	PTSessionStatusNoShow    = "no_show"

	SessionCreditTypeCredit = "credit"
	SessionCreditTypeDebit  = "debit"
	SessionCreditTypeExpiry = "expiry"
	SessionCreditTypeRefund = "refund"
)

// PTPackage is the product definition (e.g. "10-session PT pack with any trainer").
type PTPackage struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID   uint    `gorm:"not null;index" json:"facility_id"`
	Name         string  `gorm:"size:200;not null" json:"name"`
	Description  string  `gorm:"type:text" json:"description,omitempty"`
	Category     string  `gorm:"size:100;default:'Personal Training'" json:"category"` // e.g. Personal Training, Pilates, Yoga
	Sessions     int     `gorm:"not null" json:"sessions"`
	ValidityDays int     `gorm:"not null;default:90" json:"validity_days"`
	Price        float64 `gorm:"type:decimal(10,2);not null" json:"price"`
	Currency     string  `gorm:"size:3;default:INR" json:"currency"`
	GymPct       float64 `gorm:"type:decimal(5,2);default:60" json:"gym_pct"` // gym revenue split %
	Status       string  `gorm:"type:enum('active','inactive');default:active;index" json:"status"`
	IsActive     bool    `gorm:"default:true" json:"is_active"`
	CreatedByID  uint    `json:"created_by_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// MemberPTPackage is a purchased PT package for a specific member.
type MemberPTPackage struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID      uint    `gorm:"not null;index" json:"member_id"`
	FacilityID    uint    `gorm:"not null;index" json:"facility_id"`
	PTPackageID   uint    `gorm:"not null;index" json:"pt_package_id"`
	TrainerID     *uint   `gorm:"index" json:"trainer_id,omitempty"` // assigned trainer (optional, can be any)
	PaymentID     *uint   `gorm:"index" json:"payment_id,omitempty"`
	TotalSessions int     `gorm:"not null" json:"total_sessions"`
	UsedSessions  int     `gorm:"default:0" json:"used_sessions"`
	Amount        float64 `gorm:"type:decimal(10,2)" json:"amount"`
	Currency      string  `gorm:"size:3;default:INR" json:"currency"`
	PurchasedAt   time.Time `json:"purchased_at"`
	ExpiresAt     time.Time `gorm:"type:date;index" json:"expires_at"`
	IsActive      bool    `gorm:"default:true;index" json:"is_active"`
	Notes         string  `gorm:"type:text" json:"notes,omitempty"`
	CreatedByID   uint    `json:"created_by_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	Member    Member     `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	PTPackage PTPackage  `gorm:"foreignKey:PTPackageID" json:"pt_package,omitempty"`
	Trainer   *TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}

// PTSession is a booked/completed PT session.
type PTSession struct {
	ID               uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID         uint   `gorm:"not null;index" json:"member_id"`
	FacilityID       uint   `gorm:"not null;index" json:"facility_id"`
	MemberPTPackageID *uint `gorm:"index" json:"member_pt_package_id,omitempty"`
	TrainerID        uint   `gorm:"not null;index" json:"trainer_id"`
	ScheduledAt      time.Time `gorm:"index" json:"scheduled_at"`
	DurationMinutes  int    `gorm:"default:60" json:"duration_minutes"`
	Status           string `gorm:"type:enum('scheduled','completed','cancelled','no_show');default:scheduled;index" json:"status"`
	Notes            string `gorm:"type:text" json:"notes,omitempty"`
	TrainerNotes     string `gorm:"type:text" json:"trainer_notes,omitempty"`
	CancelReason     string `gorm:"size:300" json:"cancel_reason,omitempty"`
	CancelledByID    *uint  `json:"cancelled_by_id,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	CreatedByID      uint   `json:"created_by_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	Member  Member         `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Trainer TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}

// SessionCreditLedger is an immutable audit trail for PT session credits.
type SessionCreditLedger struct {
	ID                uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID          uint   `gorm:"not null;index" json:"member_id"`
	MemberPTPackageID uint   `gorm:"not null;index" json:"member_pt_package_id"`
	PTSessionID       *uint  `gorm:"index" json:"pt_session_id,omitempty"`
	EntryType         string `gorm:"type:enum('credit','debit','expiry','refund');not null" json:"entry_type"`
	Sessions          int    `gorm:"not null" json:"sessions"` // positive for credit, negative for debit
	BalanceAfter      int    `gorm:"not null" json:"balance_after"`
	Description       string `gorm:"size:300" json:"description,omitempty"`
	ActorID           uint   `json:"actor_id"`
	CreatedAt         time.Time `json:"created_at"`
}
