package models

import "time"

// ─── Constants ────────────────────────────────────────────────────────────────

const (
	EnquirySourceWalkIn      = "walk_in"
	EnquirySourcePhoneCall   = "phone_call"
	EnquirySourceEmail       = "email"
	EnquirySourceSocialMedia = "social_media"
	EnquirySourceReferral    = "referral"
	EnquirySourceWebsite     = "website"
	EnquirySourceOther       = "other"

	EnquiryStatusNew            = "new"
	EnquiryStatusContacted      = "contacted"
	EnquiryStatusVisitScheduled = "visit_scheduled"
	EnquiryStatusConverted      = "converted"
	EnquiryStatusClosed         = "closed"
)

// ─── Enquiry ──────────────────────────────────────────────────────────────────

type Enquiry struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID     uint   `gorm:"not null;index" json:"facility_id"`
	FirstName      string `gorm:"size:100" json:"first_name,omitempty"`
	LastName       string `gorm:"size:100" json:"last_name,omitempty"`
	Name           string `gorm:"size:200;not null" json:"name"`
	Email          string `gorm:"size:255" json:"email"`
	Phone          string `gorm:"size:20;not null" json:"phone"`
	Source         string `gorm:"size:30;not null;default:'walk_in'" json:"source"`
	SourceDetail   string `gorm:"size:200" json:"source_detail,omitempty"`
	ReferredBy     string `gorm:"size:200" json:"referred_by,omitempty"`
	MembershipType string `gorm:"size:30" json:"membership_type,omitempty"` // individual / couple / group
	PlanInterest   string `gorm:"size:200" json:"plan_interest"`
	BudgetRange    string `gorm:"size:100" json:"budget_range,omitempty"`
	FitnessGoal    string `gorm:"type:text" json:"fitness_goal,omitempty"` // comma-separated
	Status       string     `gorm:"size:30;not null;default:'new';index" json:"status"`
	AssignedToID *uint      `gorm:"index" json:"assigned_to_id,omitempty"`
	Notes        string     `gorm:"type:text" json:"notes"`
	Remarks      string     `gorm:"type:text" json:"remarks,omitempty"`
	FollowUpDate *time.Time `gorm:"type:date" json:"follow_up_date,omitempty"`
	LikelyJoiningDate *time.Time `gorm:"type:date" json:"likely_joining_date,omitempty"`
	TrialVisitDate *time.Time `gorm:"type:date" json:"trial_visit_date,omitempty"`
	ConvertedMemberID *uint `gorm:"index" json:"converted_member_id,omitempty"`
	CreatedByID  *uint      `json:"created_by_id,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	AssignedTo *User `gorm:"foreignKey:AssignedToID" json:"assigned_to,omitempty"`
}
