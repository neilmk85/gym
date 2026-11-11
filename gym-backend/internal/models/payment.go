package models

import "time"

const (
	PaymentMethodCash         = "cash"
	PaymentMethodUPI          = "upi"
	PaymentMethodCard         = "card"
	PaymentMethodBankTransfer = "bank_transfer"
	PaymentMethodRazorpay     = "razorpay"
	PaymentMethodOther        = "other"

	PaymentStatusPending   = "pending"
	PaymentStatusCompleted = "completed"
	PaymentStatusFailed    = "failed"
	PaymentStatusRefunded  = "refunded"
)

type Payment struct {
	ID             uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID       uint    `gorm:"not null;index" json:"member_id"`
	SubscriptionID *uint   `gorm:"index" json:"subscription_id,omitempty"`
	Amount         float64 `gorm:"type:decimal(10,2);not null" json:"amount"`
	Currency       string  `gorm:"size:3;default:INR" json:"currency"`

	PaymentMethod string `gorm:"type:enum('cash','upi','card','bank_transfer','razorpay','other');not null" json:"payment_method"`
	Status        string `gorm:"type:enum('pending','completed','failed','refunded');default:completed;index" json:"status"`

	// External references (e.g. Razorpay order/payment IDs)
	TransactionID   string `gorm:"size:100;index" json:"transaction_id,omitempty"`
	ReferenceNumber string `gorm:"size:100" json:"reference_number,omitempty"`

	Notes string `gorm:"type:text" json:"notes,omitempty"`

	// Refund info
	RefundedAt    *time.Time `json:"refunded_at,omitempty"`
	RefundAmount  float64    `gorm:"type:decimal(10,2);default:0" json:"refund_amount,omitempty"`
	RefundReason  string     `gorm:"size:200" json:"refund_reason,omitempty"`

	PaidAt          time.Time `gorm:"not null" json:"paid_at"`
	RecordedByID    uint      `json:"recorded_by_id"` // user who entered the payment
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	// Associations
	Member       Member       `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Subscription *Subscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
}
