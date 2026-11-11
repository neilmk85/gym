package models

import "time"

type DietTemplate struct {
	ID            uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID    *uint       `gorm:"index" json:"facility_id,omitempty"`
	Name          string      `gorm:"size:200;not null" json:"name"`
	Category      string      `gorm:"size:50;not null;index" json:"category"` // weight_loss, muscle_gain, maintenance, vegetarian, vegan, keto, paleo, custom
	Description   string      `gorm:"type:text" json:"description"`
	TotalCalories int         `json:"total_calories"`
	ProteinG      float64     `gorm:"type:decimal(8,1)" json:"protein_g"`
	CarbsG        float64     `gorm:"type:decimal(8,1)" json:"carbs_g"`
	FatG          float64     `gorm:"type:decimal(8,1)" json:"fat_g"`
	MealPlan      string      `gorm:"type:text" json:"meal_plan"` // Human-readable daily meal plan
	MealSections  string      `gorm:"type:text" json:"meal_sections"` // JSON array of MealSection objects
	Tags          StringSlice `gorm:"type:text" json:"tags"`
	IsDefault     bool        `gorm:"default:false;index" json:"is_default"`
	IsActive      bool        `gorm:"default:true;index" json:"is_active"`
	CreatedByID   *uint       `json:"created_by_id,omitempty"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}
