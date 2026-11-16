package models

import "time"

type TrainerPunch struct {
	ID               uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TrainerID        uint      `gorm:"not null;index" json:"trainer_id"`
	FacilityID       uint      `gorm:"not null;index;default:1" json:"facility_id"`
	PunchedAt        time.Time `gorm:"not null;index" json:"punched_at"`         // device clock
	ServerReceivedAt time.Time `gorm:"not null" json:"server_received_at"`        // ADMS server clock
	CreatedAt        time.Time `json:"created_at"`

	Trainer TrainerProfile `gorm:"foreignKey:TrainerID" json:"trainer,omitempty"`
}
