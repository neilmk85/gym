package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gym-backend/internal/constants"
	"gym-backend/internal/middleware"
	"gym-backend/internal/repositories"
	"gym-backend/internal/response"
	"gym-backend/internal/services"
)

type SuperAdminHandler struct {
	rpRepo   *repositories.RolePermissionRepo
	userRepo repositories.UserRepository
	authSvc  services.AuthService
}

func NewSuperAdminHandler(rpRepo *repositories.RolePermissionRepo, userRepo repositories.UserRepository, authSvc services.AuthService) *SuperAdminHandler {
	return &SuperAdminHandler{rpRepo: rpRepo, userRepo: userRepo, authSvc: authSvc}
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

// GET /api/v1/superadmin/users?search=&role=&status=&page=1&per_page=25
func (h *SuperAdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("search"))
	role   := q.Get("role")
	status := q.Get("status")
	page, _    := strconv.Atoi(q.Get("page"))
	perPage, _ := strconv.Atoi(q.Get("per_page"))
	if page < 1 { page = 1 }
	if perPage < 1 || perPage > 100 { perPage = 25 }

	users, total, err := h.userRepo.ListStaff(search, role, status, page, perPage)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	response.JSON(w, r, http.StatusOK, map[string]any{
		"users": users,
		"meta": map[string]any{
			"total":       total,
			"page":        page,
			"per_page":    perPage,
			"total_pages": (total + int64(perPage) - 1) / int64(perPage),
		},
	})
}

// PATCH /api/v1/superadmin/users/:id
func (h *SuperAdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		FirstName *string `json:"first_name"`
		LastName  *string `json:"last_name"`
		Email     *string `json:"email"`
		Phone     *string `json:"phone"`
		Role      *string `json:"role"`
		Status    *string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}

	fields := map[string]interface{}{}
	if body.FirstName != nil { fields["first_name"] = *body.FirstName }
	if body.LastName  != nil { fields["last_name"]  = *body.LastName }
	if body.Email     != nil { fields["email"]       = *body.Email }
	if body.Phone     != nil { fields["phone"]       = *body.Phone }
	if body.Role      != nil { fields["role"]        = *body.Role }
	if body.Status    != nil { fields["status"]      = *body.Status }

	if len(fields) == 0 {
		http.Error(w, "nothing to update", http.StatusBadRequest)
		return
	}
	if err := h.userRepo.UpdateFields(uint(id), fields); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	user, _ := h.userRepo.FindByID(uint(id))
	response.JSON(w, r, http.StatusOK, user)
}

// POST /api/v1/superadmin/users
func (h *SuperAdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req services.SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	info, err := h.authSvc.SignupStaff(req)
	if err != nil {
		response.Error(w, r, err)
		return
	}
	response.JSON(w, r, http.StatusCreated, info)
}
