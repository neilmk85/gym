package services

import (
	"log/slog"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

type AuditService interface {
	List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error)
}

type auditService struct {
	auditRepo repositories.AuditLogRepository
	logger    *slog.Logger
}

func NewAuditService(auditRepo repositories.AuditLogRepository, logger *slog.Logger) AuditService {
	return &auditService{auditRepo: auditRepo, logger: logger}
}

func (s *auditService) List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error) {
	logs, total, err := s.auditRepo.List(req, userID, resourceType)
	if err != nil {
		s.logger.Error("audit list failed", "err", err)
		return nil, 0, apperrors.ErrInternal
	}
	return logs, total, nil
}
