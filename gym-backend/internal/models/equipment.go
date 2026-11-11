package models

import "time"

type Equipment struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID   uint       `gorm:"not null;index;default:1" json:"facility_id"`
	Name         string     `gorm:"size:200;not null" json:"name"`
	Brand        string     `gorm:"size:100;not null" json:"brand"`
	Category     string     `gorm:"size:50;not null;index" json:"category"`
	Quantity     int        `gorm:"not null;default:1" json:"quantity"`
	WeightKg     *float64   `gorm:"column:weight_kg;type:decimal(8,2)" json:"weight_kg,omitempty"`
	Unit         string     `gorm:"size:10;not null;default:'pcs'" json:"unit"`
	Condition    string     `gorm:"size:20;not null;default:'good';index" json:"condition"`
	Location     string     `gorm:"size:200" json:"location"`
	SerialNumber string     `gorm:"size:100" json:"serial_number"`
	PurchasedAt  *time.Time `gorm:"type:date" json:"purchased_at,omitempty"`
	Notes        string     `gorm:"type:text" json:"notes"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}
