// Package testhelpers provides hand-rolled mock implementations of every
// repository and service interface. All mocks are safe for single-goroutine
// use in unit tests.
package testhelpers

import (
	"time"

	"gym-backend/internal/models"
	"gym-backend/internal/repositories"
	"gym-backend/internal/services"
	"gym-backend/internal/utils"
)


// ─── UserRepository ───────────────────────────────────────────────────────────

type MockUserRepo struct {
	Users     map[uint]*models.User
	EmailIdx  map[string]*models.User
	NextID    uint
	CreateErr error
	UpdateErr error
}

func NewMockUserRepo() *MockUserRepo {
	return &MockUserRepo{
		Users:    make(map[uint]*models.User),
		EmailIdx: make(map[string]*models.User),
		NextID:   1,
	}
}

func (m *MockUserRepo) Create(u *models.User) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	u.ID = m.NextID
	m.NextID++
	u.CreatedAt = time.Now()
	u.UpdatedAt = time.Now()
	m.Users[u.ID] = u
	m.EmailIdx[u.Email] = u
	return nil
}

func (m *MockUserRepo) FindByID(id uint) (*models.User, error) {
	if u, ok := m.Users[id]; ok {
		return u, nil
	}
	return nil, nil
}

func (m *MockUserRepo) FindByEmail(email string) (*models.User, error) {
	if u, ok := m.EmailIdx[email]; ok {
		return u, nil
	}
	return nil, nil
}

func (m *MockUserRepo) Update(u *models.User) error {
	if m.UpdateErr != nil {
		return m.UpdateErr
	}
	u.UpdatedAt = time.Now()
	m.Users[u.ID] = u
	m.EmailIdx[u.Email] = u
	return nil
}

func (m *MockUserRepo) IncrementFailedLogins(userID uint) error {
	if u, ok := m.Users[userID]; ok {
		u.FailedLoginAttempts++
	}
	return nil
}

func (m *MockUserRepo) ResetFailedLogins(userID uint) error {
	if u, ok := m.Users[userID]; ok {
		u.FailedLoginAttempts = 0
	}
	return nil
}

func (m *MockUserRepo) LockAccount(userID uint, until time.Time) error {
	if u, ok := m.Users[userID]; ok {
		u.LockedUntil = &until
	}
	return nil
}

func (m *MockUserRepo) MarkEmailVerified(userID uint) error {
	if u, ok := m.Users[userID]; ok {
		u.EmailVerified = true
	}
	return nil
}

func (m *MockUserRepo) UpdatePassword(userID uint, hash string, history models.StringSlice) error {
	if u, ok := m.Users[userID]; ok {
		u.PasswordHash = hash
		u.PasswordHistory = history
	}
	return nil
}

func (m *MockUserRepo) SoftDelete(userID uint, reason string) error {
	if u, ok := m.Users[userID]; ok {
		now := time.Now()
		u.DeletedAt = &now
	}
	return nil
}

// ─── RefreshTokenRepository ───────────────────────────────────────────────────

type MockTokenRepo struct {
	Tokens      map[string]*models.RefreshToken
	ActiveCount int64
	NextID      uint
}

func NewMockTokenRepo() *MockTokenRepo {
	return &MockTokenRepo{
		Tokens: make(map[string]*models.RefreshToken),
		NextID: 1,
	}
}

func (m *MockTokenRepo) Create(t *models.RefreshToken) error {
	t.ID = m.NextID
	m.NextID++
	m.Tokens[t.TokenHash] = t
	m.ActiveCount++
	return nil
}

func (m *MockTokenRepo) FindByHash(hash string) (*models.RefreshToken, error) {
	if t, ok := m.Tokens[hash]; ok {
		return t, nil
	}
	return nil, nil
}

func (m *MockTokenRepo) Revoke(id uint) error {
	for _, t := range m.Tokens {
		if t.ID == id {
			now := time.Now()
			t.RevokedAt = &now
			m.ActiveCount--
		}
	}
	return nil
}

func (m *MockTokenRepo) RevokeAllForUser(userID uint) error {
	now := time.Now()
	for _, t := range m.Tokens {
		if t.UserID == userID {
			t.RevokedAt = &now
		}
	}
	m.ActiveCount = 0
	return nil
}

func (m *MockTokenRepo) DeleteExpired() error { return nil }

func (m *MockTokenRepo) CountActiveForUser(userID uint) (int64, error) {
	return m.ActiveCount, nil
}

// ─── OTPRepository ────────────────────────────────────────────────────────────

type MockOTPRepo struct {
	OTPs           map[uint]*models.OTPCode // keyed by ID
	RecentCount    int64
	ReturnOTP      *models.OTPCode
	NextID         uint
}

func NewMockOTPRepo() *MockOTPRepo {
	return &MockOTPRepo{
		OTPs:   make(map[uint]*models.OTPCode),
		NextID: 1,
	}
}

func (m *MockOTPRepo) Create(o *models.OTPCode) error {
	o.ID = m.NextID
	m.NextID++
	m.OTPs[o.ID] = o
	return nil
}

func (m *MockOTPRepo) FindLatestByUserAndPurpose(userID uint, purpose string) (*models.OTPCode, error) {
	return m.ReturnOTP, nil
}

func (m *MockOTPRepo) MarkUsed(id uint) error {
	if o, ok := m.OTPs[id]; ok {
		now := time.Now()
		o.UsedAt = &now
	}
	return nil
}

