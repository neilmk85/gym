package repositories

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

// ─── Result structs ───────────────────────────────────────────────────────────

type DashboardStats struct {
	TotalMembers        int64   `json:"total_members"`
	ActiveMembers       int64   `json:"active_members"`
	NewMembersThisMonth int64   `json:"new_members_this_month"`
	ActiveSubscriptions int64   `json:"active_subscriptions"`
	RevenueThisMonth    float64 `json:"revenue_this_month"`
	RevenueLastMonth    float64 `json:"revenue_last_month"`
	TodayCheckIns       int64   `json:"today_check_ins"`
	UpcomingClasses     int64   `json:"upcoming_classes"`
	ActiveTrainers      int64   `json:"active_trainers"`
	PendingPayments     int64   `json:"pending_payments"`
}

type RevenueByMethod struct {
	Method string  `json:"method"`
	Amount float64 `json:"amount"`
	Count  int64   `json:"count"`
}

type DailyRevenue struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
	Count  int64   `json:"count"`
}

type RevenueReport struct {
	From             time.Time         `json:"from"`
	To               time.Time         `json:"to"`
	TotalRevenue     float64           `json:"total_revenue"`
	TotalRefunds     float64           `json:"total_refunds"`
	NetRevenue       float64           `json:"net_revenue"`
	TransactionCount int64             `json:"transaction_count"`
	ByMethod         []RevenueByMethod `json:"by_method"`
	ByDay            []DailyRevenue    `json:"by_day"`
}

type DailyAttendance struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type AttendanceByMethod struct {
	Method string `json:"method"`
	Count  int64  `json:"count"`
}

type HourlyAttendance struct {
	Hour  int   `json:"hour"`
	Count int64 `json:"count"`
}

type AttendanceReport struct {
	From             time.Time            `json:"from"`
	To               time.Time            `json:"to"`
	TotalCheckIns    int64                `json:"total_check_ins"`
	UniqueMembers    int64                `json:"unique_members"`
	AvgDailyCheckIns float64              `json:"avg_daily_check_ins"`
	AvgDurationMins  float64              `json:"avg_duration_mins"`
	PeakHour         int                  `json:"peak_hour"`
	ByDay            []DailyAttendance    `json:"by_day"`
	ByMethod         []AttendanceByMethod `json:"by_method"`
	ByHour           []HourlyAttendance   `json:"by_hour"`
}

type MemberByGender struct {
	Gender string `json:"gender"`
	Count  int64  `json:"count"`
}

type MonthlyGrowth struct {
	Month string `json:"month"` // "2026-01"
	New   int64  `json:"new"`
}

type MemberReport struct {
	TotalMembers     int64            `json:"total_members"`
	ActiveMembers    int64            `json:"active_members"`
	PausedMembers    int64            `json:"paused_members"`
	CancelledMembers int64            `json:"cancelled_members"`
	ExpiredMembers   int64            `json:"expired_members"`
	NewThisMonth     int64            `json:"new_this_month"`
	ByGender         []MemberByGender `json:"by_gender"`
	GrowthByMonth    []MonthlyGrowth  `json:"growth_by_month"`
}

type SubsByPlan struct {
	PlanID   uint   `json:"plan_id"`
	PlanName string `json:"plan_name"`
	Count    int64  `json:"count"`
}

type SubscriptionReport struct {
	Active          int64        `json:"active"`
	Paused          int64        `json:"paused"`
	Cancelled       int64        `json:"cancelled"`
	Expired         int64        `json:"expired"`
	AutoRenewCount  int64        `json:"auto_renew_count"`
	ExpiringIn7Days int64        `json:"expiring_in_7_days"`
	ByPlan          []SubsByPlan `json:"by_plan"`
}

type ClassesByType struct {
	ClassType string `json:"class_type"`
	Count     int64  `json:"count"`
}

