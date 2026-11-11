package models

import "time"

type Purchase struct {
	ID                 uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID         uint       `gorm:"not null;index;default:1" json:"facility_id"`
	PurchaseNumber     string     `gorm:"size:20;not null;uniqueIndex" json:"purchase_number"`
	VendorID           *uint      `gorm:"index" json:"vendor_id,omitempty"`
	VendorName         string     `gorm:"size:200;not null" json:"vendor_name"`
	PurchaseDate       time.Time  `gorm:"type:date;not null;index" json:"purchase_date"`
	ExpectedDelivery   *time.Time `gorm:"type:date" json:"expected_delivery,omitempty"`
	ReceivedDate       *time.Time `gorm:"type:date" json:"received_date,omitempty"`
	InvoiceNumber      string     `gorm:"size:100" json:"invoice_number"`
	Subtotal           float64    `gorm:"type:decimal(12,2);not null;default:0" json:"subtotal"`
	ItemDiscount       float64    `gorm:"type:decimal(12,2);not null;default:0" json:"item_discount"`
	AdditionalDiscount float64    `gorm:"type:decimal(12,2);not null;default:0" json:"additional_discount"`
	TaxPercent         float64    `gorm:"type:decimal(5,2);not null;default:0" json:"tax_percent"`
	TaxAmount          float64    `gorm:"type:decimal(12,2);not null;default:0" json:"tax_amount"`
	ShippingCharges    float64    `gorm:"type:decimal(12,2);not null;default:0" json:"shipping_charges"`
	TotalAmount        float64    `gorm:"type:decimal(12,2);not null;default:0" json:"total_amount"`
	AmountPaid         float64    `gorm:"type:decimal(12,2);not null;default:0" json:"amount_paid"`
	PaymentMethod      string     `gorm:"size:20" json:"payment_method"`
	PaymentDate        *time.Time `gorm:"type:date" json:"payment_date,omitempty"`
	PaymentReference   string     `gorm:"size:200" json:"payment_reference"`
	PaymentStatus      string     `gorm:"size:20;not null;default:'pending';index" json:"payment_status"`
	Status             string     `gorm:"size:30;not null;default:'draft';index" json:"status"`
	ReceivedBy         string     `gorm:"size:200" json:"received_by"`
	Notes              string     `gorm:"type:text" json:"notes"`
	CreatedByID        *uint      `json:"created_by_id,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	Items  []PurchaseItem `gorm:"foreignKey:PurchaseID" json:"items,omitempty"`
	Vendor *Vendor        `gorm:"foreignKey:VendorID" json:"vendor,omitempty"`
}

type PurchaseItem struct {
	ID             uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	PurchaseID     uint    `gorm:"not null;index" json:"purchase_id"`
	ItemName       string  `gorm:"size:200;not null" json:"item_name"`
	Description    string  `gorm:"size:500" json:"description"`
	Category       string  `gorm:"size:100" json:"category"`
	Quantity       float64 `gorm:"type:decimal(10,3);not null;default:1" json:"quantity"`
	Unit           string  `gorm:"size:20;not null;default:'pcs'" json:"unit"`
	UnitPrice      float64 `gorm:"type:decimal(12,2);not null;default:0" json:"unit_price"`
	DiscountAmount float64 `gorm:"type:decimal(12,2);not null;default:0" json:"discount_amount"`
	TaxPercent     float64 `gorm:"type:decimal(5,2);not null;default:0" json:"tax_percent"`
	TotalPrice     float64 `gorm:"type:decimal(12,2);not null;default:0" json:"total_price"`
}
