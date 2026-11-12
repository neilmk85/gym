package models

import "time"

const (
	MemberStatusActive    = "active"
	MemberStatusPaused    = "paused"
	MemberStatusExpired   = "expired"
	MemberStatusCancelled = "cancelled"
)

type Member struct {
	ID                    uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                uint    `gorm:"uniqueIndex;not null" json:"user_id"`
	FacilityID            uint    `gorm:"not null;index" json:"facility_id"`
	MemberCode            string  `gorm:"size:30;uniqueIndex" json:"member_code"`
	MembershipStatus      string  `gorm:"type:enum('active','paused','expired','cancelled');default:active;index" json:"membership_status"`
	CurrentPlanID         *uint   `json:"current_plan_id,omitempty"`
	CurrentSubscriptionID *uint   `json:"current_subscription_id,omitempty"`
	JoinedDate            time.Time `gorm:"type:date;not null" json:"joined_date"`
	MemberNotes           string  `gorm:"type:text" json:"member_notes,omitempty"`
	BatchTime             string  `gorm:"size:5" json:"batch_time,omitempty"` // "06:00".."21:00"
	MemberTags            JSONMap `gorm:"type:text" json:"member_tags,omitempty"`
	AssignedTrainerID     *uint   `gorm:"index" json:"assigned_trainer_id,omitempty"`

	// Health & safety
	HealthDeclaration JSONMap `gorm:"type:text" json:"health_declaration,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Associations (loaded on demand)
	User                User            `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Facility            Facility        `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
	AssignedTrainer     *TrainerProfile `gorm:"foreignKey:AssignedTrainerID" json:"assigned_trainer,omitempty"`
	CurrentSubscription *Subscription   `gorm:"foreignKey:CurrentSubscriptionID" json:"current_subscription,omitempty"`
}
