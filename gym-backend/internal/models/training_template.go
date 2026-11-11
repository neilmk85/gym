package models

import "time"

type TrainingTemplate struct {
	ID              uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID      *uint       `gorm:"index" json:"facility_id,omitempty"`
	Name            string      `gorm:"size:200;not null" json:"name"`
	Category        string      `gorm:"size:50;not null;index" json:"category"` // strength, cardio, hiit, yoga, flexibility, sports
	Difficulty      string      `gorm:"size:20;not null" json:"difficulty"`      // beginner, intermediate, advanced
	Description     string      `gorm:"type:text" json:"description"`
	DurationWeeks   int         `json:"duration_weeks"`
	SessionsPerWeek int         `json:"sessions_per_week"`
	WorkoutPlan     string      `gorm:"type:text" json:"workout_plan"` // Detailed weekly workout breakdown
	Equipment       StringSlice `gorm:"type:text" json:"equipment"`
	Tags            StringSlice `gorm:"type:text" json:"tags"`
	IsDefault       bool        `gorm:"default:false;index" json:"is_default"`
	IsActive        bool        `gorm:"default:true;index" json:"is_active"`
	CreatedByID     *uint       `json:"created_by_id,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}
