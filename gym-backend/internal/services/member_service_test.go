package services_test

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/apperrors"
	"gym-backend/internal/models"
	"gym-backend/internal/services"
	"gym-backend/internal/testhelpers"
)

// newMemberSvc builds a MemberService wired to fresh mocks.
func newMemberSvc(t *testing.T) (
	services.MemberService,
	*testhelpers.MockMemberRepo,
	*testhelpers.MockUserRepo,
	*testhelpers.MockAuthService,
	*testhelpers.MockNotifService,
) {
	t.Helper()
	memberRepo := testhelpers.NewMockMemberRepo()
	userRepo   := testhelpers.NewMockUserRepo()
	auditRepo  := &testhelpers.MockAuditRepo{}
	authSvc    := testhelpers.NewMockAuthService()
	notifSvc   := &testhelpers.MockNotifService{}
	logger     := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	svc := services.NewMemberService(memberRepo, userRepo, auditRepo, authSvc, notifSvc, logger)
	return svc, memberRepo, userRepo, authSvc, notifSvc
}

// ─── Create ───────────────────────────────────────────────────────────────────

func TestMember_Create_Success(t *testing.T) {
	svc, memberRepo, userRepo, _, notifSvc := newMemberSvc(t)

	// MockAuthService starts NextUserID=100; pre-seed so FindByEmail succeeds
	// (member service calls FindByEmail after Signup to get the user for notifications).
	userRepo.Users[100] = &models.User{ID: 100, Email: "alice@gym.com", FirstName: "Alice"}
	userRepo.EmailIdx["alice@gym.com"] = userRepo.Users[100]

	resp, err := svc.Create(services.CreateMemberRequest{
		FirstName:  "Alice",
		LastName:   "Smith",
		Email:      "alice@gym.com",
		FacilityID: 1,
	}, 99, "127.0.0.1")

	require.NoError(t, err)
	assert.Equal(t, "alice@gym.com", resp.User.Email)
	assert.Equal(t, "member", resp.User.Role)
	assert.Equal(t, uint(1), resp.FacilityID)

	// Member persisted in repo.
	assert.Len(t, memberRepo.Members, 1)

	// Welcome notification dispatched via goroutine.
	time.Sleep(10 * time.Millisecond)
	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifWelcome {
			found = true
		}
	}
	assert.True(t, found, "expected Welcome notification")
}

func TestMember_Create_MissingFirstName(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	_, err := svc.Create(services.CreateMemberRequest{
		LastName:   "Smith",
		Email:      "a@gym.com",
		FacilityID: 1,
	}, 99, "")

	require.Error(t, err)
}

func TestMember_Create_MissingFacilityID(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	_, err := svc.Create(services.CreateMemberRequest{
		FirstName: "Alice",
		LastName:  "Smith",
		Email:     "a@gym.com",
	}, 99, "")

	require.Error(t, err)
}

func TestMember_Create_SignupError(t *testing.T) {
	svc, _, _, authSvc, _ := newMemberSvc(t)

	// Simulate auth service failing (e.g. duplicate email).
	authSvc.SignupErr = apperrors.New(409, "MBR_002", "Email already exists", "")

	_, err := svc.Create(services.CreateMemberRequest{
		FirstName:  "Bob",
		LastName:   "Jones",
		Email:      "dup@gym.com",
		FacilityID: 1,
	}, 99, "")

	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_002", appErr.Code)
}

// ─── GetByID ─────────────────────────────────────────────────────────────────

func TestMember_GetByID_Found(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	m, err := svc.GetByID(1, 99, "admin")
	require.NoError(t, err)
	assert.Equal(t, uint(1), m.ID)
}

func TestMember_GetByID_NotFound(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	_, err := svc.GetByID(999, 99, "admin")
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_001", appErr.Code)
}

func TestMember_GetByID_MemberCannotViewOtherProfile(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	// Member 1 belongs to user 10.
	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	// Requester is user 20 (a different member).
	_, err := svc.GetByID(1, 20, "member")
	require.Error(t, err)
}

func TestMember_GetByID_MemberCanViewOwnProfile(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	m, err := svc.GetByID(1, 10, "member") // requesterID matches member's UserID
	require.NoError(t, err)
	assert.Equal(t, uint(1), m.ID)
}

// ─── Update ───────────────────────────────────────────────────────────────────

