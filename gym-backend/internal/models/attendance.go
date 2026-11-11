package models

import "time"

const (
	CheckInMethodQR       = "qr"
	CheckInMethodManual   = "manual"
	CheckInMethodGeofence = "geofence"
	CheckInMethodCard     = "card"
)

type Attendance struct {
	ID         uint `gorm:"primaryKey;autoIncrement" json:"id"`
	MemberID   uint `gorm:"not null;index" json:"member_id"`
	FacilityID uint `gorm:"not null;index" json:"facility_id"`

	CheckInAt    time.Time  `gorm:"not null;index" json:"check_in_at"`
	CheckOutAt   *time.Time `json:"check_out_at,omitempty"`
	DurationMins *int       `json:"duration_mins,omitempty"` // filled on checkout

	Method        string `gorm:"type:enum('qr','manual','geofence','card');default:manual" json:"method"`
	Notes         string `gorm:"size:200" json:"notes,omitempty"`
	CheckedInByID *uint  `json:"checked_in_by_id,omitempty"` // staff for manual check-in

	// Location capture (geofence check-in)
	Latitude  *float64 `gorm:"type:decimal(10,8)" json:"latitude,omitempty"`
	Longitude *float64 `gorm:"type:decimal(11,8)" json:"longitude,omitempty"`

	IPAddress string `gorm:"size:45" json:"ip_address,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Associations
	Member   Member   `gorm:"foreignKey:MemberID" json:"member,omitempty"`
	Facility Facility `gorm:"foreignKey:FacilityID" json:"facility,omitempty"`
}

// MemberStats aggregates attendance data for one member.
type MemberAttendanceStats struct {
	MemberID       uint    `json:"member_id"`
	TotalVisits    int64   `json:"total_visits"`
	VisitsThisMonth int64  `json:"visits_this_month"`
	VisitsThisWeek int64   `json:"visits_this_week"`
	AvgDurationMins float64 `json:"avg_duration_mins"`
	LastVisitAt    *time.Time `json:"last_visit_at,omitempty"`
}
