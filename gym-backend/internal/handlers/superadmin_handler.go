package handlers

import (
	"encoding/json"
	"net/http"

	"gym-backend/internal/constants"
	"gym-backend/internal/middleware"
	"gym-backend/internal/repositories"
	"gym-backend/internal/response"
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

	response.JSON(w, r, http.StatusOK, map[string]any{
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

	response.JSON(w, r, http.StatusOK, map[string]string{"status": "ok"})
}

// GET /api/v1/auth/my-permissions
// Returns the list of permissions granted to the calling user's role.
// Superadmin receives all permissions automatically.
func (h *SuperAdminHandler) MyPermissions(w http.ResponseWriter, r *http.Request) {
	claims := middleware.ClaimsFromContext(r.Context())
	if claims == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Role == constants.RoleSuperAdmin {
		response.JSON(w, r, http.StatusOK, map[string]any{"permissions": constants.AllPermissions})
		return
	}
	rows, err := h.rpRepo.GetAll()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	var perms []string
	for _, rp := range rows {
		if rp.Role == claims.Role && rp.Granted {
			perms = append(perms, rp.Permission)
		}
	}
	if perms == nil {
		perms = []string{}
	}
	response.JSON(w, r, http.StatusOK, map[string]any{"permissions": perms})
}
