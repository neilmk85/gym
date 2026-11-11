package services

import (
	"log/slog"
	"net/http"
	"time"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/utils"
)

// ─── DTOs ────────────────────────────────────────────────────────────────────

type BookClassRequest struct {
	ClassID   uint  `json:"class_id"`
	MemberID  uint  `json:"member_id"`
	DayPassID *uint `json:"day_pass_id,omitempty"`
}

type CancelBookingRequest struct {
	Reason string `json:"reason"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type BookingService interface {
	Book(req BookClassRequest, actorID uint) (*models.ClassBooking, error)
	CancelBooking(bookingID uint, req CancelBookingRequest, actorID uint) (*models.ClassBooking, error)
	MarkAttended(bookingID uint, actorID uint) (*models.ClassBooking, error)
	MarkNoShow(bookingID uint, actorID uint) (*models.ClassBooking, error)
	GetByID(id uint) (*models.ClassBooking, error)
	ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
	ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
	List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error)
	ListUpcomingByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error)
}

type bookingService struct {
	bookingRepo repositories.BookingRepository
	classRepo   repositories.ClassRepository
	memberRepo  repositories.MemberRepository
	planRepo    repositories.PlanRepository
	subRepo     repositories.SubscriptionRepository
	dayPassRepo repositories.DayPassRepository
	notifSvc    NotificationService
	logger      *slog.Logger
}

func NewBookingService(
	bookingRepo repositories.BookingRepository,
	classRepo repositories.ClassRepository,
	memberRepo repositories.MemberRepository,
	planRepo repositories.PlanRepository,
	subRepo repositories.SubscriptionRepository,
	dayPassRepo repositories.DayPassRepository,
	notifSvc NotificationService,
	logger *slog.Logger,
) BookingService {
	return &bookingService{
		bookingRepo: bookingRepo,
		classRepo:   classRepo,
		memberRepo:  memberRepo,
		planRepo:    planRepo,
		subRepo:     subRepo,
		dayPassRepo: dayPassRepo,
		notifSvc:    notifSvc,
		logger:      logger,
	}
}

func (s *bookingService) Book(req BookClassRequest, actorID uint) (*models.ClassBooking, error) {
	if req.ClassID == 0 {
		return nil, apperrors.ErrValidation("class_id is required")
	}
	if req.DayPassID == nil && req.MemberID == 0 {
		return nil, apperrors.ErrValidation("either member_id or day_pass_id is required")
	}

	// Load & validate class.
	class, err := s.classRepo.FindByID(req.ClassID)
	if err != nil || class == nil {
		return nil, apperrors.New(http.StatusNotFound, "CLS_001", "Class not found", "")
	}
	if class.Status != models.ClassStatusScheduled {
		return nil, apperrors.New(http.StatusConflict, "BKG_001", "Class is not open for booking", "")
	}
	if class.StartTime.Before(time.Now()) {
		return nil, apperrors.New(http.StatusConflict, "BKG_002", "Cannot book a class that has already started", "")
	}

	now := time.Now()
	booking := &models.ClassBooking{
		ClassID:  req.ClassID,
		BookedAt: now,
	}

	if req.DayPassID != nil {
		// ── Day pass (walk-in) booking ────────────────────────────────────────
		dp, err := s.dayPassRepo.FindByID(*req.DayPassID)
		if err != nil || dp == nil {
			return nil, apperrors.New(http.StatusNotFound, "BKG_013", "Day pass not found", "")
		}
		if dp.Status != models.DayPassStatusActive {
			return nil, apperrors.New(http.StatusConflict, "BKG_014", "Day pass is not active", "")
		}
		passDay := dp.PassDate.Truncate(24 * time.Hour)
		classDay := class.StartTime.Truncate(24 * time.Hour)
		if !passDay.Equal(classDay) {
			return nil, apperrors.New(http.StatusConflict, "BKG_015", "Day pass date does not match the class date", "")
		}
		booking.DayPassID = req.DayPassID
	} else {
		// ── Member booking ────────────────────────────────────────────────────
		member, err := s.memberRepo.FindByID(req.MemberID)
		if err != nil || member == nil {
			return nil, apperrors.ErrMemberNotFound
		}
		if member.MembershipStatus != models.MemberStatusActive {
			return nil, apperrors.New(http.StatusConflict, "BKG_003", "Member does not have an active membership", "")
		}
		if member.FacilityID != class.FacilityID {
			return nil, apperrors.New(http.StatusForbidden, "BKG_012", "Member is not enrolled at the class facility", "")
		}
		if class.IsFree {
			if err := s.checkGroupClassAccess(member); err != nil {
				return nil, err
			}
		}
		// Prevent duplicate booking.
		existing, err := s.bookingRepo.FindByMemberAndClass(req.MemberID, req.ClassID)
		if err != nil {
			return nil, apperrors.ErrInternal
		}
		if existing != nil {
			if existing.Status == models.BookingStatusConfirmed {
				return nil, apperrors.New(http.StatusConflict, "BKG_004", "Member is already booked for this class", "")
			}
			if existing.Status == models.BookingStatusWaitlisted {
				return nil, apperrors.New(http.StatusConflict, "BKG_005", "Member is already on the waitlist", "")
			}
		}
		booking.MemberID = &req.MemberID

		defer func() {
			if booking.Status == models.BookingStatusConfirmed {
				go s.notifSvc.Dispatch(BookingConfirmedEvent(member.User.ID, booking.ID, class.Name, class.StartTime))
			} else if booking.Status == models.BookingStatusWaitlisted && booking.WaitlistPosition != nil {
				go s.notifSvc.Dispatch(BookingWaitlistedEvent(member.User.ID, booking.ID, class.Name, *booking.WaitlistPosition))
			}
		}()
	}

	// Determine confirmed vs waitlisted.
	if class.CurrentEnrollment < class.MaxCapacity {
		booking.Status = models.BookingStatusConfirmed
		if err := s.bookingRepo.Create(booking); err != nil {
			s.logger.Error("create booking failed", "err", err)
			return nil, apperrors.ErrInternal
		}
		_ = s.classRepo.IncrementEnrollment(req.ClassID, 1)
	} else {
		waitlistPos := class.WaitlistCount + 1
		booking.Status = models.BookingStatusWaitlisted
		booking.WaitlistPosition = &waitlistPos
		if err := s.bookingRepo.Create(booking); err != nil {
			s.logger.Error("create waitlisted booking failed", "err", err)
			return nil, apperrors.ErrInternal
		}
		_ = s.classRepo.IncrementWaitlist(req.ClassID, 1)
	}

	loaded, err := s.bookingRepo.FindByID(booking.ID)
	if err != nil || loaded == nil {
		return booking, nil
	}
	return loaded, nil
}

func (s *bookingService) CancelBooking(bookingID uint, req CancelBookingRequest, actorID uint) (*models.ClassBooking, error) {
	booking, err := s.bookingRepo.FindByID(bookingID)
	if err != nil || booking == nil {
		return nil, apperrors.New(http.StatusNotFound, "BKG_006", "Booking not found", "")
	}
	if booking.Status == models.BookingStatusCancelled {
		return nil, apperrors.New(http.StatusConflict, "BKG_007", "Booking is already cancelled", "")
	}

	wasConfirmed := booking.Status == models.BookingStatusConfirmed
	wasWaitlisted := booking.Status == models.BookingStatusWaitlisted
	waitlistPos := 0
	if booking.WaitlistPosition != nil {
		waitlistPos = *booking.WaitlistPosition
	}

	now := time.Now()
	booking.Status = models.BookingStatusCancelled
	booking.CancelledAt = &now
	booking.CancelReason = req.Reason
	booking.WaitlistPosition = nil

	if err := s.bookingRepo.Update(booking); err != nil {
		return nil, apperrors.ErrInternal
	}

	if wasConfirmed {
		// Decrement class enrollment.
		_ = s.classRepo.IncrementEnrollment(booking.ClassID, -1)

		// Promote first person on waitlist (if any).
		if err := s.promoteWaitlist(booking.ClassID); err != nil {
			s.logger.Error("promote waitlist failed", "class_id", booking.ClassID, "err", err)
		}
	}

	if wasWaitlisted && waitlistPos > 0 {
		// Shift all subsequent waitlist positions down.
		_ = s.bookingRepo.ShiftWaitlistDown(booking.ClassID, waitlistPos)
		_ = s.classRepo.IncrementWaitlist(booking.ClassID, -1)
	}

	return booking, nil
}

func (s *bookingService) MarkAttended(bookingID uint, actorID uint) (*models.ClassBooking, error) {
	booking, err := s.bookingRepo.FindByID(bookingID)
	if err != nil || booking == nil {
		return nil, apperrors.New(http.StatusNotFound, "BKG_006", "Booking not found", "")
	}
	if booking.Status != models.BookingStatusConfirmed {
		return nil, apperrors.New(http.StatusConflict, "BKG_008", "Only confirmed bookings can be marked as attended", "")
	}
	booking.Status = models.BookingStatusAttended
	if err := s.bookingRepo.Update(booking); err != nil {
		return nil, apperrors.ErrInternal
	}
	return booking, nil
}

func (s *bookingService) MarkNoShow(bookingID uint, actorID uint) (*models.ClassBooking, error) {
	booking, err := s.bookingRepo.FindByID(bookingID)
	if err != nil || booking == nil {
		return nil, apperrors.New(http.StatusNotFound, "BKG_006", "Booking not found", "")
	}
	if booking.Status != models.BookingStatusConfirmed {
		return nil, apperrors.New(http.StatusConflict, "BKG_009", "Only confirmed bookings can be marked as no-show", "")
	}
	booking.Status = models.BookingStatusNoShow
	if err := s.bookingRepo.Update(booking); err != nil {
		return nil, apperrors.ErrInternal
	}
	return booking, nil
}

func (s *bookingService) GetByID(id uint) (*models.ClassBooking, error) {
	b, err := s.bookingRepo.FindByID(id)
	if err != nil {
		return nil, apperrors.ErrInternal
	}
	if b == nil {
		return nil, apperrors.New(http.StatusNotFound, "BKG_006", "Booking not found", "")
	}
	return b, nil
}

func (s *bookingService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	return s.bookingRepo.ListByMember(memberID, req)
}

func (s *bookingService) ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	return s.bookingRepo.ListByClass(classID, req)
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// promoteWaitlist moves the first waitlisted person to confirmed status.
func (s *bookingService) promoteWaitlist(classID uint) error {
	next, err := s.bookingRepo.FirstWaitlisted(classID)
	if err != nil || next == nil {
		return err
	}

	next.Status = models.BookingStatusConfirmed
	next.WaitlistPosition = nil
	if err := s.bookingRepo.Update(next); err != nil {
		return err
	}

	_ = s.classRepo.IncrementEnrollment(classID, 1)
	_ = s.classRepo.IncrementWaitlist(classID, -1)
	_ = s.bookingRepo.ShiftWaitlistDown(classID, 1)

	// Notify the promoted member (only for member bookings).
	if next.MemberID != nil {
		if member, err := s.memberRepo.FindByID(*next.MemberID); err == nil && member != nil {
			if class, err := s.classRepo.FindByID(classID); err == nil && class != nil {
				go s.notifSvc.Dispatch(BookingPromotedEvent(member.User.ID, next.ID, class.Name))
			}
		}
	}
	return nil
}

func (s *bookingService) List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error) {
	if status != "" {
		switch status {
		case models.BookingStatusConfirmed, models.BookingStatusWaitlisted,
			models.BookingStatusCancelled, models.BookingStatusAttended,
			models.BookingStatusNoShow:
		default:
			return nil, 0, apperrors.ErrValidation("invalid status; must be one of: confirmed, waitlisted, cancelled, attended, no_show")
		}
	}
	return s.bookingRepo.List(req, classID, memberID, status)
}

func (s *bookingService) ListUpcomingByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	member, err := s.memberRepo.FindByID(memberID)
	if err != nil {
		return nil, 0, apperrors.ErrInternal
	}
	if member == nil {
		return nil, 0, apperrors.ErrMemberNotFound
	}
	return s.bookingRepo.ListUpcomingByMember(memberID, time.Now(), req)
}

// checkGroupClassAccess verifies the member's active plan allows group class access.
func (s *bookingService) checkGroupClassAccess(member *models.Member) error {
	if member.CurrentPlanID == nil {
		return apperrors.New(http.StatusConflict, "BKG_010", "No active plan found", "Member needs a plan with group class access")
	}

	plan, err := s.planRepo.FindByID(*member.CurrentPlanID)
	if err != nil || plan == nil {
		return apperrors.ErrInternal
	}
	if !plan.GroupClassAccess {
		return apperrors.New(http.StatusConflict, "BKG_011", "Your plan does not include group class access", "Please upgrade your plan")
	}
	return nil
}
