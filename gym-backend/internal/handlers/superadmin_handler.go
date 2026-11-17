package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/constants"
	"gym-backend/internal/repositories"
)

type SuperAdminHandler struct {
	rpRepo *repositories.RolePermissionRepo
}

func NewSuperAdminHandler(rpRepo *repositories.RolePermissionRepo) *SuperAdminHandler {
	return &SuperAdminHandler{rpRepo: rpRepo}
}

// GET /superadmin/entitlements
// Returns a matrix: { roles: [...], permissions: [...], grants: { "role::perm": true } }
func (h *SuperAdminHandler) GetEntitlements(w http.ResponseWriter, r *http.Request) {
	rows, err := h.rpRepo.GetAll()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	grants := map[string]bool{}
	for _, rp := range rows {
		if rp.Granted {
			grants[rp.Role+"::"+rp.Permission] = true
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"roles":       constants.ManageableRoles,
		"permissions": constants.AllPermissions,
		"grants":      grants,
	})
}

// PUT /superadmin/entitlements
// Body: [ { role, permission, granted }, ... ]
func (h *SuperAdminHandler) UpdateEntitlements(w http.ResponseWriter, r *http.Request) {
	var items []struct {
		Role       string `json:"role"`
		Permission string `json:"permission"`
		Granted    bool   `json:"granted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	for _, item := range items {
		if err := h.rpRepo.Upsert(item.Role, item.Permission, item.Granted); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
