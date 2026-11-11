package models

import "time"

type Facility struct {
	ID                   uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name                 string  `gorm:"size:100;not null" json:"name"`
	Address              string  `gorm:"type:text" json:"address"`
	City                 string  `gorm:"size:50" json:"city"`
	State                string  `gorm:"size:50" json:"state"`
	PostalCode           string  `gorm:"size:20" json:"postal_code"`
	Country              string  `gorm:"size:50;default:India" json:"country"`
	Phone                string  `gorm:"size:20" json:"phone"`
	Email                string  `gorm:"size:255" json:"email"`
	Latitude             float64 `gorm:"type:decimal(10,8)" json:"latitude"`
	Longitude            float64 `gorm:"type:decimal(11,8)" json:"longitude"`
	GeofenceRadiusMeters int     `gorm:"default:50" json:"geofence_radius_meters"`
	MaxCapacity          int     `gorm:"default:200" json:"max_capacity"`
	OpeningTime          string  `gorm:"size:8;default:'06:00:00'" json:"opening_time"`
	ClosingTime          string  `gorm:"size:8;default:'22:00:00'" json:"closing_time"`
	CreatedAt            time.Time `json:"created_at"`
	UpdatedAt            time.Time `json:"updated_at"`
}
