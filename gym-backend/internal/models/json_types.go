package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// JSONMap is a map[string]interface{} stored as TEXT/JSON in MySQL.
type JSONMap map[string]interface{}

func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	b, err := json.Marshal(j)
	return string(b), err
}

func (j *JSONMap) Scan(value interface{}) error {
	var raw []byte
	switch v := value.(type) {
	case []byte:
		raw = v
	case string:
		raw = []byte(v)
	case nil:
		*j = JSONMap{}
		return nil
	default:
		return fmt.Errorf("cannot scan type %T into JSONMap", value)
	}
	return json.Unmarshal(raw, j)
}
