package models

import "time"

const (
	MaintenanceStatusPending    = "pending"
	MaintenanceStatusInProgress = "in_progress"
	MaintenanceStatusDone       = "done"
	MaintenanceStatusCancelled  = "cancelled"

	MaintenancePriorityLow    = "low"
	MaintenancePriorityMedium = "medium"
	MaintenancePriorityHigh   = "high"

	MaintenanceCategoryEquipment  = "equipment"
	MaintenanceCategoryPlumbing   = "plumbing"
	MaintenanceCategoryElectrical = "electrical"
	MaintenanceCategoryHVAC       = "hvac"
	MaintenanceCategoryFlooring   = "flooring"
	MaintenanceCategoryOther      = "other"
)

type MaintenanceTask struct {
	ID          uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	FacilityID  uint       `gorm:"not null;index" json:"facility_id"`
	Title       string     `gorm:"size:200;not null" json:"title"`
	Description string     `gorm:"type:text" json:"description"`
	Category    string     `gorm:"size:30;not null;default:'other';index" json:"category"`
	Priority    string     `gorm:"size:10;not null;default:'medium';index" json:"priority"`
	Status      string     `gorm:"size:20;not null;default:'pending';index" json:"status"`
	AssignedTo  string     `gorm:"size:200" json:"assigned_to"`
	EstimateCost float64   `gorm:"type:decimal(12,2);default:0" json:"estimate_cost"`
	ActualCost   float64   `gorm:"type:decimal(12,2);default:0" json:"actual_cost"`
	ScheduledAt *time.Time `gorm:"index" json:"scheduled_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	Notes       string     `gorm:"type:text" json:"notes"`
	CreatedByID *uint      `json:"created_by_id,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