func (m *MockOTPRepo) IncrementAttempts(id uint) error {
	if o, ok := m.OTPs[id]; ok {
		o.Attempts++
	}
	return nil
}

func (m *MockOTPRepo) CountRecentByUserAndPurpose(userID uint, purpose string, since time.Time) (int64, error) {
	return m.RecentCount, nil
}

// ─── AuditLogRepository ───────────────────────────────────────────────────────

type MockAuditRepo struct {
	Logs []*models.AuditLog
}

func (m *MockAuditRepo) Create(log *models.AuditLog) error {
	m.Logs = append(m.Logs, log)
	return nil
}

func (m *MockAuditRepo) List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error) {
	return m.Logs, int64(len(m.Logs)), nil
}

// ─── MemberRepository ─────────────────────────────────────────────────────────

type MockMemberRepo struct {
	Members   map[uint]*models.Member
	UserIDIdx map[uint]*models.Member
	NextID    uint
}

func NewMockMemberRepo() *MockMemberRepo {
	return &MockMemberRepo{
		Members:   make(map[uint]*models.Member),
		UserIDIdx: make(map[uint]*models.Member),
		NextID:    1,
	}
}

func (m *MockMemberRepo) Create(member *models.Member) error {
	member.ID = m.NextID
	m.NextID++
	m.Members[member.ID] = member
	m.UserIDIdx[member.UserID] = member
	return nil
}

func (m *MockMemberRepo) FindByID(id uint) (*models.Member, error) {
	if mem, ok := m.Members[id]; ok {
		return mem, nil
	}
	return nil, nil
}

func (m *MockMemberRepo) FindByUserID(userID uint) (*models.Member, error) {
	if mem, ok := m.UserIDIdx[userID]; ok {
		return mem, nil
	}
	return nil, nil
}

func (m *MockMemberRepo) Update(member *models.Member) error {
	m.Members[member.ID] = member
	return nil
}

func (m *MockMemberRepo) List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error) {
	var out []*models.Member
	for _, mem := range m.Members {
		out = append(out, mem)
	}
	return out, int64(len(out)), nil
}

func (m *MockMemberRepo) UpdateStatus(memberID uint, status string) error {
	if mem, ok := m.Members[memberID]; ok {
		mem.MembershipStatus = status
	}
	return nil
}

func (m *MockMemberRepo) UpdateCurrentSubscription(memberID uint, planID, subID *uint) error {
	if mem, ok := m.Members[memberID]; ok {
		mem.CurrentPlanID = planID
		mem.CurrentSubscriptionID = subID
	}
	return nil
}

func (m *MockMemberRepo) NextMemberCode(facilityID uint) (string, error) {
	return "GYM-TEST-000001", nil
}

func (m *MockMemberRepo) FindMembersWithBirthdayToday() ([]*models.Member, error) {
	return nil, nil
}

func (m *MockMemberRepo) FindAllActive() ([]*models.Member, error) {
	var out []*models.Member
	for _, mem := range m.Members {
		out = append(out, mem)
	}
	return out, nil
}

func (m *MockMemberRepo) AssignTrainer(memberID uint, trainerID *uint) error {
	return nil
}

// ─── PlanRepository ───────────────────────────────────────────────────────────

type MockPlanRepo struct {
	Plans  map[uint]*models.Plan
	NextID uint
}

func NewMockPlanRepo() *MockPlanRepo {
	return &MockPlanRepo{Plans: make(map[uint]*models.Plan), NextID: 1}
}

func (m *MockPlanRepo) Create(plan *models.Plan) error {
	plan.ID = m.NextID
	m.NextID++
	m.Plans[plan.ID] = plan
	return nil
}

func (m *MockPlanRepo) FindByID(id uint) (*models.Plan, error) {
	if p, ok := m.Plans[id]; ok {
		return p, nil
	}
	return nil, nil
}

func (m *MockPlanRepo) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.Plan, int64, error) {
	var out []*models.Plan
	for _, p := range m.Plans {
		out = append(out, p)
	}
	return out, int64(len(out)), nil
}

func (m *MockPlanRepo) Update(plan *models.Plan) error {
	m.Plans[plan.ID] = plan
	return nil
}

func (m *MockPlanRepo) Deactivate(id uint) error {
	if p, ok := m.Plans[id]; ok {
		p.IsActive = false
	}
	return nil
}

// ─── SubscriptionRepository ───────────────────────────────────────────────────

type MockSubRepo struct {
	Subs              map[uint]*models.Subscription
	ActiveByMember    map[uint]*models.Subscription
	NextID            uint
	CreateErr         error
	FindExpiringErr   error  // if set, FindExpiringBefore returns this error
}

func NewMockSubRepo() *MockSubRepo {
	return &MockSubRepo{
		Subs:           make(map[uint]*models.Subscription),
		ActiveByMember: make(map[uint]*models.Subscription),
		NextID:         1,
	}
}

func (m *MockSubRepo) Create(sub *models.Subscription) error {
	if m.CreateErr != nil {
		return m.CreateErr
	}
	sub.ID = m.NextID
	m.NextID++
	sub.CreatedAt = time.Now()
	sub.UpdatedAt = time.Now()
	m.Subs[sub.ID] = sub
	if sub.Status == models.SubStatusActive {
		m.ActiveByMember[sub.MemberID] = sub
	}
	return nil
}

func (m *MockSubRepo) FindByID(id uint) (*models.Subscription, error) {
	if s, ok := m.Subs[id]; ok {
		return s, nil
	}
	return nil, nil
}

