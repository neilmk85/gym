package models

import "time"

type TrainerProfile struct {
	ID         uint `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint `gorm:"uniqueIndex;not null" json:"user_id"`
	FacilityID uint `gorm:"not null;index" json:"facility_id"`

	Bio              string      `gorm:"type:text" json:"bio,omitempty"`
	Specializations  StringSlice `gorm:"type:text" json:"specializations,omitempty"` // ["yoga","cardio","strength"]
	Certifications   StringSlice `gorm:"type:text" json:"certifications,omitempty"`
	ExperienceYears  int         `gorm:"default:0" json:"experience_years"`
	HourlyRate       float64     `gorm:"type:decimal(10,2);default:0" json:"hourly_rate"`
	MaxClientsPerDay int         `gorm:"default:10" json:"max_clients_per_day"`

	WeeklyOffDays IntSlice `gorm:"type:text" json:"weekly_off_days"`
	IsActive      bool     `gorm:"default:true;index" json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Associations
	User     User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Facility Facility `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
}
