package models

import "time"

const (
	ProductCategorySupplements = "supplements"
	ProductCategoryApparel     = "apparel"
	ProductCategoryEquipment   = "equipment"
	ProductCategoryOther       = "other"

	POSOrderStatusOpen      = "open"
	POSOrderStatusCompleted = "completed"
	POSOrderStatusVoided    = "voided"

	StockMovementTypePurchase  = "purchase"
	StockMovementTypeSale      = "sale"
	StockMovementTypeAdjustment = "adjustment"
	StockMovementTypeReturn    = "return"
)

// Product is an item sold at the POS counter.
type Product struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string  `gorm:"size:200;not null" json:"name"`
	SKU          string  `gorm:"size:100;uniqueIndex" json:"sku,omitempty"`
	Category     string  `gorm:"size:100;index" json:"category,omitempty"`
	Description  string  `gorm:"type:text" json:"description,omitempty"`
	MrpPaise     int64   `gorm:"default:0" json:"mrp_paise"`   // maximum retail price
	PricePaise   int64   `gorm:"not null" json:"price_paise"`  // selling/sale price in paise
	CostPaise    int64   `gorm:"default:0" json:"cost_paise"`  // purchase cost
	TaxRateID    *uint   `gorm:"index" json:"tax_rate_id,omitempty"`
	StockQty     int     `gorm:"default:0" json:"stock_qty"`
	LowStockAt   int     `gorm:"default:5" json:"low_stock_at"` // threshold for alert
	IsActive     bool    `gorm:"default:true;index" json:"is_active"`
	ImageURL     string  `gorm:"size:500" json:"image_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// POSOrder is a sale transaction at the counter.
type POSOrder struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID   *uint     `gorm:"index" json:"member_id,omitempty"` // nil for walk-in
	CashierID  uint      `gorm:"not null;index" json:"cashier_id"`
	Status     string    `gorm:"type:enum('open','completed','voided');default:completed;index" json:"status"`
	TotalPaise    int64  `gorm:"default:0" json:"total_paise"`
	TaxPaise      int64  `gorm:"default:0" json:"tax_paise"`
	DiscountPaise int64  `gorm:"default:0" json:"discount_paise"`
	GrandPaise    int64  `gorm:"default:0" json:"grand_paise"` // total + tax - discount
	PaymentMode   string `gorm:"size:50;default:'cash'" json:"payment_mode"` // cash|upi|card|net_banking|cheque
	Notes      string    `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	Items []POSOrderItem `gorm:"foreignKey:OrderID" json:"items,omitempty"`
}

// POSOrderItem is a line in a POS order.
type POSOrderItem struct {
	ID         uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID    uint    `gorm:"not null;index" json:"order_id"`
	ProductID  uint    `gorm:"not null;index" json:"product_id"`
	Qty        int     `gorm:"not null" json:"qty"`
	UnitPaise  int64   `gorm:"not null" json:"unit_paise"`
	TaxPaise   int64   `gorm:"default:0" json:"tax_paise"`
	TotalPaise int64   `gorm:"not null" json:"total_paise"`

	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}

// StockMovement records every inventory change for audit.
type StockMovement struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID   uint      `gorm:"not null;index" json:"product_id"`
	MovementType string   `gorm:"type:enum('purchase','sale','adjustment','return');not null" json:"movement_type"`
	Qty         int       `gorm:"not null" json:"qty"` // positive=in, negative=out
	QtyBefore   int       `json:"qty_before"`
	QtyAfter    int       `json:"qty_after"`
	RefModel    string    `gorm:"size:50" json:"ref_model,omitempty"` // e.g. "POSOrder"
	RefID       uint      `json:"ref_id,omitempty"`
	Notes       string    `gorm:"size:255" json:"notes,omitempty"`
	CreatedByID uint      `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	Product Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