func (m *MockSubRepo) FindActiveByMember(memberID uint) (*models.Subscription, error) {
	if s, ok := m.ActiveByMember[memberID]; ok {
		return s, nil
	}
	return nil, nil
}

func (m *MockSubRepo) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error) {
	var out []*models.Subscription
	for _, s := range m.Subs {
		if s.MemberID == memberID {
			out = append(out, s)
		}
	}
	return out, int64(len(out)), nil
}

func (m *MockSubRepo) List(req utils.PageRequest) ([]*models.Subscription, int64, error) {
	var out []*models.Subscription
	for _, s := range m.Subs {
		out = append(out, s)
	}
	return out, int64(len(out)), nil
}

func (m *MockSubRepo) Update(sub *models.Subscription) error {
	sub.UpdatedAt = time.Now()
	m.Subs[sub.ID] = sub
	if sub.Status == models.SubStatusActive {
		m.ActiveByMember[sub.MemberID] = sub
	}
	return nil
}

func (m *MockSubRepo) FindExpiringBefore(date time.Time) ([]*models.Subscription, error) {
	if m.FindExpiringErr != nil {
		return nil, m.FindExpiringErr
	}
	var out []*models.Subscription
	for _, s := range m.Subs {
		if (s.Status == models.SubStatusActive) && s.EndDate.Before(date) {
			out = append(out, s)
		}
	}
	return out, nil
}

func (m *MockSubRepo) FindExpiredActive(now time.Time) ([]*models.Subscription, error) {
	if m.FindExpiringErr != nil {
		return nil, m.FindExpiringErr
	}
	var out []*models.Subscription
	for _, s := range m.Subs {
		if s.Status == models.SubStatusActive && s.EndDate.Before(now) && !s.AutoRenew {
			out = append(out, s)
		}
	}
	return out, nil
}

func (m *MockSubRepo) FindAutoRenewDueSoon(from, to time.Time) ([]*models.Subscription, error) {
	return nil, nil
}

func (m *MockSubRepo) FindPausedDue(now time.Time) ([]*models.Subscription, error) {
	return nil, nil
}

// ─── PaymentRepository ────────────────────────────────────────────────────────

type MockPaymentRepo struct {
	Payments map[uint]*models.Payment
	NextID   uint
}

func NewMockPaymentRepo() *MockPaymentRepo {
	return &MockPaymentRepo{Payments: make(map[uint]*models.Payment), NextID: 1}
}

func (m *MockPaymentRepo) Create(p *models.Payment) error {
	p.ID = m.NextID
	m.NextID++
	p.CreatedAt = time.Now()
	m.Payments[p.ID] = p
	return nil
}

func (m *MockPaymentRepo) FindByID(id uint) (*models.Payment, error) {
	if p, ok := m.Payments[id]; ok {
		return p, nil
	}
	return nil, nil
}

func (m *MockPaymentRepo) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error) {
	var out []*models.Payment
	for _, p := range m.Payments {
		if p.MemberID == memberID {
			out = append(out, p)
		}
	}
	return out, int64(len(out)), nil
}

func (m *MockPaymentRepo) List(req utils.PageRequest) ([]*models.Payment, int64, error) {
	var out []*models.Payment
	for _, p := range m.Payments {
		out = append(out, p)
	}
	return out, int64(len(out)), nil
}

func (m *MockPaymentRepo) Update(p *models.Payment) error {
	m.Payments[p.ID] = p
	return nil
}

func (m *MockPaymentRepo) SumBySubscription(subscriptionID uint) (float64, error) {
	var total float64
	for _, p := range m.Payments {
		if p.SubscriptionID != nil && *p.SubscriptionID == subscriptionID {
			total += p.Amount
		}
	}
	return total, nil
}

// ─── PromoCodeRepository ──────────────────────────────────────────────────────

type MockPromoRepo struct {
	Codes  map[uint]*models.PromoCode
	ByCode map[string]*models.PromoCode
	NextID uint
}

func NewMockPromoRepo() *MockPromoRepo {
	return &MockPromoRepo{
		Codes:  make(map[uint]*models.PromoCode),
		ByCode: make(map[string]*models.PromoCode),
		NextID: 1,
	}
}

func (m *MockPromoRepo) Create(code *models.PromoCode) error {
	code.ID = m.NextID
	m.NextID++
	m.Codes[code.ID] = code
	m.ByCode[code.Code] = code
	return nil
}

func (m *MockPromoRepo) FindByCode(code string) (*models.PromoCode, error) {
	if p, ok := m.ByCode[code]; ok {
		return p, nil
	}
	return nil, nil
}

func (m *MockPromoRepo) FindByID(id uint) (*models.PromoCode, error) {
	if p, ok := m.Codes[id]; ok {
		return p, nil
	}
	return nil, nil
}

func (m *MockPromoRepo) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error) {
	var out []*models.PromoCode
	for _, p := range m.Codes {
		out = append(out, p)
	}
	return out, int64(len(out)), nil
}

func (m *MockPromoRepo) Update(code *models.PromoCode) error {
	m.Codes[code.ID] = code
	return nil
}

func (m *MockPromoRepo) Deactivate(id uint) error {
	if p, ok := m.Codes[id]; ok {
		p.IsActive = false
	}
	return nil
}

func (m *MockPromoRepo) RecordUsage(usage *models.PromoCodeUsage) error { return nil }