type ClassUtilization struct {
	ClassID     uint    `json:"class_id"`
	Name        string  `json:"name"`
	MaxCapacity int     `json:"max_capacity"`
	Enrolled    int     `json:"enrolled"`
	Utilization float64 `json:"utilization_pct"`
}

type ClassReport struct {
	From           time.Time          `json:"from"`
	To             time.Time          `json:"to"`
	TotalClasses   int64              `json:"total_classes"`
	TotalBookings  int64              `json:"total_bookings"`
	CancelledCount int64              `json:"cancelled_count"`
	AvgUtilization float64            `json:"avg_utilization_pct"`
	ByType         []ClassesByType    `json:"by_type"`
	TopClasses     []ClassUtilization `json:"top_classes"`
}

// ─── Trainer Report ───────────────────────────────────────────────────────────

type TrainerStat struct {
	TrainerID       uint     `json:"trainer_id"`
	Name            string   `json:"name"`
	Email           string   `json:"email"`
	Phone           string   `json:"phone"`
	Specializations []string `json:"specializations"`
	ExperienceYears int      `json:"experience_years"`
	HourlyRate      float64  `json:"hourly_rate"`
	MaxClientsPerDay int     `json:"max_clients_per_day"`
	IsActive        bool     `json:"is_active"`
	AssignedMembers int64    `json:"assigned_members"`
	ClassesThisMonth int64   `json:"classes_this_month"`
	TotalClasses    int64    `json:"total_classes"`
}

type SpecializationCount struct {
	Specialization string `json:"specialization"`
	Count          int64  `json:"count"`
}

type TrainerReport struct {
	TotalTrainers      int64                 `json:"total_trainers"`
	ActiveTrainers     int64                 `json:"active_trainers"`
	AssignedMembers    int64                 `json:"assigned_members"`
	UnassignedMembers  int64                 `json:"unassigned_members"`
	Trainers           []TrainerStat         `json:"trainers"`
	BySpecialization   []SpecializationCount `json:"by_specialization"`
}

// InactiveMember is returned by the InactiveMembers query.
type InactiveMember struct {
	MemberID       uint       `json:"member_id"`
	Name           string     `json:"name"`
	Phone          string     `json:"phone"`
	Email          string     `json:"email"`
	MemberCode     string     `json:"member_code"`
	Status         string     `json:"status"`
	JoinedDate     time.Time  `json:"joined_date"`
	LastVisit      *time.Time `json:"last_visit"`
	DaysSinceVisit *int       `json:"days_since_visit"`
}

// ExpiringMember is returned by the ExpiringMembers query.
type ExpiringMember struct {
	MemberID uint      `json:"member_id"`
	Name     string    `json:"name"`
	Phone    string    `json:"phone"`
	Email    string    `json:"email"`
	PlanName string    `json:"plan_name"`
	EndDate  time.Time `json:"end_date"`
	DaysLeft int       `json:"days_left"`
}

type TimelineEvent struct {
	Type        string     `json:"type"`         // payment | attendance | subscription | booking
	ReferenceID uint       `json:"reference_id"`
	Title       string     `json:"title"`
	Detail      string     `json:"detail"`
	OccurredAt  time.Time  `json:"occurred_at"`
	Amount      *float64   `json:"amount,omitempty"`
	Status      string     `json:"status,omitempty"`
}

// ─── Interface ────────────────────────────────────────────────────────────────

type ReportRepository interface {
	Dashboard(facilityID uint) (*DashboardStats, error)
	Revenue(facilityID uint, from, to time.Time) (*RevenueReport, error)
	Attendance(facilityID uint, from, to time.Time) (*AttendanceReport, error)
	Members(facilityID uint) (*MemberReport, error)
	Subscriptions(facilityID uint) (*SubscriptionReport, error)
	Classes(facilityID uint, from, to time.Time) (*ClassReport, error)
	MemberTimeline(memberID uint, limit int) ([]TimelineEvent, error)
	ExpiringMembers(facilityID uint, days int) ([]ExpiringMember, error)
	InactiveMembers(facilityID uint, days int) ([]InactiveMember, error)
	Trainers(facilityID uint) (*TrainerReport, error)
}

