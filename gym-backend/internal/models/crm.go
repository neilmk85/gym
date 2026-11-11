package models

import "time"

const (
	LeadActivityTypeCall    = "call"
	LeadActivityTypeEmail   = "email"
	LeadActivityTypeVisit   = "visit"
	LeadActivityTypeMessage = "message"
	LeadActivityTypeOther   = "other"

	TrialStatusScheduled  = "scheduled"
	TrialStatusCompleted  = "completed"
	TrialStatusCancelled  = "cancelled"
	TrialStatusNoShow     = "no_show"

	WaiverStatusPending  = "pending"
	WaiverStatusSigned   = "signed"
	WaiverStatusExpired  = "expired"
)

// LeadActivity is a CRM activity logged against an enquiry/lead.
type LeadActivity struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EnquiryID    uint      `gorm:"not null;index" json:"enquiry_id"`
	PerformedByID uint     `json:"performed_by_id"`
	ActivityType string    `gorm:"type:enum('call','email','visit','message','other');default:call" json:"activity_type"`
	Subject      string    `gorm:"size:200" json:"subject,omitempty"`
	Notes        string    `gorm:"type:text" json:"notes,omitempty"`
	Outcome      string    `gorm:"size:200" json:"outcome,omitempty"`
	ActivityDate time.Time `gorm:"type:date;not null;index" json:"activity_date"`
	CreatedAt    time.Time `json:"created_at"`
}

// LeadFollowUp is a scheduled follow-up task for an enquiry.
type LeadFollowUp struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EnquiryID    uint      `gorm:"not null;index" json:"enquiry_id"`
	AssignedToID uint      `gorm:"not null;index" json:"assigned_to_id"`
	DueDate      time.Time `gorm:"type:date;not null;index" json:"due_date"`
	Subject      string    `gorm:"size:200" json:"subject,omitempty"`
	Notes        string    `gorm:"type:text" json:"notes,omitempty"`
	IsCompleted  bool      `gorm:"default:false;index" json:"is_completed"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// TrialVisit is a trial session booked for a lead/prospect.
type TrialVisit struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EnquiryID     uint      `gorm:"not null;index" json:"enquiry_id"`
	ScheduledAt   time.Time `gorm:"not null;index" json:"scheduled_at"`
	Status        string    `gorm:"type:enum('scheduled','completed','cancelled','no_show');default:scheduled;index" json:"status"`
	AssignedToID  uint      `json:"assigned_to_id,omitempty"` // trainer assigned for the trial
	Notes         string    `gorm:"type:text" json:"notes,omitempty"`
	Feedback      string    `gorm:"type:text" json:"feedback,omitempty"`
	ConvertedToID *uint     `gorm:"index" json:"converted_to_member_id,omitempty"` // set when trial converts
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// MemberWaiver is a PAR-Q or liability waiver linked to a member.
type MemberWaiver struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID    uint      `gorm:"not null;index" json:"member_id"`
	WaiverType  string    `gorm:"size:100;default:'liability'" json:"waiver_type"` // parq | liability | medical
	Status      string    `gorm:"type:enum('pending','signed','expired');default:pending;index" json:"status"`
	Content     string    `gorm:"type:longtext" json:"content,omitempty"` // the waiver text at signing time
	Answers     string    `gorm:"type:json" json:"answers,omitempty"`     // PAR-Q answers JSON
	SignedAt    *time.Time `json:"signed_at,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	IPAddress   string    `gorm:"size:45" json:"ip_address,omitempty"`
	Notes       string    `gorm:"type:text" json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Member Member `gorm:"foreignKey:MemberID" json:"member,omitempty"`
}
