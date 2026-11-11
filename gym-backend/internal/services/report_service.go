package services

import (
	"log/slog"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/repositories"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────────

// DateRangeRequest carries parsed from/to boundaries used by most reports.
type DateRangeRequest struct {
	From time.Time
	To   time.Time
}

// ParseDateRange parses optional from/to strings (YYYY-MM-DD).
// Defaults: from = first day of current month, to = now.
func ParseDateRange(fromStr, toStr string) (DateRangeRequest, error) {
	now := time.Now()
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	to := now

	if fromStr != "" {
		t, err := time.ParseInLocation("2006-01-02", fromStr, now.Location())
		if err != nil {
			return DateRangeRequest{}, apperrors.ErrValidation("invalid from date; use YYYY-MM-DD")
		}
		from = t
	}
	if toStr != "" {
		t, err := time.ParseInLocation("2006-01-02", toStr, now.Location())
		if err != nil {
			return DateRangeRequest{}, apperrors.ErrValidation("invalid to date; use YYYY-MM-DD")
		}
		// Include the full day.
		to = time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, t.Location())
	}
	if from.After(to) {
		return DateRangeRequest{}, apperrors.ErrValidation("from date must be before to date")
	}
	return DateRangeRequest{From: from, To: to}, nil
}

// ─── Service ──────────────────────────────────────────────────────────────────

type ReportService interface {
	Dashboard(facilityID uint) (*repositories.DashboardStats, error)
	Revenue(facilityID uint, dr DateRangeRequest) (*repositories.RevenueReport, error)
	Attendance(facilityID uint, dr DateRangeRequest) (*repositories.AttendanceReport, error)
	Members(facilityID uint) (*repositories.MemberReport, error)
	Subscriptions(facilityID uint) (*repositories.SubscriptionReport, error)
	Classes(facilityID uint, dr DateRangeRequest) (*repositories.ClassReport, error)
	MemberTimeline(memberID uint, limit int) ([]repositories.TimelineEvent, error)
	ExpiringMembers(facilityID uint, days int) ([]repositories.ExpiringMember, error)
	InactiveMembers(facilityID uint, days int) ([]repositories.InactiveMember, error)
	Trainers(facilityID uint) (*repositories.TrainerReport, error)
}

type reportService struct {
	reportRepo repositories.ReportRepository
	logger     *slog.Logger
}

func NewReportService(reportRepo repositories.ReportRepository, logger *slog.Logger) ReportService {
	return &reportService{reportRepo: reportRepo, logger: logger}
}

func (s *reportService) Dashboard(facilityID uint) (*repositories.DashboardStats, error) {
	stats, err := s.reportRepo.Dashboard(facilityID)
	if err != nil {
		s.logger.Error("dashboard report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return stats, nil
}

func (s *reportService) Revenue(facilityID uint, dr DateRangeRequest) (*repositories.RevenueReport, error) {
	rep, err := s.reportRepo.Revenue(facilityID, dr.From, dr.To)
	if err != nil {
		s.logger.Error("revenue report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}

func (s *reportService) Attendance(facilityID uint, dr DateRangeRequest) (*repositories.AttendanceReport, error) {
	rep, err := s.reportRepo.Attendance(facilityID, dr.From, dr.To)
	if err != nil {
		s.logger.Error("attendance report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}

func (s *reportService) Members(facilityID uint) (*repositories.MemberReport, error) {
	rep, err := s.reportRepo.Members(facilityID)
	if err != nil {
		s.logger.Error("member report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}

func (s *reportService) Subscriptions(facilityID uint) (*repositories.SubscriptionReport, error) {
	rep, err := s.reportRepo.Subscriptions(facilityID)
	if err != nil {
		s.logger.Error("subscription report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}

func (s *reportService) Classes(facilityID uint, dr DateRangeRequest) (*repositories.ClassReport, error) {
	rep, err := s.reportRepo.Classes(facilityID, dr.From, dr.To)
	if err != nil {
		s.logger.Error("class report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}

func (s *reportService) MemberTimeline(memberID uint, limit int) ([]repositories.TimelineEvent, error) {
	events, err := s.reportRepo.MemberTimeline(memberID, limit)
	if err != nil {
		s.logger.Error("member timeline failed", "member_id", memberID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return events, nil
}

func (s *reportService) ExpiringMembers(facilityID uint, days int) ([]repositories.ExpiringMember, error) {
	rows, err := s.reportRepo.ExpiringMembers(facilityID, days)
	if err != nil {
		s.logger.Error("expiring members report failed", "facility_id", facilityID, "days", days, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rows, nil
}

func (s *reportService) InactiveMembers(facilityID uint, days int) ([]repositories.InactiveMember, error) {
	rows, err := s.reportRepo.InactiveMembers(facilityID, days)
	if err != nil {
		s.logger.Error("inactive members report failed", "facility_id", facilityID, "days", days, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rows, nil
}

func (s *reportService) Trainers(facilityID uint) (*repositories.TrainerReport, error) {
	rep, err := s.reportRepo.Trainers(facilityID)
	if err != nil {
		s.logger.Error("trainer report failed", "facility_id", facilityID, "err", err)
		return nil, apperrors.ErrInternal
	}
	return rep, nil
}
