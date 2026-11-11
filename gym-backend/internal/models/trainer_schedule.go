package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// BreakTime represents a single break within a shift.
type BreakTime struct {
	StartTime string `json:"start_time"` // "HH:MM" 24-hour
	EndTime   string `json:"end_time"`
	Label     string `json:"label"` // e.g. "Lunch", "Tea Break"
}

// BreakSlice is a JSON-serialised slice of BreakTime stored as TEXT.
type BreakSlice []BreakTime

func (b BreakSlice) Value() (driver.Value, error) {
	if b == nil {
		return "[]", nil
	}
	bs, err := json.Marshal(b)
	return string(bs), err
}

func (b *BreakSlice) Scan(value interface{}) error {
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	case nil:
		*b = BreakSlice{}
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into BreakSlice", value)
	}
	return json.Unmarshal(raw, b)
}

// TrainerSchedule holds a single recurring weekly shift slot for a trainer.
// DayOfWeek: 0 = Monday … 6 = Sunday.
type TrainerSchedule struct {
	ID        uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TrainerID uint       `gorm:"not null;index" json:"trainer_id"`
	DayOfWeek int        `gorm:"not null" json:"day_of_week"`
	StartTime string     `gorm:"type:varchar(5);not null" json:"start_time"` // "09:00"
	EndTime   string     `gorm:"type:varchar(5);not null" json:"end_time"`   // "18:00"
	Breaks    BreakSlice `gorm:"type:text" json:"breaks"`
	Notes     string     `gorm:"type:varchar(500)" json:"notes,omitempty"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