func (m *MockPromoRepo) CountUsageByMember(promoID, memberID uint) (int64, error) {
	return 0, nil
}

func (m *MockPromoRepo) IncrementUses(id uint) error {
	if p, ok := m.Codes[id]; ok {
		p.CurrentUses++
	}
	return nil
}

// ─── BookingRepository ────────────────────────────────────────────────────────

type MockBookingRepo struct {
	Bookings          map[uint]*models.ClassBooking
	NextID            uint
	FirstWaitlistedFn func(classID uint) (*models.ClassBooking, error)
}

func NewMockBookingRepo() *MockBookingRepo {
	return &MockBookingRepo{
		Bookings: make(map[uint]*models.ClassBooking),
		NextID:   1,
	}
}

func (m *MockBookingRepo) Create(b *models.ClassBooking) error {
	b.ID = m.NextID
	m.NextID++
	b.CreatedAt = time.Now()
	m.Bookings[b.ID] = b
	return nil
}

func (m *MockBookingRepo) FindByID(id uint) (*models.ClassBooking, error) {
	if b, ok := m.Bookings[id]; ok {
		return b, nil
	}
	return nil, nil
}

func (m *MockBookingRepo) FindByMemberAndClass(memberID, classID uint) (*models.ClassBooking, error) {
	for _, b := range m.Bookings {
		if b.MemberID == memberID && b.ClassID == classID {
			return b, nil
		}
	}
	return nil, nil
}

func (m *MockBookingRepo) ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	var out []*models.ClassBooking
	for _, b := range m.Bookings {
		if b.MemberID == memberID {
			out = append(out, b)
		}
	}
	return out, int64(len(out)), nil
}

func (m *MockBookingRepo) ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	var out []*models.ClassBooking
	for _, b := range m.Bookings {
		if b.ClassID == classID {
			out = append(out, b)
		}
	}
	return out, int64(len(out)), nil
}

func (m *MockBookingRepo) Update(b *models.ClassBooking) error {
	m.Bookings[b.ID] = b
	return nil
}

func (m *MockBookingRepo) CountConfirmedByClass(classID uint) (int64, error) {
	var count int64
	for _, b := range m.Bookings {
		if b.ClassID == classID && b.Status == models.BookingStatusConfirmed {
			count++
		}
	}
	return count, nil
}

func (m *MockBookingRepo) FirstWaitlisted(classID uint) (*models.ClassBooking, error) {
	if m.FirstWaitlistedFn != nil {
		return m.FirstWaitlistedFn(classID)
	}
	var first *models.ClassBooking
	for _, b := range m.Bookings {
		if b.ClassID == classID && b.Status == models.BookingStatusWaitlisted {
			if b.WaitlistPosition != nil {
				if first == nil || *b.WaitlistPosition < *first.WaitlistPosition {
					first = b
				}
			}
		}
	}
	return first, nil
}

func (m *MockBookingRepo) ShiftWaitlistDown(classID uint, afterPosition int) error {
	for _, b := range m.Bookings {
		if b.ClassID == classID && b.Status == models.BookingStatusWaitlisted &&
			b.WaitlistPosition != nil && *b.WaitlistPosition > afterPosition {
			pos := *b.WaitlistPosition - 1
			b.WaitlistPosition = &pos
		}
	}
	return nil
}

func (m *MockBookingRepo) List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error) {
	var out []*models.ClassBooking
	for _, b := range m.Bookings {
		if classID != nil && b.ClassID != *classID {
			continue
		}
		if memberID != nil && b.MemberID != *memberID {
			continue
		}
		if status != "" && b.Status != status {
			continue
		}
		out = append(out, b)
	}
	return out, int64(len(out)), nil
}

func (m *MockBookingRepo) ListUpcomingByMember(memberID uint, from time.Time, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	var out []*models.ClassBooking
	for _, b := range m.Bookings {
		if b.MemberID != memberID {
			continue
		}
		if b.Status != models.BookingStatusConfirmed && b.Status != models.BookingStatusWaitlisted {
			continue
		}
		out = append(out, b)
	}
	return out, int64(len(out)), nil
}

// ─── ClassRepository ──────────────────────────────────────────────────────────

type MockClassRepo struct {
	Classes        map[uint]*models.Class
	NextID         uint
	CompletedCount int64  // tracks how many classes were completed by CompleteEndedClasses
	CompleteErr    error  // if set, CompleteEndedClasses returns this error
}

func NewMockClassRepo() *MockClassRepo {
	return &MockClassRepo{Classes: make(map[uint]*models.Class), NextID: 1}
}

func (m *MockClassRepo) Create(c *models.Class) error {
	c.ID = m.NextID
	m.NextID++
	m.Classes[c.ID] = c
	return nil
}

func (m *MockClassRepo) CompleteEndedClasses(before time.Time) (int64, error) {
	if m.CompleteErr != nil {
		return 0, m.CompleteErr
	}
	var count int64
	for _, c := range m.Classes {
		if (c.Status == models.ClassStatusScheduled || c.Status == models.ClassStatusOngoing) &&
			c.EndTime.Before(before) {
			c.Status = models.ClassStatusCompleted
			c.IsActive = false
			count++
		}
	}
	m.CompletedCount += count
	return count, nil
}

func (m *MockClassRepo) CreateBatch(classes []*models.Class) error {
	for _, c := range classes {
		c.ID = m.NextID
		m.NextID++
		m.Classes[c.ID] = c
	}
	return nil
}

