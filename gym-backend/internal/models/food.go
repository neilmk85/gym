package models

import "time"

type Food struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name       string    `gorm:"size:200;not null;uniqueIndex" json:"name"`
	Category   string    `gorm:"size:50;not null;index" json:"category"` // beverages, fruits, nuts, dairy, grains, protein, pulses, snacks, supplements
	Unit       string    `gorm:"size:20;not null" json:"unit"`            // g, ml, pcs, slice, tbsp
	PerUnit    float64   `gorm:"type:decimal(8,2);not null" json:"per_unit"` // 100 for g/ml, 1 for discrete
	CalPer     float64   `gorm:"type:decimal(8,2);not null" json:"cal_per"`
	ProteinPer float64   `gorm:"type:decimal(8,2);not null" json:"protein_per"`
	CarbsPer   float64   `gorm:"type:decimal(8,2);not null" json:"carbs_per"`
	FatPer     float64   `gorm:"type:decimal(8,2);not null" json:"fat_per"`
	DefaultQty float64   `gorm:"type:decimal(8,2);not null" json:"default_qty"`
	IsActive   bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}
