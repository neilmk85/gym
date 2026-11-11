package models

import "time"

const (
	RetentionRiskLow    = "low"
	RetentionRiskMedium = "medium"
	RetentionRiskHigh   = "high"

	RetentionActionTypeCall    = "call"
	RetentionActionTypeMessage = "message"
	RetentionActionTypeVisit   = "visit"
	RetentionActionTypeOther   = "other"

	RetentionActionStatusOpen     = "open"
	RetentionActionStatusDone     = "done"
	RetentionActionStatusSkipped  = "skipped"
)

// MemberBodyMeasurement records a member's body metrics at a point in time.
type MemberBodyMeasurement struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID        uint      `gorm:"not null;index" json:"member_id"`
	RecordedByID    uint      `json:"recorded_by_id"` // trainer or staff user ID
	MeasuredAt      time.Time `gorm:"type:date;not null;index" json:"measured_at"`
	WeightKg        *float64  `json:"weight_kg,omitempty"`
	HeightCm        *float64  `json:"height_cm,omitempty"`
	BodyFatPct      *float64  `json:"body_fat_pct,omitempty"`
	MuscleMassKg    *float64  `json:"muscle_mass_kg,omitempty"`
	WaistCm         *float64  `json:"waist_cm,omitempty"`
	ChestCm         *float64  `json:"chest_cm,omitempty"`
	HipsCm          *float64  `json:"hips_cm,omitempty"`
	ThighCm         *float64  `json:"thigh_cm,omitempty"`
	BicepCm         *float64  `json:"bicep_cm,omitempty"`
	BMI             *float64  `json:"bmi,omitempty"`
	Notes           string    `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// MemberProgressPhoto stores a photo URL and metadata.
type MemberProgressPhoto struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID     uint      `gorm:"not null;index" json:"member_id"`
	UploadedByID uint      `json:"uploaded_by_id"`
	PhotoURL     string    `gorm:"size:500;not null" json:"photo_url"`
	Angle        string    `gorm:"size:50" json:"angle,omitempty"` // front, side, back
	PhotoDate    time.Time `gorm:"type:date;not null;index" json:"photo_date"`
	Notes        string    `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// RetentionRisk is a risk flag raised against a member with an optional action item.
type RetentionRisk struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID   uint      `gorm:"not null;index" json:"member_id"`
	RaisedByID uint      `json:"raised_by_id"`
	RiskLevel  string    `gorm:"type:enum('low','medium','high');default:medium;index" json:"risk_level"`
	Reason     string    `gorm:"type:text;not null" json:"reason"`
	IsResolved bool      `gorm:"default:false;index" json:"is_resolved"`
	ResolvedAt *time.Time `json:"resolved_at,omitempty"`
	Notes      string    `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}

// RetentionAction is a task tied to a retention risk (call, message, etc.).
type RetentionAction struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RetentionRiskID uint      `gorm:"not null;index" json:"retention_risk_id"`
	MemberID        uint      `gorm:"not null;index" json:"member_id"`
	AssignedToID    uint      `gorm:"not null;index" json:"assigned_to_id"`
	ActionType      string    `gorm:"type:enum('call','message','visit','other');default:call" json:"action_type"`
	Status          string    `gorm:"type:enum('open','done','skipped');default:open;index" json:"status"`
	DueDate         time.Time `gorm:"type:date" json:"due_date"`
	Notes           string    `gorm:"type:text" json:"notes,omitempty"`
	Outcome         string    `gorm:"type:text" json:"outcome,omitempty"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}
