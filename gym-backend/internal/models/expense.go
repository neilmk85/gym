package models

import "time"

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	ExpenseStatusPending  = "pending"
	ExpenseStatusApproved = "approved"
	ExpenseStatusRejected = "rejected"

	ExpensePaymentCash     = "cash"
	ExpensePaymentCard     = "card"
	ExpensePaymentTransfer = "transfer"
	ExpensePaymentOther    = "other"
)

// ─── ExpenseCategory ──────────────────────────────────────────────────────────

type ExpenseCategory struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"size:100;not null;uniqueIndex" json:"name"`
	Description string    `gorm:"size:500" json:"description"`
	Color       string    `gorm:"size:20;not null;default:'#6366f1'" json:"color"`
	Icon        string    `gorm:"size:50;not null;default:'receipt'" json:"icon"`
	IsActive    bool      `gorm:"not null;default:true;index" json:"is_active"`
	CreatedByID *uint     `json:"created_by_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ─── Expense ──────────────────────────────────────────────────────────────────

type Expense struct {
	ID            uint             `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID    uint             `gorm:"not null;index" json:"facility_id"`
	CategoryID    *uint            `gorm:"index" json:"category_id,omitempty"`
	Title         string           `gorm:"size:200;not null" json:"title"`
	Amount        float64          `gorm:"type:decimal(12,2);not null" json:"amount"`
	ExpenseDate   time.Time        `gorm:"type:date;not null;index" json:"expense_date"`
	PaymentMethod string           `gorm:"size:20;not null;default:'cash'" json:"payment_method"`
	Vendor        string           `gorm:"size:200" json:"vendor"`
	ReceiptURL    string           `gorm:"size:500" json:"receipt_url"`
	Notes         string           `gorm:"type:text" json:"notes"`
	Status        string           `gorm:"size:20;not null;default:'pending';index" json:"status"`
	CreatedByID   *uint            `json:"created_by_id,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`

	// Associations (loaded on demand)
	Category *ExpenseCategory `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	Facility *Facility        `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
}
