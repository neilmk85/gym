package services_test

import (
	"log/slog"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
	"gym-backend/internal/utils"
)

func newBookingSvc(t *testing.T) (
	services.BookingService,
	*testhelpers.MockBookingRepo,
	*testhelpers.MockClassRepo,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockPlanRepo,
	*testhelpers.MockNotifService,
) {
	t.Helper()
	bookingRepo := testhelpers.NewMockBookingRepo()
	classRepo   := testhelpers.NewMockClassRepo()
	memberRepo  := testhelpers.NewMockMemberRepo()
	planRepo    := testhelpers.NewMockPlanRepo()
	subRepo     := testhelpers.NewMockSubRepo()
	notifSvc    := &testhelpers.MockNotifService{}
	logger      := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	svc := services.NewBookingService(bookingRepo, classRepo, memberRepo, planRepo, subRepo, notifSvc, logger)

	// Seed basic plan (ID=1) with group class access.
	planID := uint(1)
	planRepo.Plans[1] = testhelpers.BasicPlan(1)

	// Seed active member (ID=1) with plan.
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, &planID)

	// Seed an open class (ID=1) with capacity 10.
	classRepo.Classes[1] = testhelpers.ScheduledClass(1, 10, 0)

	return svc, bookingRepo, classRepo, memberRepo, planRepo, notifSvc
}

// ─── Book — confirmed path ────────────────────────────────────────────────────

func TestBooking_Book_Confirmed(t *testing.T) {
	svc, bookingRepo, classRepo, _, _, notifSvc := newBookingSvc(t)

	booking, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)

	require.NoError(t, err)
	assert.Equal(t, models.BookingStatusConfirmed, booking.Status)
	assert.Nil(t, booking.WaitlistPosition)

	// Class enrollment must be incremented.
	assert.Equal(t, 1, classRepo.Classes[1].CurrentEnrollment)

	// Booking stored.
	assert.Equal(t, 1, len(bookingRepo.Bookings))

	// Notification dispatched asynchronously — give goroutine time to run.
	time.Sleep(10 * time.Millisecond)
	require.Len(t, notifSvc.Dispatched, 1)
	assert.Equal(t, models.NotifBookingConfirmed, notifSvc.Dispatched[0].Type)
}

// ─── Book — waitlisted path ───────────────────────────────────────────────────

func TestBooking_Book_Waitlisted(t *testing.T) {
	svc, bookingRepo, classRepo, memberRepo, _, notifSvc := newBookingSvc(t)

	// Fill the class to capacity.
	classRepo.Classes[1].CurrentEnrollment = classRepo.Classes[1].MaxCapacity

	// Add a second member.
	planID := uint(1)
	memberRepo.Members[2] = testhelpers.ActiveMember(2, 20, &planID)

	booking, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 2}, 20)

	require.NoError(t, err)
	assert.Equal(t, models.BookingStatusWaitlisted, booking.Status)
	require.NotNil(t, booking.WaitlistPosition)
	assert.Equal(t, 1, *booking.WaitlistPosition)

	// Waitlist count must be incremented.
	assert.Equal(t, 1, classRepo.Classes[1].WaitlistCount)

	// Booking stored.
	assert.Equal(t, 1, len(bookingRepo.Bookings))

	time.Sleep(10 * time.Millisecond)
	require.Len(t, notifSvc.Dispatched, 1)
	assert.Equal(t, models.NotifBookingWaitlisted, notifSvc.Dispatched[0].Type)
}

// ─── Book — duplicate booking ─────────────────────────────────────────────────

func TestBooking_Book_DuplicateConfirmed(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	_, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)
	require.NoError(t, err)

	_, err = svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_004", appErr.Code)
}

// ─── Book — class already started ────────────────────────────────────────────

func TestBooking_Book_ClassAlreadyStarted(t *testing.T) {
	svc, _, classRepo, _, _, _ := newBookingSvc(t)

	classRepo.Classes[1].StartTime = time.Now().Add(-1 * time.Hour)

	_, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_002", appErr.Code)
}

// ─── Book — inactive member ───────────────────────────────────────────────────

func TestBooking_Book_InactiveMember(t *testing.T) {
	svc, _, _, memberRepo, _, _ := newBookingSvc(t)

	memberRepo.Members[1].MembershipStatus = models.MemberStatusPaused

	_, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_003", appErr.Code)
}