func (m *MockClassRepo) FindByID(id uint) (*models.Class, error) {
	if c, ok := m.Classes[id]; ok {
		return c, nil
	}
	return nil, nil
}

func (m *MockClassRepo) List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string) ([]*models.Class, int64, error) {
	var out []*models.Class
	for _, c := range m.Classes {
		out = append(out, c)
	}
	return out, int64(len(out)), nil
}

func (m *MockClassRepo) ListUpcoming(facilityID uint, from time.Time, limit int) ([]*models.Class, error) {
	return nil, nil
}

func (m *MockClassRepo) ListStartingBetween(from, to time.Time) ([]*models.Class, error) {
	var out []*models.Class
	for _, c := range m.Classes {
		if !c.StartTime.Before(from) && !c.StartTime.After(to) &&
			c.Status == models.ClassStatusScheduled && c.IsActive {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *MockClassRepo) Update(c *models.Class) error {
	m.Classes[c.ID] = c
	return nil
}

func (m *MockClassRepo) IncrementEnrollment(id uint, delta int) error {
	if c, ok := m.Classes[id]; ok {
		c.CurrentEnrollment += delta
	}
	return nil
}

func (m *MockClassRepo) IncrementWaitlist(id uint, delta int) error {
	if c, ok := m.Classes[id]; ok {
		c.WaitlistCount += delta
	}
	return nil
}

// ─── NotificationService (no-op) ─────────────────────────────────────────────

type MockNotifService struct {
	Dispatched []services.DispatchEvent
}

func (m *MockNotifService) Dispatch(ev services.DispatchEvent) error {
	m.Dispatched = append(m.Dispatched, ev)
	return nil
}

func (m *MockNotifService) DispatchBulk(userIDs []uint, ev services.DispatchEvent) error {
	return nil
}

func (m *MockNotifService) List(userID uint, req utils.PageRequest) ([]*models.Notification, int64, error) {
	return nil, 0, nil
}

func (m *MockNotifService) UnreadCount(userID uint) (int64, error) { return 0, nil }

func (m *MockNotifService) MarkRead(notifID uint, userID uint) error { return nil }

func (m *MockNotifService) MarkAllRead(userID uint) error { return nil }

func (m *MockNotifService) GetPreferences(userID uint) (*models.NotificationPreference, error) {
	return &models.NotificationPreference{UserID: userID}, nil
}

func (m *MockNotifService) UpdatePreferences(userID uint, req services.UpdatePreferenceRequest) (*models.NotificationPreference, error) {
	return &models.NotificationPreference{UserID: userID}, nil
}

// ─── EmailService (no-op) ─────────────────────────────────────────────────────

type MockEmailService struct {
	Sent []string // subject lines
}

func (m *MockEmailService) SendEmailVerification(to, firstName, otp string) error {
	m.Sent = append(m.Sent, "email_verification")
	return nil
}

func (m *MockEmailService) SendPasswordReset(to, firstName, otp string) error {
	m.Sent = append(m.Sent, "password_reset")
	return nil
}

func (m *MockEmailService) SendPasswordChanged(to, firstName string) error {
	m.Sent = append(m.Sent, "password_changed")
	return nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ActiveMember creates a Member with User embedded, ready for booking tests.
func ActiveMember(id uint, userID uint, planID *uint) *models.Member {
	u := &models.User{
		ID:        userID,
		Email:     "member@test.com",
		FirstName: "Test",
		LastName:  "User",
		Role:      "member",
	}
	return &models.Member{
		ID:               id,
		UserID:           userID,
		FacilityID:       1,
		MembershipStatus: models.MemberStatusActive,
		CurrentPlanID:    planID,
		User:             *u,
	}
}

// ScheduledClass returns a Class open for booking in the future.
func ScheduledClass(id uint, maxCapacity, enrolled int) *models.Class {
	return &models.Class{
		ID:                id,
		FacilityID:        1,
		Name:              "Test Class",
		Status:            models.ClassStatusScheduled,
		MaxCapacity:       maxCapacity,
		CurrentEnrollment: enrolled,
		StartTime:         time.Now().Add(2 * time.Hour),
		IsFree:            false,
	}
}

// BasicPlan returns a plan with GroupClassAccess=true.
func BasicPlan(id uint) *models.Plan {
	return &models.Plan{
		ID:               id,
		Name:             "Basic",
		PriceAmount:      999,
		BillingPeriodDays: 30,
		IsActive:         true,
		GroupClassAccess: true,
	}
}

// ─── TrainerRepository ────────────────────────────────────────────────────────

type MockTrainerRepo struct {
	Trainers map[uint]*models.TrainerProfile
	NextID   uint
}

func NewMockTrainerRepo() *MockTrainerRepo {
	return &MockTrainerRepo{Trainers: make(map[uint]*models.TrainerProfile), NextID: 1}
}

func (m *MockTrainerRepo) Create(t *models.TrainerProfile) error {
	t.ID = m.NextID
	m.NextID++
	m.Trainers[t.ID] = t
	return nil
}

func (m *MockTrainerRepo) FindByID(id uint) (*models.TrainerProfile, error) {
	if t, ok := m.Trainers[id]; ok {
		return t, nil
	}
	return nil, nil
}

func (m *MockTrainerRepo) FindByUserID(userID uint) (*models.TrainerProfile, error) {
	for _, t := range m.Trainers {
		if t.UserID == userID {
			return t, nil
		}
	}
	return nil, nil
}

func (m *MockTrainerRepo) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error) {
	var out []*models.TrainerProfile
	for _, t := range m.Trainers {
		out = append(out, t)
	}
	return out, int64(len(out)), nil
}

func (m *MockTrainerRepo) Update(t *models.TrainerProfile) error {
	m.Trainers[t.ID] = t
	return nil
}

func (m *MockTrainerRepo) Deactivate(id uint) error {
	if t, ok := m.Trainers[id]; ok {
		t.IsActive = false
	}
	return nil
}

func (m *MockTrainerRepo) GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error) {
	return nil, nil
}
func (m *MockTrainerRepo) GetShift(id uint) (*models.TrainerSchedule, error) { return nil, nil }
func (m *MockTrainerRepo) CreateShift(s *models.TrainerSchedule) error        { return nil }
func (m *MockTrainerRepo) UpdateShift(s *models.TrainerSchedule) error        { return nil }
func (m *MockTrainerRepo) DeleteShift(id uint) error                          { return nil }

// ─── AuthService mock ─────────────────────────────────────────────────────────

type MockAuthService struct {
	NextUserID     uint
	SignupErr      error
	// ClaimsToReturn is returned by ValidateAccessToken when non-nil.
	ClaimsToReturn *services.Claims
}

func NewMockAuthService() *MockAuthService {
	return &MockAuthService{NextUserID: 100}
}

func (m *MockAuthService) Signup(req services.SignupRequest) (*services.UserInfo, error) {
	if m.SignupErr != nil {
		return nil, m.SignupErr
	}
	id := m.NextUserID
	m.NextUserID++
	return &services.UserInfo{
		ID:            id,
		Email:         req.Email,
		FirstName:     req.FirstName,
		LastName:      req.LastName,
		Role:          "member",
		EmailVerified: false,
	}, nil
}

func (m *MockAuthService) VerifyEmail(email, otp string) error             { return nil }
func (m *MockAuthService) ResendVerification(email string) error            { return nil }
func (m *MockAuthService) Login(req services.LoginRequest, ip, ua string) (*services.LoginResponse, error) {
	return nil, nil
}
func (m *MockAuthService) RefreshToken(raw string) (*services.TokenPair, error) { return nil, nil }
func (m *MockAuthService) Logout(raw string) error                               { return nil }
func (m *MockAuthService) ForgotPassword(email string) error                     { return nil }
func (m *MockAuthService) ResetPassword(email, otp, newPass string) error        { return nil }
func (m *MockAuthService) ChangePassword(userID uint, cur, newPass string) error { return nil }
func (m *MockAuthService) ValidateAccessToken(token string) (*services.Claims, error) {
	if m.ClaimsToReturn != nil {
		return m.ClaimsToReturn, nil
	}
	return nil, nil
}

// Verify interface compliance at compile time.
var (
	_ repositories.UserRepository         = (*MockUserRepo)(nil)
	_ repositories.RefreshTokenRepository = (*MockTokenRepo)(nil)
	_ repositories.OTPRepository          = (*MockOTPRepo)(nil)
	_ repositories.AuditLogRepository     = (*MockAuditRepo)(nil)
	_ repositories.MemberRepository       = (*MockMemberRepo)(nil)
	_ repositories.PlanRepository         = (*MockPlanRepo)(nil)
	_ repositories.SubscriptionRepository = (*MockSubRepo)(nil)
	_ repositories.PaymentRepository      = (*MockPaymentRepo)(nil)
	_ repositories.PromoCodeRepository    = (*MockPromoRepo)(nil)
	_ repositories.BookingRepository      = (*MockBookingRepo)(nil)
	_ repositories.ClassRepository        = (*MockClassRepo)(nil)
	_ repositories.TrainerRepository      = (*MockTrainerRepo)(nil)
	_ services.NotificationService        = (*MockNotifService)(nil)
	_ services.EmailService               = (*MockEmailService)(nil)
	_ services.AuthService                = (*MockAuthService)(nil)
	_ services.PlanService                = (*MockPlanService)(nil)
	_ services.ClassService               = (*MockClassService)(nil)
	_ services.BookingService             = (*MockBookingService)(nil)
	_ services.MemberService              = (*MockMemberService)(nil)
	_ services.SubscriptionService        = (*MockSubService)(nil)
	_ services.PaymentService             = (*MockPaymentService)(nil)
	_ services.TrainerService             = (*MockTrainerService)(nil)
	_ services.PromoService               = (*MockPromoService)(nil)
	_ services.FacilityService            = (*MockFacilityService)(nil)
	_ services.ReportService              = (*MockReportService)(nil)
	_ services.AuditService               = (*MockAuditService)(nil)
)

// ─── Service Mocks (for handler tests) ───────────────────────────────────────

// MockPlanService
type MockPlanService struct {
	Plans    []*models.Plan
	Plan     *models.Plan
	Total    int64
	Err      error
}

func (m *MockPlanService) Create(req services.CreatePlanRequest, actorID uint, ip string) (*models.Plan, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Plan, nil
}
func (m *MockPlanService) GetByID(id uint) (*models.Plan, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Plan, nil
}
func (m *MockPlanService) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.Plan, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Plans, m.Total, nil
}
func (m *MockPlanService) Update(id uint, req services.UpdatePlanRequest, actorID uint, ip string) (*models.Plan, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Plan, nil
}
func (m *MockPlanService) Deactivate(id uint, actorID uint, ip string) error { return m.Err }