type reportRepository struct {
	db *gorm.DB
}

func NewReportRepository(db *gorm.DB) ReportRepository {
	return &reportRepository{db: db}
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

func (r *reportRepository) Dashboard(facilityID uint) (*DashboardStats, error) {
	s := &DashboardStats{}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	lastMonthStart := monthStart.AddDate(0, -1, 0)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	tomorrow := today.AddDate(0, 0, 1)

	r.db.Table("members").Where("facility_id = ?", facilityID).Count(&s.TotalMembers)
	r.db.Table("members").Where("facility_id = ? AND membership_status = 'active'", facilityID).Count(&s.ActiveMembers)
	r.db.Table("members").Where("facility_id = ? AND joined_date >= ?", facilityID, monthStart).Count(&s.NewMembersThisMonth)

	memberSubQ := r.db.Table("members").Select("id").Where("facility_id = ?", facilityID)
	r.db.Table("subscriptions").
		Where("status = 'active' AND member_id IN (?)", memberSubQ).
		Count(&s.ActiveSubscriptions)

	r.db.Table("payments").
		Where("status = 'completed' AND paid_at >= ? AND paid_at < ? AND member_id IN (?)",
			monthStart, now, memberSubQ).
		Select("COALESCE(SUM(amount), 0)").Scan(&s.RevenueThisMonth)

	r.db.Table("payments").
		Where("status = 'completed' AND paid_at >= ? AND paid_at < ? AND member_id IN (?)",
			lastMonthStart, monthStart, memberSubQ).
		Select("COALESCE(SUM(amount), 0)").Scan(&s.RevenueLastMonth)

	r.db.Table("attendances").
		Where("facility_id = ? AND check_in_at >= ? AND check_in_at < ?", facilityID, today, tomorrow).
		Count(&s.TodayCheckIns)

	r.db.Table("classes").
		Where("facility_id = ? AND start_time > ? AND status = 'scheduled'", facilityID, now).
		Count(&s.UpcomingClasses)

	r.db.Table("trainer_profiles").
		Where("facility_id = ? AND is_active = true", facilityID).
		Count(&s.ActiveTrainers)

	r.db.Table("payments").
		Where("status = 'pending' AND member_id IN (?)", memberSubQ).
		Count(&s.PendingPayments)

	return s, nil
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

func (r *reportRepository) Revenue(facilityID uint, from, to time.Time) (*RevenueReport, error) {
	rep := &RevenueReport{From: from, To: to}

	memberSubQ := r.db.Table("members").Select("id").Where("facility_id = ?", facilityID)
	base := r.db.Table("payments").
		Where("status IN ('completed','refunded') AND paid_at >= ? AND paid_at <= ? AND member_id IN (?)",
			from, to, memberSubQ)

	// Totals.
	type totals struct {
		Revenue  float64
		Refunds  float64
		TxCount  int64
	}
	var t totals
	r.db.Table("payments").
		Where("status = 'completed' AND paid_at >= ? AND paid_at <= ? AND member_id IN (?)", from, to, memberSubQ).
		Select("COALESCE(SUM(amount),0) AS revenue, COUNT(*) AS tx_count").
		Scan(&t)
	rep.TotalRevenue = t.Revenue
	rep.TransactionCount = t.TxCount

	r.db.Table("payments").
		Where("status = 'refunded' AND paid_at >= ? AND paid_at <= ? AND member_id IN (?)", from, to, memberSubQ).
		Select("COALESCE(SUM(refund_amount),0) AS refunds").
		Scan(&t)
	rep.TotalRefunds = t.Refunds
	rep.NetRevenue = rep.TotalRevenue - rep.TotalRefunds

	// By payment method.
	_ = base
	r.db.Table("payments").
		Select("payment_method AS method, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count").
		Where("status = 'completed' AND paid_at >= ? AND paid_at <= ? AND member_id IN (?)", from, to, memberSubQ).
		Group("payment_method").
		Scan(&rep.ByMethod)

	// By day.
	r.db.Table("payments").
		Select("DATE_FORMAT(paid_at, '%Y-%m-%d') AS date, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count").
		Where("status = 'completed' AND paid_at >= ? AND paid_at <= ? AND member_id IN (?)", from, to, memberSubQ).
		Group("DATE_FORMAT(paid_at, '%Y-%m-%d')").
		Order("date ASC").
		Scan(&rep.ByDay)

	return rep, nil
}

// ─── Attendance ───────────────────────────────────────────────────────────────

func (r *reportRepository) Attendance(facilityID uint, from, to time.Time) (*AttendanceReport, error) {
	rep := &AttendanceReport{From: from, To: to}

	base := r.db.Table("attendances").
		Where("facility_id = ? AND check_in_at >= ? AND check_in_at <= ?", facilityID, from, to)

	base.Count(&rep.TotalCheckIns)
	base.Distinct("member_id").Count(&rep.UniqueMembers)
	base.Select("COALESCE(AVG(duration_mins),0)").Where("duration_mins IS NOT NULL").Scan(&rep.AvgDurationMins)

	// Avg daily check-ins.
	days := to.Sub(from).Hours() / 24
	if days < 1 {
		days = 1
	}
	rep.AvgDailyCheckIns = float64(rep.TotalCheckIns) / days

	// By day.
	r.db.Table("attendances").
		Select("DATE_FORMAT(check_in_at, '%Y-%m-%d') AS date, COUNT(*) AS count").
		Where("facility_id = ? AND check_in_at >= ? AND check_in_at <= ?", facilityID, from, to).
		Group("DATE_FORMAT(check_in_at, '%Y-%m-%d')").Order("date ASC").
		Scan(&rep.ByDay)

	// By method.
	r.db.Table("attendances").
		Select("method, COUNT(*) AS count").
		Where("facility_id = ? AND check_in_at >= ? AND check_in_at <= ?", facilityID, from, to).
		Group("method").
		Scan(&rep.ByMethod)

	// By hour (to find peak).
	r.db.Table("attendances").
		Select("HOUR(check_in_at) AS hour, COUNT(*) AS count").
		Where("facility_id = ? AND check_in_at >= ? AND check_in_at <= ?", facilityID, from, to).
		Group("HOUR(check_in_at)").Order("count DESC").
		Scan(&rep.ByHour)

	if len(rep.ByHour) > 0 {
		rep.PeakHour = rep.ByHour[0].Hour
	}

	return rep, nil
}

// ─── Members ──────────────────────────────────────────────────────────────────

func (r *reportRepository) Members(facilityID uint) (*MemberReport, error) {
	rep := &MemberReport{}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	r.db.Table("members").Where("facility_id = ?", facilityID).Count(&rep.TotalMembers)
	r.db.Table("members").Where("facility_id = ? AND membership_status = 'active'", facilityID).Count(&rep.ActiveMembers)
	r.db.Table("members").Where("facility_id = ? AND membership_status = 'paused'", facilityID).Count(&rep.PausedMembers)
	r.db.Table("members").Where("facility_id = ? AND membership_status = 'cancelled'", facilityID).Count(&rep.CancelledMembers)
	r.db.Table("members").Where("facility_id = ? AND membership_status = 'expired'", facilityID).Count(&rep.ExpiredMembers)
	r.db.Table("members").Where("facility_id = ? AND joined_date >= ?", facilityID, monthStart).Count(&rep.NewThisMonth)

	// By gender (joined to users).
	r.db.Table("members").
		Select("COALESCE(users.gender, 'Unknown') AS gender, COUNT(*) AS count").
		Joins("JOIN users ON users.id = members.user_id").
		Where("members.facility_id = ?", facilityID).
		Group("users.gender").
		Scan(&rep.ByGender)

	// Monthly growth — last 12 months.
	twelveMonthsAgo := monthStart.AddDate(0, -11, 0)
	r.db.Table("members").
		Select("DATE_FORMAT(joined_date, '%Y-%m') AS month, COUNT(*) AS new").
		Where("facility_id = ? AND joined_date >= ?", facilityID, twelveMonthsAgo).
		Group("DATE_FORMAT(joined_date, '%Y-%m')").
		Order("month ASC").
		Scan(&rep.GrowthByMonth)

	return rep, nil
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

func (r *reportRepository) Subscriptions(facilityID uint) (*SubscriptionReport, error) {
	rep := &SubscriptionReport{}
	now := time.Now()

	memberSubQ := r.db.Table("members").Select("id").Where("facility_id = ?", facilityID)

	r.db.Table("subscriptions").Where("status = 'active' AND member_id IN (?)", memberSubQ).Count(&rep.Active)
	r.db.Table("subscriptions").Where("status = 'paused' AND member_id IN (?)", memberSubQ).Count(&rep.Paused)
	r.db.Table("subscriptions").Where("status = 'cancelled' AND member_id IN (?)", memberSubQ).Count(&rep.Cancelled)
	r.db.Table("subscriptions").Where("status = 'expired' AND member_id IN (?)", memberSubQ).Count(&rep.Expired)
	r.db.Table("subscriptions").Where("status = 'active' AND auto_renew = true AND member_id IN (?)", memberSubQ).Count(&rep.AutoRenewCount)
	r.db.Table("subscriptions").
		Where("status = 'active' AND end_date <= ? AND member_id IN (?)", now.AddDate(0, 0, 7), memberSubQ).
		Count(&rep.ExpiringIn7Days)

	// By plan.
	r.db.Table("subscriptions").
		Select("subscriptions.plan_id, plans.name AS plan_name, COUNT(*) AS count").
		Joins("JOIN plans ON plans.id = subscriptions.plan_id").
		Where("subscriptions.member_id IN (?)", memberSubQ).
		Group("subscriptions.plan_id, plans.name").
		Order("count DESC").
		Scan(&rep.ByPlan)

	return rep, nil
}

// ─── Classes ──────────────────────────────────────────────────────────────────

func (r *reportRepository) Classes(facilityID uint, from, to time.Time) (*ClassReport, error) {
	rep := &ClassReport{From: from, To: to}

	r.db.Table("classes").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ?", facilityID, from, to).
		Count(&rep.TotalClasses)

	r.db.Table("classes").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ? AND status = 'cancelled'", facilityID, from, to).
		Count(&rep.CancelledCount)

	// Total confirmed bookings for classes in the window.
	classSubQ := r.db.Table("classes").Select("id").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ?", facilityID, from, to)
	r.db.Table("class_bookings").
		Where("status IN ('confirmed','attended') AND class_id IN (?)", classSubQ).
		Count(&rep.TotalBookings)

	// Avg utilization (current_enrollment / max_capacity * 100).
	r.db.Table("classes").
		Select("COALESCE(AVG(current_enrollment / NULLIF(max_capacity, 0) * 100), 0)").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ? AND status != 'cancelled'", facilityID, from, to).
		Scan(&rep.AvgUtilization)

	// By class type.
	r.db.Table("classes").
		Select("class_type, COUNT(*) AS count").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ?", facilityID, from, to).
		Group("class_type").Order("count DESC").
		Scan(&rep.ByType)

	// Top 10 classes by enrollment.
	r.db.Table("classes").
		Select("id AS class_id, name, max_capacity, current_enrollment AS enrolled, "+
			"ROUND(current_enrollment / NULLIF(max_capacity,0) * 100, 1) AS utilization").
		Where("facility_id = ? AND start_time >= ? AND start_time <= ? AND status != 'cancelled'", facilityID, from, to).
		Order("current_enrollment DESC").Limit(10).
		Scan(&rep.TopClasses)

	return rep, nil
}

// ─── Member Timeline ──────────────────────────────────────────────────────────

func (r *reportRepository) MemberTimeline(memberID uint, limit int) ([]TimelineEvent, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	var events []TimelineEvent

	// Payments.
	type payRow struct {
		ID     uint
		Amount float64
		Status string
		Method string
		PaidAt time.Time
	}
	var payments []payRow
	r.db.Table("payments").
		Select("id, amount, status, payment_method AS method, paid_at").
		Where("member_id = ?", memberID).
		Order("paid_at DESC").Limit(limit).
		Scan(&payments)
	for _, p := range payments {
		amt := p.Amount
		events = append(events, TimelineEvent{
			Type:        "payment",
			ReferenceID: p.ID,
			Title:       "Payment recorded",
			Detail:      p.Method,
			OccurredAt:  p.PaidAt,
			Amount:      &amt,
			Status:      p.Status,
		})
	}

	// Attendance.
	type attRow struct {
		ID          uint
		CheckInAt   time.Time
		DurationMin *int
		Method      string
	}
	var attendances []attRow
	r.db.Table("attendances").
		Select("id, check_in_at, duration_mins AS duration_min, method").
		Where("member_id = ?", memberID).
		Order("check_in_at DESC").Limit(limit).
		Scan(&attendances)
	for _, a := range attendances {
		detail := a.Method
		if a.DurationMin != nil {
			detail += " · check-out recorded"
		}
		events = append(events, TimelineEvent{
			Type:        "attendance",
			ReferenceID: a.ID,
			Title:       "Gym visit",
			Detail:      detail,
			OccurredAt:  a.CheckInAt,
		})
	}

	// Subscriptions.
	type subRow struct {
		ID        uint
		Status    string
		StartDate time.Time
		PlanName  string
	}
	var subs []subRow
	r.db.Table("subscriptions").
		Select("subscriptions.id, subscriptions.status, subscriptions.start_date, plans.name AS plan_name").
		Joins("JOIN plans ON plans.id = subscriptions.plan_id").
		Where("subscriptions.member_id = ?", memberID).
		Order("subscriptions.start_date DESC").Limit(limit).
		Scan(&subs)
	for _, s := range subs {
		events = append(events, TimelineEvent{
			Type:        "subscription",
			ReferenceID: s.ID,
			Title:       "Subscription",
			Detail:      s.PlanName,
			OccurredAt:  s.StartDate,
			Status:      s.Status,
		})
	}

	// Class bookings.
	type bookRow struct {
		ID        uint
		Status    string
		ClassName string
		BookedAt  time.Time
	}
	var bookings []bookRow
	r.db.Table("class_bookings").
		Select("class_bookings.id, class_bookings.status, classes.name AS class_name, class_bookings.created_at AS booked_at").
		Joins("JOIN classes ON classes.id = class_bookings.class_id").
		Where("class_bookings.member_id = ?", memberID).
		Order("class_bookings.created_at DESC").Limit(limit).
		Scan(&bookings)
	for _, b := range bookings {
		events = append(events, TimelineEvent{
			Type:        "booking",
			ReferenceID: b.ID,
			Title:       "Class booking",
			Detail:      b.ClassName,
			OccurredAt:  b.BookedAt,
			Status:      b.Status,
		})
	}

	// Sort all events by occurred_at DESC (insertion sort — N is small).
	for i := 0; i < len(events)-1; i++ {
		for j := i + 1; j < len(events); j++ {
			if events[j].OccurredAt.After(events[i].OccurredAt) {
				events[i], events[j] = events[j], events[i]
			}
		}
	}
	if len(events) > limit {
		events = events[:limit]
	}

	return events, nil
}

// ─── Expiring Members ─────────────────────────────────────────────────────────

func (r *reportRepository) ExpiringMembers(facilityID uint, days int) ([]ExpiringMember, error) {
	if days <= 0 {
		days = 7
	}
	if days > 90 {
		days = 90
	}
	var rows []ExpiringMember
	err := r.db.Table("subscriptions s").
		Select(`m.id AS member_id,
			CONCAT(u.first_name,' ',u.last_name) AS name,
			u.phone, u.email,
			p.name AS plan_name,
			s.end_date,
			DATEDIFF(s.end_date, NOW()) AS days_left`).
		Joins("JOIN members m ON m.id = s.member_id").
		Joins("JOIN users u ON u.id = m.user_id").
		Joins("JOIN plans p ON p.id = s.plan_id").
		Where("s.status = 'active' AND s.end_date >= NOW() AND s.end_date <= DATE_ADD(NOW(), INTERVAL ? DAY) AND m.facility_id = ?", days, facilityID).
		Order("s.end_date ASC").
		Limit(100).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// ─── Inactive Members ─────────────────────────────────────────────────────────

func (r *reportRepository) InactiveMembers(facilityID uint, days int) ([]InactiveMember, error) {
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}

	type rawRow struct {
		MemberID       uint
		Name           string
		Phone          string
		Email          string
		MemberCode     string
		Status         string
		JoinedDate     time.Time
		LastVisit      *time.Time
		DaysSinceVisit *int
	}

	var rows []rawRow
	err := r.db.Table("members m").
		Select(`m.id AS member_id,
			CONCAT(u.first_name,' ',u.last_name) AS name,
			u.phone, u.email,
			m.member_code, m.membership_status AS status,
			m.joined_date,
			MAX(a.check_in_at) AS last_visit,
			DATEDIFF(NOW(), MAX(a.check_in_at)) AS days_since_visit`).
		Joins("JOIN users u ON u.id = m.user_id").
		Joins("LEFT JOIN attendances a ON a.member_id = m.id").
		Where("m.facility_id = ? AND m.membership_status = 'active'", facilityID).
		Group("m.id, u.first_name, u.last_name, u.phone, u.email, m.member_code, m.membership_status, m.joined_date").
		Having("last_visit IS NULL OR DATEDIFF(NOW(), last_visit) >= ?", days).
		Order("days_since_visit DESC").
		Limit(200).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make([]InactiveMember, 0, len(rows))
	for _, row := range rows {
		result = append(result, InactiveMember{
			MemberID:       row.MemberID,
			Name:           row.Name,
			Phone:          row.Phone,
			Email:          row.Email,
			MemberCode:     row.MemberCode,
			Status:         row.Status,
			JoinedDate:     row.JoinedDate,
			LastVisit:      row.LastVisit,
			DaysSinceVisit: row.DaysSinceVisit,
		})
	}
	return result, nil
}

// ─── Trainers ─────────────────────────────────────────────────────────────────

func (r *reportRepository) Trainers(facilityID uint) (*TrainerReport, error) {
	rep := &TrainerReport{}
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// Headline counts.
	r.db.Table("trainer_profiles").Where("facility_id = ?", facilityID).Count(&rep.TotalTrainers)
	r.db.Table("trainer_profiles").Where("facility_id = ? AND is_active = true", facilityID).Count(&rep.ActiveTrainers)
	r.db.Table("members").Where("facility_id = ? AND assigned_trainer_id IS NOT NULL", facilityID).Count(&rep.AssignedMembers)

	var totalMembers int64
	r.db.Table("members").Where("facility_id = ?", facilityID).Count(&totalMembers)
	rep.UnassignedMembers = totalMembers - rep.AssignedMembers

	// Per-trainer stats.
	type trainerRow struct {
		TrainerID        uint
		Name             string
		Email            string
		Phone            string
		Specializations  string // JSON stored as text
		ExperienceYears  int
		HourlyRate       float64
		MaxClientsPerDay int
		IsActive         bool
		AssignedMembers  int64
		ClassesThisMonth int64
		TotalClasses     int64
	}
	var rows []trainerRow
	r.db.Table("trainer_profiles tp").
		Select(`tp.id AS trainer_id,
			CONCAT(u.first_name,' ',u.last_name) AS name,
			u.email, u.phone,
			tp.specializations,
			tp.experience_years,
			tp.hourly_rate,
			tp.max_clients_per_day,
			tp.is_active,
			COUNT(DISTINCT m.id) AS assigned_members,
			COUNT(DISTINCT CASE WHEN c.start_time >= ? THEN c.id END) AS classes_this_month,
			COUNT(DISTINCT c.id) AS total_classes`, monthStart).
		Joins("JOIN users u ON u.id = tp.user_id").
		Joins("LEFT JOIN members m ON m.assigned_trainer_id = tp.id AND m.facility_id = ?", facilityID).
		Joins("LEFT JOIN classes c ON c.trainer_id = tp.id AND c.status IN ('completed','scheduled','ongoing')").
		Where("tp.facility_id = ?", facilityID).
		Group("tp.id, u.first_name, u.last_name, u.email, u.phone, tp.specializations, tp.experience_years, tp.hourly_rate, tp.max_clients_per_day, tp.is_active").
		Order("assigned_members DESC, tp.is_active DESC").
		Scan(&rows)

	rep.Trainers = make([]TrainerStat, 0, len(rows))
	for _, row := range rows {
		// Parse specializations JSON array stored as text (e.g. ["yoga","cardio"]).
		specs := parseStringSlice(row.Specializations)
		rep.Trainers = append(rep.Trainers, TrainerStat{
			TrainerID:        row.TrainerID,
			Name:             row.Name,
			Email:            row.Email,
			Phone:            row.Phone,
			Specializations:  specs,
			ExperienceYears:  row.ExperienceYears,
			HourlyRate:       row.HourlyRate,
			MaxClientsPerDay: row.MaxClientsPerDay,
			IsActive:         row.IsActive,
			AssignedMembers:  row.AssignedMembers,
			ClassesThisMonth: row.ClassesThisMonth,
			TotalClasses:     row.TotalClasses,
		})
	}

	// Specialization frequency — count occurrences across all trainer profiles.
	type specRow struct {
		Specialization string
		Count          int64
	}
	var specRows []specRow
	r.db.Table("trainer_profiles tp").
		Select("JSON_UNQUOTE(JSON_EXTRACT(tp.specializations, CONCAT('$[', n.n, ']'))) AS specialization, COUNT(*) AS count").
		Joins(`JOIN (
			SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
			UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
		) n ON JSON_EXTRACT(tp.specializations, CONCAT('$[', n.n, ']')) IS NOT NULL`).
		Where("tp.facility_id = ? AND tp.is_active = true", facilityID).
		Group("specialization").
		Having("specialization IS NOT NULL AND specialization != 'null'").
		Order("count DESC").
		Scan(&specRows)

	rep.BySpecialization = make([]SpecializationCount, 0, len(specRows))
	for _, s := range specRows {
		if s.Specialization != "" {
			rep.BySpecialization = append(rep.BySpecialization, SpecializationCount{
				Specialization: s.Specialization,
				Count:          s.Count,
			})
		}
	}

	return rep, nil
}

// parseStringSlice converts a JSON array string like ["yoga","cardio"] to []string.
func parseStringSlice(raw string) []string {
	if raw == "" || raw == "null" || raw == "[]" {
		return []string{}
	}
	// Trim brackets and split by comma, stripping quotes.
	raw = strings.TrimSpace(raw)
	if len(raw) < 2 || raw[0] != '[' {
		return []string{}
	}
	raw = raw[1 : len(raw)-1]
	if raw == "" {
		return []string{}
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		p = strings.Trim(p, `"`)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
