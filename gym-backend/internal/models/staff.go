package models

import "time"

// StaffRole enumerates the roles a staff member can have.
// trainer = gym trainer; others are non-trainer staff.
const (
	StaffRoleTrainer      = "trainer"
	StaffRoleReceptionist = "receptionist"
	StaffRoleManager      = "manager"
	StaffRoleOther        = "other"
)

type Staff struct {
	ID                    uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID            uint       `gorm:"not null;index;default:1" json:"facility_id"`
	EmployeeID            string     `gorm:"size:20;not null;uniqueIndex" json:"employee_id"`
	Role                  string     `gorm:"size:30;not null;default:'other';index" json:"role"`
	UserID                *uint      `gorm:"index" json:"user_id,omitempty"`
	FirstName             string     `gorm:"size:100;not null" json:"first_name"`
	LastName              string     `gorm:"size:100;not null" json:"last_name"`
	Email                 string     `gorm:"size:200;index" json:"email"`
	Phone                 string     `gorm:"size:20;not null" json:"phone"`
	SecondaryPhone        string     `gorm:"size:20" json:"secondary_phone"`
	DateOfBirth           *time.Time `gorm:"type:date" json:"date_of_birth,omitempty"`
	Gender                string     `gorm:"size:10" json:"gender"`
	Address               string     `gorm:"type:text" json:"address"`
	EmergencyContactName  string     `gorm:"size:200" json:"emergency_contact_name"`
	EmergencyContactPhone string     `gorm:"size:20" json:"emergency_contact_phone"`
	Department            string     `gorm:"size:100;not null" json:"department"`
	Designation           string     `gorm:"size:100;not null" json:"designation"`
	EmploymentType        string     `gorm:"size:20;not null;default:'full_time'" json:"employment_type"`
	DateOfJoining         time.Time  `gorm:"type:date;not null" json:"date_of_joining"`
	ReportingTo           string     `gorm:"size:200" json:"reporting_to"`
	Salary                float64    `gorm:"type:decimal(12,2);not null;default:0" json:"salary"`
	PANNumber             string     `gorm:"column:pan_number;size:20" json:"pan_number"`
	AadharNumber          string     `gorm:"size:20" json:"aadhar_number"`
	Status                string     `gorm:"size:20;not null;default:'active';index" json:"status"`
	Notes                 string     `gorm:"type:text" json:"notes"`
	DeviceUserID          *string    `gorm:"size:50;uniqueIndex" json:"device_user_id,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`

	// Associations
	TrainerProfile *TrainerProfile `gorm:"foreignKey:StaffID" json:"trainer_profile,omitempty"`
}
