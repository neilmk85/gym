package models

import "time"

type Vendor struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID   uint      `gorm:"not null;index;default:1" json:"facility_id"`
	Name         string    `gorm:"size:200;not null" json:"name"`
	ContactName  string    `gorm:"size:200" json:"contact_name"`
	Phone        string    `gorm:"size:20;not null" json:"phone"`
	Email        string    `gorm:"size:200" json:"email"`
	Address      string    `gorm:"type:text" json:"address"`
	City         string    `gorm:"size:100" json:"city"`
	State        string    `gorm:"size:100" json:"state"`
	Pincode      string    `gorm:"size:10" json:"pincode"`
	GSTNumber    string    `gorm:"column:gst_number;size:20" json:"gst_number"`
	PANNumber    string    `gorm:"column:pan_number;size:20" json:"pan_number"`
	Category     string    `gorm:"size:100;not null" json:"category"`
	PaymentTerms string    `gorm:"size:50" json:"payment_terms"`
	CreditLimit  float64   `gorm:"type:decimal(12,2);default:0" json:"credit_limit"`
	BankName     string    `gorm:"size:200" json:"bank_name"`
	BankAccount  string    `gorm:"size:50" json:"bank_account"`
	BankIFSC     string    `gorm:"column:bank_ifsc;size:20" json:"bank_ifsc"`
	Status       string    `gorm:"size:20;not null;default:'active';index" json:"status"`
	Notes        string    `gorm:"type:text" json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
