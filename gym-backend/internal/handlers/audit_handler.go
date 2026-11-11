package handlers

import (
	"net/http"
	"strconv"

	"gym-backend/internal/response"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)

type AuditHandler struct {
	auditSvc services.AuditService
}

func NewAuditHandler(auditSvc services.AuditService) *AuditHandler {
	return &AuditHandler{auditSvc: auditSvc}
}

// GET /api/v1/audit-logs?user_id=&resource_type=
func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	req := utils.ParsePageRequest(r)

	var userID *uint
	if v := r.URL.Query().Get("user_id"); v != "" {
		n, err := strconv.ParseUint(v, 10, 64)
		if err == nil && n > 0 {
			id := uint(n)
			userID = &id
		}
	}
	resourceType := r.URL.Query().Get("resource_type")

	logs, total, err := h.auditSvc.List(req, userID, resourceType)
	if err != nil {
		response.Error(w, r, err)
		return
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"audit_logs": logs,
		"meta":       utils.BuildPageMeta(req, total),
	})
}