// MockClassService
type MockClassService struct {
	Class   *models.Class
	Classes []*models.Class
	Total   int64
	Err     error
}

func (m *MockClassService) Create(req services.CreateClassRequest, actorID uint, ip string) (*models.Class, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Class, nil
}
func (m *MockClassService) GetByID(id uint) (*models.Class, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Class, nil
}
func (m *MockClassService) List(req utils.PageRequest, facilityID *uint, trainerID *uint, status string, date string) ([]*models.Class, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Classes, m.Total, nil
}
func (m *MockClassService) ListUpcoming(facilityID uint, limit int) ([]*models.Class, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Classes, nil
}
func (m *MockClassService) Update(id uint, req services.UpdateClassRequest, actorID uint, ip string) (*models.Class, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Class, nil
}
func (m *MockClassService) Cancel(id uint, actorID uint, ip string) error { return m.Err }

// MockBookingService
type MockBookingService struct {
	Booking  *models.ClassBooking
	Bookings []*models.ClassBooking
	Total    int64
	Err      error
}

func (m *MockBookingService) Book(req services.BookClassRequest, actorID uint) (*models.ClassBooking, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Booking, nil
}
func (m *MockBookingService) CancelBooking(id uint, req services.CancelBookingRequest, actorID uint) (*models.ClassBooking, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Booking, nil
}
func (m *MockBookingService) MarkAttended(id uint, actorID uint) (*models.ClassBooking, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Booking, nil
}
func (m *MockBookingService) MarkNoShow(id uint, actorID uint) (*models.ClassBooking, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Booking, nil
}
func (m *MockBookingService) GetByID(id uint) (*models.ClassBooking, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Booking, nil
}
func (m *MockBookingService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Bookings, m.Total, nil
}
func (m *MockBookingService) ListByClass(classID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Bookings, m.Total, nil
}
func (m *MockBookingService) List(req utils.PageRequest, classID *uint, memberID *uint, status string) ([]*models.ClassBooking, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Bookings, m.Total, nil
}
func (m *MockBookingService) ListUpcomingByMember(memberID uint, req utils.PageRequest) ([]*models.ClassBooking, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Bookings, m.Total, nil
}

