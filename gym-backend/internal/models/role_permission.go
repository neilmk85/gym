package models

type RolePermission struct {
	Role       string `json:"role" db:"role"`
	Permission string `json:"permission" db:"permission"`
	Granted    bool   `json:"granted" db:"granted"`
}
