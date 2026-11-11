package handlers

import (
	"net/http"

	"gorm.io/gorm"

	"gym-backend/internal/response"
)

type HealthHandler struct {
	db *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Health(w http.ResponseWriter, r *http.Request) {
	status := "ok"
	dbStatus := "ok"

	sqlDB, err := h.db.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "error"
		status = "degraded"
	}

	response.JSON(w, r, http.StatusOK, map[string]interface{}{
		"status":   status,
		"database": dbStatus,
	})
}
