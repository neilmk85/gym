package models

import "time"

type TaxProfile struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID     uint   `gorm:"uniqueIndex;not null" json:"facility_id"`
	LegalName      string `gorm:"size:200;not null" json:"legal_name"`
	GSTIN          string `gorm:"size:20" json:"gstin,omitempty"`
	Address        string `gorm:"type:text" json:"address,omitempty"`
	InvoicePrefix  string `gorm:"size:30;default:'INV'" json:"invoice_prefix"`
	ReceiptPrefix  string `gorm:"size:30;default:'RCP'" json:"receipt_prefix"`
	CreditNotePrefix string `gorm:"size:30;default:'CN'" json:"credit_note_prefix"`
	InvoiceSequence  int  `gorm:"default:0" json:"invoice_sequence"`
	ReceiptSequence  int  `gorm:"default:0" json:"receipt_sequence"`
	CreditNoteSequence int `gorm:"default:0" json:"credit_note_sequence"`
	FinancialYearStart string `gorm:"size:5;default:'04-01'" json:"financial_year_start"` // MM-DD
	TaxInclusive   bool   `gorm:"default:false" json:"tax_inclusive"`
	IsActive       bool   `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	Facility Facility `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
}

type TaxRate struct {
	ID        uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string  `gorm:"size:100;not null" json:"name"`
	Rate      float64 `gorm:"type:decimal(5,2);not null" json:"rate"`
	CGSTRate  float64 `gorm:"type:decimal(5,2);default:0" json:"cgst_rate"`
	SGSTRate  float64 `gorm:"type:decimal(5,2);default:0" json:"sgst_rate"`
	IGSTRate  float64 `gorm:"type:decimal(5,2);default:0" json:"igst_rate"`
	IsDefault bool    `gorm:"default:false" json:"is_default"`
	IsActive  bool    `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