// ─── Book — class not found ───────────────────────────────────────────────────

func TestBooking_Book_ClassNotFound(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	_, err := svc.Book(services.BookClassRequest{ClassID: 999, MemberID: 1}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "CLS_001", appErr.Code)
}

// ─── CancelBooking — confirmed, promotes waitlist ────────────────────────────

func TestBooking_Cancel_ConfirmedPromotesWaitlist(t *testing.T) {
	svc, bookingRepo, classRepo, memberRepo, _, notifSvc := newBookingSvc(t)

	// Fill class to capacity.
	classRepo.Classes[1].MaxCapacity = 1
	classRepo.Classes[1].CurrentEnrollment = 1
	classRepo.Classes[1].WaitlistCount = 1

	// Seed confirmed booking for member 1.
	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID:       1,
		ClassID:  1,
		MemberID: 1,
		Status:   models.BookingStatusConfirmed,
	}

	// Seed waitlisted booking for member 2.
	planID := uint(1)
	memberRepo.Members[2] = testhelpers.ActiveMember(2, 20, &planID)
	pos := 1
	bookingRepo.Bookings[2] = &models.ClassBooking{
		ID:               2,
		ClassID:          1,
		MemberID:         2,
		Status:           models.BookingStatusWaitlisted,
		WaitlistPosition: &pos,
	}

	// Cancel member 1's booking.
	updated, err := svc.CancelBooking(1, services.CancelBookingRequest{Reason: "test"}, 10)
	require.NoError(t, err)
	assert.Equal(t, models.BookingStatusCancelled, updated.Status)

	// Enrollment decremented back to 1 (cancel -1, promote +1 = net 0).
	assert.Equal(t, 1, classRepo.Classes[1].CurrentEnrollment)

	// Waitlisted booking must be promoted to confirmed.
	assert.Equal(t, models.BookingStatusConfirmed, bookingRepo.Bookings[2].Status)
	assert.Nil(t, bookingRepo.Bookings[2].WaitlistPosition)

	// Promotion notification dispatched asynchronously.
	time.Sleep(10 * time.Millisecond)
	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifBookingPromoted {
			found = true
		}
	}
	assert.True(t, found, "expected BookingPromoted notification")
}

func TestBooking_Cancel_WaitlistedShiftsPositions(t *testing.T) {
	svc, bookingRepo, classRepo, memberRepo, _, _ := newBookingSvc(t)

	classRepo.Classes[1].WaitlistCount = 2

	planID := uint(1)
	memberRepo.Members[2] = testhelpers.ActiveMember(2, 20, &planID)
	memberRepo.Members[3] = testhelpers.ActiveMember(3, 30, &planID)

	pos1, pos2 := 1, 2
	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID: 1, ClassID: 1, MemberID: 2,
		Status: models.BookingStatusWaitlisted, WaitlistPosition: &pos1,
	}
	bookingRepo.Bookings[2] = &models.ClassBooking{
		ID: 2, ClassID: 1, MemberID: 3,
		Status: models.BookingStatusWaitlisted, WaitlistPosition: &pos2,
	}

	// Cancel the first waitlisted booking (position 1).
	_, err := svc.CancelBooking(1, services.CancelBookingRequest{}, 10)
	require.NoError(t, err)

	// Member 3's position should shift from 2 → 1.
	assert.Equal(t, 1, *bookingRepo.Bookings[2].WaitlistPosition)
	assert.Equal(t, 1, classRepo.Classes[1].WaitlistCount)
}

func TestBooking_Cancel_AlreadyCancelled(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusCancelled,
	}

	_, err := svc.CancelBooking(1, services.CancelBookingRequest{}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_007", appErr.Code)
}

// ─── MarkAttended / MarkNoShow ────────────────────────────────────────────────

func TestBooking_MarkAttended_Success(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed,
	}

	b, err := svc.MarkAttended(1, 99)
	require.NoError(t, err)
	assert.Equal(t, models.BookingStatusAttended, b.Status)
}

func TestBooking_MarkAttended_NotConfirmed(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusWaitlisted,
	}

	_, err := svc.MarkAttended(1, 99)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_008", appErr.Code)
}

func TestBooking_MarkNoShow_Success(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{
		ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed,
	}

	b, err := svc.MarkNoShow(1, 99)
	require.NoError(t, err)
	assert.Equal(t, models.BookingStatusNoShow, b.Status)
}

