package models

import "time"

type Receipt struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	ReceiptNumber string  `gorm:"size:60;uniqueIndex;not null" json:"receipt_number"`
	InvoiceID     *uint   `gorm:"index" json:"invoice_id,omitempty"`
	PaymentID     uint    `gorm:"not null;index" json:"payment_id"`
	MemberID      uint    `gorm:"not null;index" json:"member_id"`
	FacilityID    uint    `gorm:"not null;index" json:"facility_id"`
	AmountReceived float64 `gorm:"type:decimal(10,2);not null" json:"amount_received"`
	Currency       string  `gorm:"size:3;default:INR" json:"currency"`
	PaymentMethod  string  `gorm:"size:50" json:"payment_method"`
	PaidAt         time.Time `json:"paid_at"`
	Notes          string  `gorm:"type:text" json:"notes,omitempty"`
	IssuedByID     uint    `json:"issued_by_id"`
	CreatedAt      time.Time `json:"created_at"`

	Invoice *Invoice `gorm:"foreignKey:InvoiceID" json:"invoice,omitempty"`
	Payment Payment  `gorm:"foreignKey:PaymentID" json:"payment,omitempty"`
	Member  Member   `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
