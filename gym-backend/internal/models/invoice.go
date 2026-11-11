package models

import "time"

const (
	InvoiceStatusDraft     = "draft"
	InvoiceStatusIssued    = "issued"
	InvoiceStatusCancelled = "cancelled"
)

type Invoice struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	InvoiceNumber  string `gorm:"size:60;uniqueIndex;not null" json:"invoice_number"`
	FacilityID     uint   `gorm:"not null;index" json:"facility_id"`
	MemberID       uint   `gorm:"not null;index" json:"member_id"`
	PaymentID      *uint  `gorm:"index" json:"payment_id,omitempty"`
	SubscriptionID *uint  `gorm:"index" json:"subscription_id,omitempty"`
	Status         string `gorm:"type:enum('draft','issued','cancelled');default:draft;index" json:"status"`
	IssueDate      time.Time `gorm:"type:date" json:"issue_date"`

	// Seller snapshot (captured at issue time so it's immutable)
	SellerName    string `gorm:"size:200" json:"seller_name"`
	SellerGSTIN   string `gorm:"size:20" json:"seller_gstin,omitempty"`
	SellerAddress string `gorm:"type:text" json:"seller_address,omitempty"`

	// Buyer snapshot
	BuyerName    string `gorm:"size:200" json:"buyer_name"`
	BuyerPhone   string `gorm:"size:20" json:"buyer_phone,omitempty"`
	BuyerEmail   string `gorm:"size:200" json:"buyer_email,omitempty"`
	BuyerGSTIN   string `gorm:"size:20" json:"buyer_gstin,omitempty"`
	BuyerAddress string `gorm:"type:text" json:"buyer_address,omitempty"`

	// Totals
	Subtotal       float64 `gorm:"type:decimal(10,2)" json:"subtotal"`
	DiscountAmount float64 `gorm:"type:decimal(10,2);default:0" json:"discount_amount"`
	TaxableAmount  float64 `gorm:"type:decimal(10,2)" json:"taxable_amount"`
	TaxAmount      float64 `gorm:"type:decimal(10,2);default:0" json:"tax_amount"`
	Total          float64 `gorm:"type:decimal(10,2)" json:"total"`
	Currency       string  `gorm:"size:3;default:INR" json:"currency"`

	Notes      string `gorm:"type:text" json:"notes,omitempty"`
	IssuedByID uint   `json:"issued_by_id"`
	CancelledAt *time.Time `json:"cancelled_at,omitempty"`
	CancelReason string `gorm:"size:300" json:"cancel_reason,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Lines   []InvoiceLine `gorm:"foreignKey:InvoiceID" json:"lines,omitempty"`
	Member  Member        `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Payment *Payment      `gorm:"foreignKey:PaymentID" json:"payment,omitempty"`
}

type InvoiceLine struct {
	ID             uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	InvoiceID      uint    `gorm:"not null;index" json:"invoice_id"`
	Description    string  `gorm:"size:300;not null" json:"description"`
	Quantity       float64 `gorm:"type:decimal(10,3);default:1" json:"quantity"`
	UnitPrice      float64 `gorm:"type:decimal(10,2)" json:"unit_price"`
	DiscountAmount float64 `gorm:"type:decimal(10,2);default:0" json:"discount_amount"`
	TaxableAmount  float64 `gorm:"type:decimal(10,2)" json:"taxable_amount"`
	TaxRateID      *uint   `json:"tax_rate_id,omitempty"`
	TaxRateSnapshot float64 `gorm:"type:decimal(5,2);default:0" json:"tax_rate_snapshot"`
	CGSTAmount     float64 `gorm:"type:decimal(10,2);default:0" json:"cgst_amount"`
	SGSTAmount     float64 `gorm:"type:decimal(10,2);default:0" json:"sgst_amount"`
	IGSTAmount     float64 `gorm:"type:decimal(10,2);default:0" json:"igst_amount"`
	TaxAmount      float64 `gorm:"type:decimal(10,2);default:0" json:"tax_amount"`
	LineTotal      float64 `gorm:"type:decimal(10,2)" json:"line_total"`
	SortOrder      int     `gorm:"default:0" json:"sort_order"`
}