// ─── Validation ───────────────────────────────────────────────────────────────

func TestBooking_Book_MissingClassID(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	_, err := svc.Book(services.BookClassRequest{MemberID: 1}, 10)
	require.Error(t, err)
}

func TestBooking_Book_MissingMemberID(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	_, err := svc.Book(services.BookClassRequest{ClassID: 1}, 10)
	require.Error(t, err)
}

// ─── Book — facility guard ────────────────────────────────────────────────────

func TestBooking_Book_WrongFacility(t *testing.T) {
	svc, _, classRepo, _, _, _ := newBookingSvc(t)

	// Move the class to a different facility than the member's (FacilityID=1).
	classRepo.Classes[1].FacilityID = 2

	_, err := svc.Book(services.BookClassRequest{ClassID: 1, MemberID: 1}, 10)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "BKG_012", appErr.Code)
	assert.Equal(t, http.StatusForbidden, appErr.HTTPStatus)
}

// ─── List ─────────────────────────────────────────────────────────────────────

func TestBooking_List_NoFilters(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[2] = &models.ClassBooking{ID: 2, ClassID: 1, MemberID: 2, Status: models.BookingStatusWaitlisted}
	bookingRepo.Bookings[3] = &models.ClassBooking{ID: 3, ClassID: 2, MemberID: 3, Status: models.BookingStatusCancelled}

	req := utils.PageRequest{Page: 1, PerPage: 20}
	results, _, err := svc.List(req, nil, nil, "")

	require.NoError(t, err)
	assert.Len(t, results, 3)
}

func TestBooking_List_FilterByClassID(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[2] = &models.ClassBooking{ID: 2, ClassID: 1, MemberID: 2, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[3] = &models.ClassBooking{ID: 3, ClassID: 2, MemberID: 3, Status: models.BookingStatusConfirmed}

	classID := uint(1)
	req := utils.PageRequest{Page: 1, PerPage: 20}
	results, _, err := svc.List(req, &classID, nil, "")

	require.NoError(t, err)
	assert.Len(t, results, 2)
	for _, b := range results {
		assert.Equal(t, uint(1), b.ClassID)
	}
}

func TestBooking_List_FilterByStatus(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	bookingRepo.Bookings[1] = &models.ClassBooking{ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[2] = &models.ClassBooking{ID: 2, ClassID: 1, MemberID: 2, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[3] = &models.ClassBooking{ID: 3, ClassID: 1, MemberID: 3, Status: models.BookingStatusCancelled}

	req := utils.PageRequest{Page: 1, PerPage: 20}
	results, _, err := svc.List(req, nil, nil, models.BookingStatusConfirmed)

	require.NoError(t, err)
	assert.Len(t, results, 2)
	for _, b := range results {
		assert.Equal(t, models.BookingStatusConfirmed, b.Status)
	}
}

func TestBooking_List_InvalidStatus(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	req := utils.PageRequest{Page: 1, PerPage: 20}
	_, _, err := svc.List(req, nil, nil, "nonsense")

	require.Error(t, err)
}

// ─── ListUpcomingByMember ─────────────────────────────────────────────────────

func TestBooking_ListUpcomingByMember_MemberNotFound(t *testing.T) {
	svc, _, _, _, _, _ := newBookingSvc(t)

	req := utils.PageRequest{Page: 1, PerPage: 20}
	_, _, err := svc.ListUpcomingByMember(999, req)

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_001", appErr.Code)
}

func TestBooking_ListUpcomingByMember_OnlyConfirmedAndWaitlisted(t *testing.T) {
	svc, bookingRepo, _, _, _, _ := newBookingSvc(t)

	// memberRepo.Members[1] is already seeded by newBookingSvc.
	bookingRepo.Bookings[1] = &models.ClassBooking{ID: 1, ClassID: 1, MemberID: 1, Status: models.BookingStatusConfirmed}
	bookingRepo.Bookings[2] = &models.ClassBooking{ID: 2, ClassID: 1, MemberID: 1, Status: models.BookingStatusWaitlisted}
	bookingRepo.Bookings[3] = &models.ClassBooking{ID: 3, ClassID: 1, MemberID: 1, Status: models.BookingStatusCancelled}

	req := utils.PageRequest{Page: 1, PerPage: 20}
	results, _, err := svc.ListUpcomingByMember(1, req)

	require.NoError(t, err)
	assert.Len(t, results, 2)
}
