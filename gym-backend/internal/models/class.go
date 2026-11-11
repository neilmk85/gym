package models

import "time"

const (
	ClassTypeYoga      = "yoga"
	ClassTypeCardio    = "cardio"
	ClassTypeStrength  = "strength"
	ClassTypeZumba     = "zumba"
	ClassTypePilates   = "pilates"
	ClassTypeCrossfit  = "crossfit"
	ClassTypeSpin      = "spin"
	ClassTypeHIIT      = "hiit"
	ClassTypeOther     = "other"

	ClassStatusScheduled = "scheduled"
	ClassStatusOngoing   = "ongoing"
	ClassStatusCompleted = "completed"
	ClassStatusCancelled = "cancelled"
)

type Class struct {
	ID         uint  `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID uint  `gorm:"not null;index" json:"facility_id"`
	TrainerID  *uint `gorm:"index" json:"trainer_id,omitempty"` // TrainerProfile ID

	Name        string `gorm:"size:100;not null" json:"name"`
	Description string `gorm:"type:text" json:"description,omitempty"`
	ClassType   string `gorm:"type:enum('yoga','cardio','strength','zumba','pilates','crossfit','spin','hiit','other');default:other" json:"class_type"`

	DurationMins      int `gorm:"not null;default:60" json:"duration_mins"`
	MaxCapacity       int `gorm:"not null;default:20" json:"max_capacity"`
	CurrentEnrollment int `gorm:"default:0" json:"current_enrollment"`
	WaitlistCount     int `gorm:"default:0" json:"waitlist_count"`

	StartTime time.Time  `gorm:"not null;index" json:"start_time"`
	EndTime   time.Time  `gorm:"not null" json:"end_time"`

	// Recurring schedule
	IsRecurring       bool        `gorm:"default:false" json:"is_recurring"`
	RecurringDays     StringSlice `gorm:"type:text" json:"recurring_days,omitempty"` // ["monday","wednesday"]
	RecurringUntil    *time.Time  `gorm:"type:date" json:"recurring_until,omitempty"`
	RecurringParentID *uint       `gorm:"index" json:"recurring_parent_id,omitempty"`

	Status   string `gorm:"type:enum('scheduled','ongoing','completed','cancelled');default:scheduled;index" json:"status"`
	IsActive bool   `gorm:"default:true;index" json:"is_active"`

	// Pricing (free for members with group_class_access)
	IsFree bool    `gorm:"default:true" json:"is_free"`
	Price  float64 `gorm:"type:decimal(10,2);default:0" json:"price"`

	CreatedByID uint      `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// Associations
	Trainer  *TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
	Facility Facility        `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
}
