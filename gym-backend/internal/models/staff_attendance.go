package models

import "time"

const (
	AttendanceStatusPresent  = "present"
	AttendanceStatusAbsent   = "absent"
	AttendanceStatusHalfDay  = "half_day"
	AttendanceStatusLeave    = "leave"
	AttendanceStatusHoliday  = "holiday"

	SalarySlipStatusDraft     = "draft"
	SalarySlipStatusFinalized = "finalized"
	SalarySlipStatusPaid      = "paid"
)

type StaffAttendance struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID   uint       `gorm:"not null;index;default:1" json:"facility_id"`
	StaffID      uint       `gorm:"not null;index" json:"staff_id"`
	Date         time.Time  `gorm:"type:date;not null;index" json:"date"`
	Status       string     `gorm:"size:20;not null;default:'present'" json:"status"`
	CheckIn      *string    `gorm:"size:10" json:"check_in,omitempty"`  // "09:00"
	CheckOut     *string    `gorm:"size:10" json:"check_out,omitempty"` // "18:00"
	WorkingHours float64    `gorm:"type:decimal(4,2);default:0" json:"working_hours"`
	Notes        string     `gorm:"size:500" json:"notes,omitempty"`
	MarkedByID   uint       `json:"marked_by_id"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`

	Staff Staff `gorm:"foreignKey:StaffID" json:"staff,omitempty"`
}

type SalarySlip struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID    uint       `gorm:"not null;index;default:1" json:"facility_id"`
	StaffID       uint       `gorm:"not null;index" json:"staff_id"`
	Month         int        `gorm:"not null" json:"month"`
	Year          int        `gorm:"not null" json:"year"`
	WorkingDays   int        `gorm:"not null;default:26" json:"working_days"`
	PresentDays   int        `gorm:"not null;default:0" json:"present_days"`
	AbsentDays    int        `gorm:"not null;default:0" json:"absent_days"`
	HalfDays      int        `gorm:"not null;default:0" json:"half_days"`
	LeaveDays     int        `gorm:"not null;default:0" json:"leave_days"`
	HolidayDays   int        `gorm:"not null;default:0" json:"holiday_days"`
	BaseSalary    float64    `gorm:"type:decimal(12,2);not null" json:"base_salary"`
	EarnedSalary  float64    `gorm:"type:decimal(12,2);not null" json:"earned_salary"`
	Deductions    float64    `gorm:"type:decimal(12,2);default:0" json:"deductions"`
	Bonus         float64    `gorm:"type:decimal(12,2);default:0" json:"bonus"`
	NetSalary     float64    `gorm:"type:decimal(12,2);not null" json:"net_salary"`
	Status        string     `gorm:"size:20;not null;default:'draft'" json:"status"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
	Notes         string     `gorm:"size:500" json:"notes,omitempty"`
	GeneratedByID uint       `json:"generated_by_id"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	Staff Staff `gorm:"foreignKey:StaffID" json:"staff,omitempty"`
}
