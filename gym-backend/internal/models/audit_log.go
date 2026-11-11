package models

import "time"

type AuditLog struct {
	ID           uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint    `gorm:"not null;index" json:"user_id"`
	Action       string  `gorm:"size:100" json:"action"`
	ResourceType string  `gorm:"size:50;index" json:"resource_type"`
	ResourceID   *uint   `gorm:"index" json:"resource_id,omitempty"`
	OldValues    JSONMap `gorm:"type:text" json:"old_values,omitempty"`
	NewValues    JSONMap `gorm:"type:text" json:"new_values,omitempty"`
	IPAddress    string  `gorm:"size:45" json:"ip_address,omitempty"`
	UserAgent    string  `gorm:"type:text" json:"user_agent,omitempty"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}