// MockMemberService
type MockMemberService struct {
	MemberResp *services.MemberResponse
	Member     *models.Member
	Members    []*models.Member
	Total      int64
	Err        error
}

func (m *MockMemberService) Create(req services.CreateMemberRequest, actorID uint, ip string) (*services.MemberResponse, error) {
	if m.Err != nil { return nil, m.Err }
	return m.MemberResp, nil
}
func (m *MockMemberService) GetByID(id uint, viewerID uint, viewerRole string) (*models.Member, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Member, nil
}
func (m *MockMemberService) GetByUserID(userID uint) (*models.Member, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Member, nil
}
func (m *MockMemberService) List(req utils.PageRequest, facilityID *uint) ([]*models.Member, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Members, m.Total, nil
}
func (m *MockMemberService) Update(id uint, req services.UpdateMemberRequest, actorID uint, ip string) (*models.Member, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Member, nil
}
func (m *MockMemberService) SoftDelete(id uint, reason string, actorID uint, ip string) error  { return m.Err }
func (m *MockMemberService) Freeze(id uint, months int, reason string, actorID uint) error      { return m.Err }
func (m *MockMemberService) Unfreeze(id uint, actorID uint) error                               { return m.Err }
func (m *MockMemberService) AssignTrainer(memberID uint, trainerID *uint, trainerName string) error { return m.Err }

// MockSubService
type MockSubService struct {
	Sub   *models.Subscription
	Subs  []*models.Subscription
	Total int64
	Err   error
}

func (m *MockSubService) Create(req services.CreateSubscriptionRequest, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) GetByID(id uint) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) List(req utils.PageRequest) ([]*models.Subscription, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Subs, m.Total, nil
}
func (m *MockSubService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Subscription, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Subs, m.Total, nil
}
func (m *MockSubService) GetActiveByMember(memberID uint) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) Pause(id uint, req services.PauseSubscriptionRequest, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) Resume(id uint, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) Cancel(id uint, req services.CancelSubscriptionRequest, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) Upgrade(id uint, req services.UpgradeSubscriptionRequest, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) Extend(id uint, req services.ExtendSubscriptionRequest, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}
func (m *MockSubService) SetAutoRenew(id uint, enabled bool, actorID uint, ip string) (*models.Subscription, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Sub, nil
}

// MockPaymentService
type MockPaymentService struct {
	Payment  *models.Payment
	Payments []*models.Payment
	Total    int64
	Err      error
}

func (m *MockPaymentService) Record(req services.RecordPaymentRequest, actorID uint, ip string) (*models.Payment, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Payment, nil
}
func (m *MockPaymentService) GetByID(id uint) (*models.Payment, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Payment, nil
}
func (m *MockPaymentService) List(req utils.PageRequest) ([]*models.Payment, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Payments, m.Total, nil
}
func (m *MockPaymentService) ListByMember(memberID uint, req utils.PageRequest) ([]*models.Payment, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Payments, m.Total, nil
}
func (m *MockPaymentService) Refund(id uint, req services.RefundPaymentRequest, actorID uint, ip string) (*models.Payment, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Payment, nil
}

// MockTrainerService
type MockTrainerService struct {
	Trainer  *models.TrainerProfile
	Trainers []*models.TrainerProfile
	Classes  []*models.Class
	Total    int64
	Err      error
}

