package repositories

import (
	"database/sql"
	"gym-backend/internal/models"
)

type RolePermissionRepo struct{ db *sql.DB }

func NewRolePermissionRepo(db *sql.DB) *RolePermissionRepo {
	return &RolePermissionRepo{db: db}
}

// GetAll returns every role+permission row in the DB.
func (r *RolePermissionRepo) GetAll() ([]models.RolePermission, error) {
	rows, err := r.db.Query(`SELECT role, permission, granted FROM role_permissions`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []models.RolePermission
	for rows.Next() {
		var rp models.RolePermission
		if err := rows.Scan(&rp.Role, &rp.Permission, &rp.Granted); err != nil {
			return nil, err
		}
		out = append(out, rp)
	}
	return out, rows.Err()
}

// Upsert inserts or updates a single role+permission grant.
func (r *RolePermissionRepo) Upsert(role, permission string, granted bool) error {
	_, err := r.db.Exec(
		`INSERT INTO role_permissions (role, permission, granted) VALUES (?,?,?)
		 ON DUPLICATE KEY UPDATE granted=VALUES(granted)`,
		role, permission, granted,
	)
	return err
}
