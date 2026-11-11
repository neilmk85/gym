package models

import "time"

const (
	AssignmentStatusActive    = "active"
	AssignmentStatusCompleted = "completed"
	AssignmentStatusRevoked   = "revoked"

	WorkoutLogStatusCompleted = "completed"
	WorkoutLogStatusSkipped   = "skipped"
	WorkoutLogStatusPartial   = "partial"

	FeedbackRatingExcellent = "excellent"
	FeedbackRatingGood      = "good"
	FeedbackRatingAverage   = "average"
	FeedbackRatingPoor      = "poor"
)

// Exercise is the global exercise library.
type Exercise struct {
	ID           uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string `gorm:"size:200;not null;uniqueIndex" json:"name"`
	Category     string `gorm:"size:100" json:"category,omitempty"` // strength, cardio, flexibility, etc.
	MuscleGroups string `gorm:"size:300" json:"muscle_groups,omitempty"`
	Equipment    string `gorm:"size:200" json:"equipment,omitempty"`
	Instructions string `gorm:"type:text" json:"instructions,omitempty"`
	VideoURL     string `gorm:"size:500" json:"video_url,omitempty"`
	IsActive     bool   `gorm:"default:true" json:"is_active"`
	CreatedByID  uint   `json:"created_by_id"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// WorkoutAssignment links a training template (or ad-hoc plan) to a member.
type WorkoutAssignment struct {
	ID                 uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID           uint   `gorm:"not null;index" json:"member_id"`
	TrainerID          uint   `gorm:"not null;index" json:"trainer_id"`
	TrainingTemplateID *uint  `gorm:"index" json:"training_template_id,omitempty"`
	Title              string `gorm:"size:200;not null" json:"title"`
	Description        string `gorm:"type:text" json:"description,omitempty"`
	StartDate          time.Time `gorm:"type:date" json:"start_date"`
	EndDate            *time.Time `gorm:"type:date" json:"end_date,omitempty"`
	Status             string `gorm:"type:enum('active','completed','revoked');default:active;index" json:"status"`
	Notes              string `gorm:"type:text" json:"notes,omitempty"`
	CreatedByID        uint   `json:"created_by_id"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`

	Member  Member         `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Trainer TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}

// DietAssignment links a diet template to a member.
type DietAssignment struct {
	ID               uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID         uint   `gorm:"not null;index" json:"member_id"`
	TrainerID        uint   `gorm:"not null;index" json:"trainer_id"`
	DietTemplateID   *uint  `gorm:"index" json:"diet_template_id,omitempty"`
	Title            string `gorm:"size:200;not null" json:"title"`
	Description      string `gorm:"type:text" json:"description,omitempty"`
	StartDate        time.Time `gorm:"type:date" json:"start_date"`
	EndDate          *time.Time `gorm:"type:date" json:"end_date,omitempty"`
	Status           string `gorm:"type:enum('active','completed','revoked');default:active;index" json:"status"`
	Notes            string `gorm:"type:text" json:"notes,omitempty"`
	CreatedByID      uint   `json:"created_by_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	Member  Member         `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Trainer TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}

// WorkoutLog is a member's logged workout session.
type WorkoutLog struct {
	ID                  uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID            uint   `gorm:"not null;index" json:"member_id"`
	WorkoutAssignmentID *uint  `gorm:"index" json:"workout_assignment_id,omitempty"`
	PTSessionID         *uint  `gorm:"index" json:"pt_session_id,omitempty"`
	LogDate             time.Time `gorm:"type:date;not null;index" json:"log_date"`
	Status              string `gorm:"type:enum('completed','skipped','partial');default:completed" json:"status"`
	DurationMinutes     int    `gorm:"default:0" json:"duration_minutes"`
	Notes               string `gorm:"type:text" json:"notes,omitempty"`
	Exercises           string `gorm:"type:json" json:"exercises,omitempty"` // JSON: [{exercise_id, sets, reps, weight, notes}]
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// TrainerFeedback is trainer notes/feedback on a member's progress.
type TrainerFeedback struct {
	ID                  uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID            uint   `gorm:"not null;index" json:"member_id"`
	TrainerID           uint   `gorm:"not null;index" json:"trainer_id"`
	WorkoutAssignmentID *uint  `gorm:"index" json:"workout_assignment_id,omitempty"`
	PTSessionID         *uint  `gorm:"index" json:"pt_session_id,omitempty"`
	Rating              string `gorm:"type:enum('excellent','good','average','poor')" json:"rating,omitempty"`
	Feedback            string `gorm:"type:text;not null" json:"feedback"`
	Goals               string `gorm:"type:text" json:"goals,omitempty"`
	Recommendations     string `gorm:"type:text" json:"recommendations,omitempty"`
	FeedbackDate        time.Time `gorm:"type:date" json:"feedback_date"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`

	Member  Member         `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Trainer TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}