func (m *MockTrainerService) Create(req services.CreateTrainerRequest, actorID uint, ip string) (*models.TrainerProfile, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Trainer, nil
}
func (m *MockTrainerService) GetByID(id uint) (*models.TrainerProfile, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Trainer, nil
}
func (m *MockTrainerService) GetByUserID(userID uint) (*models.TrainerProfile, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Trainer, nil
}
func (m *MockTrainerService) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.TrainerProfile, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Trainers, m.Total, nil
}
func (m *MockTrainerService) Update(id uint, req services.UpdateTrainerRequest, actorID uint, ip string) (*models.TrainerProfile, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Trainer, nil
}
func (m *MockTrainerService) Deactivate(id uint, actorID uint, ip string) error { return m.Err }
func (m *MockTrainerService) ListClasses(trainerID uint, req utils.PageRequest, status string) ([]*models.Class, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Classes, m.Total, nil
}
func (m *MockTrainerService) GetSchedule(trainerID uint) ([]*models.TrainerSchedule, error) {
	return nil, m.Err
}
func (m *MockTrainerService) CreateShift(trainerID uint, req services.CreateShiftRequest, actorID uint, ip string) (*models.TrainerSchedule, error) {
	return nil, m.Err
}
func (m *MockTrainerService) UpdateShift(trainerID uint, shiftID uint, req services.UpdateShiftRequest, actorID uint, ip string) (*models.TrainerSchedule, error) {
	return nil, m.Err
}
func (m *MockTrainerService) DeleteShift(trainerID uint, shiftID uint, actorID uint, ip string) error {
	return m.Err
}

// MockPromoService
type MockPromoService struct {
	Promo  *models.PromoCode
	Promos []*models.PromoCode
	Total  int64
	Result *services.PromoValidationResult
	Err    error
}

func (m *MockPromoService) Create(req services.CreatePromoCodeRequest, actorID uint) (*models.PromoCode, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Promo, nil
}
func (m *MockPromoService) GetByID(id uint) (*models.PromoCode, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Promo, nil
}
func (m *MockPromoService) List(req utils.PageRequest, facilityID *uint, activeOnly bool) ([]*models.PromoCode, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Promos, m.Total, nil
}
func (m *MockPromoService) Update(id uint, req services.UpdatePromoCodeRequest) (*models.PromoCode, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Promo, nil
}
func (m *MockPromoService) Deactivate(id uint, actorID uint) error { return m.Err }
func (m *MockPromoService) ValidateForPlan(code string, planID uint) (*services.PromoValidationResult, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Result, nil
}

// MockFacilityService
type MockFacilityService struct {
	Facility   *models.Facility
	Facilities []*models.Facility
	Total      int64
	Err        error
}

func (m *MockFacilityService) Create(req services.CreateFacilityRequest) (*models.Facility, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Facility, nil
}
func (m *MockFacilityService) GetByID(id uint) (*models.Facility, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Facility, nil
}
func (m *MockFacilityService) List(req utils.PageRequest) ([]*models.Facility, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Facilities, m.Total, nil
}
func (m *MockFacilityService) Update(id uint, req services.UpdateFacilityRequest) (*models.Facility, error) {
	if m.Err != nil { return nil, m.Err }
	return m.Facility, nil
}

// MockReportService
type MockReportService struct {
	DashboardData   *repositories.DashboardStats
	RevenueData     *repositories.RevenueReport
	AttendanceData  *repositories.AttendanceReport
	MembersData     *repositories.MemberReport
	SubscriptionsData *repositories.SubscriptionReport
	ClassesData     *repositories.ClassReport
	Timeline        []repositories.TimelineEvent
	Err             error
}

func (m *MockReportService) Dashboard(facilityID uint) (*repositories.DashboardStats, error) {
	return m.DashboardData, m.Err
}
func (m *MockReportService) Revenue(facilityID uint, dr services.DateRangeRequest) (*repositories.RevenueReport, error) {
	return m.RevenueData, m.Err
}
func (m *MockReportService) Attendance(facilityID uint, dr services.DateRangeRequest) (*repositories.AttendanceReport, error) {
	return m.AttendanceData, m.Err
}
func (m *MockReportService) Members(facilityID uint) (*repositories.MemberReport, error) {
	return m.MembersData, m.Err
}
func (m *MockReportService) Subscriptions(facilityID uint) (*repositories.SubscriptionReport, error) {
	return m.SubscriptionsData, m.Err
}
func (m *MockReportService) Classes(facilityID uint, dr services.DateRangeRequest) (*repositories.ClassReport, error) {
	return m.ClassesData, m.Err
}
func (m *MockReportService) MemberTimeline(memberID uint, limit int) ([]repositories.TimelineEvent, error) {
	return m.Timeline, m.Err
}

func (m *MockReportService) ExpiringMembers(facilityID uint, days int) ([]repositories.ExpiringMember, error) {
	return nil, m.Err
}

func (m *MockReportService) InactiveMembers(facilityID uint, days int) ([]repositories.InactiveMember, error) {
	return nil, m.Err
}

func (m *MockReportService) Trainers(facilityID uint) (*repositories.TrainerReport, error) {
	return nil, m.Err
}

// MockAuditService
type MockAuditService struct {
	Logs  []*models.AuditLog
	Total int64
	Err   error
}

func (m *MockAuditService) List(req utils.PageRequest, userID *uint, resourceType string) ([]*models.AuditLog, int64, error) {
	if m.Err != nil { return nil, 0, m.Err }
	return m.Logs, m.Total, nil
}