func TestMember_Update_Success(t *testing.T) {
	svc, memberRepo, userRepo, _, _ := newMemberSvc(t)

	// Seed member and the underlying user.
	member := testhelpers.ActiveMember(1, 10, nil)
	memberRepo.Members[1] = member
	memberRepo.UserIDIdx[10] = member
	userRepo.Users[10] = &models.User{
		ID:        10,
		FirstName: "Old",
		LastName:  "Name",
		Email:     "old@gym.com",
	}
	userRepo.EmailIdx["old@gym.com"] = userRepo.Users[10]

	updated, err := svc.Update(1, services.UpdateMemberRequest{
		FirstName: "New",
		LastName:  "Name",
	}, 99, "")

	require.NoError(t, err)
	assert.Equal(t, "New", userRepo.Users[10].FirstName)
	_ = updated
}

func TestMember_Update_NotFound(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	_, err := svc.Update(999, services.UpdateMemberRequest{FirstName: "X"}, 99, "")
	require.Error(t, err)
}

// ─── SoftDelete ───────────────────────────────────────────────────────────────

func TestMember_SoftDelete_Success(t *testing.T) {
	svc, memberRepo, userRepo, _, _ := newMemberSvc(t)

	member := testhelpers.ActiveMember(1, 10, nil)
	memberRepo.Members[1] = member
	userRepo.Users[10] = &models.User{ID: 10, Email: "del@gym.com"}
	userRepo.EmailIdx["del@gym.com"] = userRepo.Users[10]

	err := svc.SoftDelete(1, "leaving", 99, "")
	require.NoError(t, err)
	assert.Equal(t, models.MemberStatusCancelled, memberRepo.Members[1].MembershipStatus)
}

func TestMember_SoftDelete_NotFound(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	err := svc.SoftDelete(999, "leaving", 99, "")
	require.Error(t, err)
}

// ─── Freeze / Unfreeze ────────────────────────────────────────────────────────

func TestMember_Freeze_Success(t *testing.T) {
	svc, memberRepo, _, _, notifSvc := newMemberSvc(t)

	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	err := svc.Freeze(1, 2, "holiday", 99)
	require.NoError(t, err)
	assert.Equal(t, models.MemberStatusPaused, memberRepo.Members[1].MembershipStatus)

	time.Sleep(10 * time.Millisecond)
	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifMemberFrozen {
			found = true
		}
	}
	assert.True(t, found, "expected MemberFrozen notification")
}

func TestMember_Freeze_InvalidDuration(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil)

	err := svc.Freeze(1, 0, "too short", 99)
	require.Error(t, err)

	err = svc.Freeze(1, 13, "too long", 99)
	require.Error(t, err)
}

func TestMember_Freeze_NotActive(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	m := testhelpers.ActiveMember(1, 10, nil)
	m.MembershipStatus = models.MemberStatusPaused
	memberRepo.Members[1] = m

	err := svc.Freeze(1, 1, "already paused", 99)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_010", appErr.Code)
}

func TestMember_Freeze_NotFound(t *testing.T) {
	svc, _, _, _, _ := newMemberSvc(t)

	err := svc.Freeze(999, 1, "ghost", 99)
	require.Error(t, err)
}

func TestMember_Unfreeze_Success(t *testing.T) {
	svc, memberRepo, _, _, notifSvc := newMemberSvc(t)

	m := testhelpers.ActiveMember(1, 10, nil)
	m.MembershipStatus = models.MemberStatusPaused
	memberRepo.Members[1] = m

	err := svc.Unfreeze(1, 99)
	require.NoError(t, err)
	assert.Equal(t, models.MemberStatusActive, memberRepo.Members[1].MembershipStatus)

	time.Sleep(10 * time.Millisecond)
	found := false
	for _, d := range notifSvc.Dispatched {
		if d.Type == models.NotifMemberUnfrozen {
			found = true
		}
	}
	assert.True(t, found, "expected MemberUnfrozen notification")
}

func TestMember_Unfreeze_NotPaused(t *testing.T) {
	svc, memberRepo, _, _, _ := newMemberSvc(t)

	memberRepo.Members[1] = testhelpers.ActiveMember(1, 10, nil) // active, not paused

	err := svc.Unfreeze(1, 99)
	require.Error(t, err)
	var appErr *apperrors.AppError
	require.ErrorAs(t, err, &appErr)
	assert.Equal(t, "MBR_011", appErr.Code)
}
