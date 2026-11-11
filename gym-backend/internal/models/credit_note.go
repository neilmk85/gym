package models

import "time"

const (
	CreditNoteStatusDraft  = "draft"
	CreditNoteStatusIssued = "issued"
)

type CreditNote struct {
	ID               uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	CreditNoteNumber string  `gorm:"size:60;uniqueIndex;not null" json:"credit_note_number"`
	OriginalInvoiceID *uint  `gorm:"index" json:"original_invoice_id,omitempty"`
	PaymentID         *uint  `gorm:"index" json:"payment_id,omitempty"`
	MemberID          uint   `gorm:"not null;index" json:"member_id"`
	FacilityID        uint   `gorm:"not null;index" json:"facility_id"`
	Reason            string `gorm:"size:300;not null" json:"reason"`
	Amount            float64 `gorm:"type:decimal(10,2);not null" json:"amount"`
	TaxAmount         float64 `gorm:"type:decimal(10,2);default:0" json:"tax_amount"`
	Currency          string  `gorm:"size:3;default:INR" json:"currency"`
	Status            string  `gorm:"type:enum('draft','issued');default:issued" json:"status"`
	IssuedByID        uint    `json:"issued_by_id"`
	IssuedAt          time.Time `json:"issued_at"`
	CreatedAt         time.Time `json:"created_at"`

	OriginalInvoice *Invoice `gorm:"foreignKey:OriginalInvoiceID" json:"original_invoice,omitempty"`
	Member          Member   `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
