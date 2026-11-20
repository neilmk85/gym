package repositories

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"gym-backend/internal/models"
	"gym-backend/internal/utils"
)

type AttendanceRepository interface {
	Create(a *models.Attendance) error
	FindByID(id uint) (*models.Attendance, error)
	FindOpenCheckIn(memberID uint) (*models.Attendance, error) // check-in with no check-out
	List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error)
	Update(a *models.Attendance) error
	Stats(memberID uint) (*models.MemberAttendanceStats, error)
	BulkStats(memberIDs []uint) ([]*models.MemberAttendanceStats, error)
	CountTodayByMember(memberID uint, facilityID uint) (int64, error)
}

type attendanceRepository struct {
	db *gorm.DB
}

func NewAttendanceRepository(db *gorm.DB) AttendanceRepository {
	return &attendanceRepository{db: db}
}

func (r *attendanceRepository) Create(a *models.Attendance) error {
	return r.db.Create(a).Error
}

func (r *attendanceRepository) FindByID(id uint) (*models.Attendance, error) {
	var a models.Attendance
	err := r.db.Preload("Member.User").Preload("Facility").
		Where("id = ?", id).First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

// FindOpenCheckIn returns the latest attendance record for a member that has no check-out yet.
func (r *attendanceRepository) FindOpenCheckIn(memberID uint) (*models.Attendance, error) {
	var a models.Attendance
	err := r.db.Where("member_id = ? AND check_out_at IS NULL", memberID).
		Order("check_in_at DESC").First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *attendanceRepository) List(req utils.PageRequest, facilityID *uint, memberID *uint) ([]*models.Attendance, int64, error) {
	query := r.db.Model(&models.Attendance{}).Preload("Member.User")

	if facilityID != nil {
		query = query.Where("facility_id = ?", *facilityID)
	}
	if memberID != nil {
		query = query.Where("member_id = ?", *memberID)
	}
	if m, ok := req.Filters["method"]; ok && m != "" {
		query = query.Where("method = ?", m)
	}
	if from, ok := req.Filters["from"]; ok && from != "" {
		query = query.Where("check_in_at >= ?", from)
	}
	if to, ok := req.Filters["to"]; ok && to != "" {
		query = query.Where("check_in_at <= ?", to)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var records []*models.Attendance
	if err := req.Apply(query).Order("check_in_at DESC").Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func (r *attendanceRepository) Update(a *models.Attendance) error {
	return r.db.Save(a).Error
}

func (r *attendanceRepository) Stats(memberID uint) (*models.MemberAttendanceStats, error) {
	return r.statsForMember(memberID), nil
}

// BulkStats returns attendance stats for a list of member IDs in one pass.
func (r *attendanceRepository) BulkStats(memberIDs []uint) ([]*models.MemberAttendanceStats, error) {
	if len(memberIDs) == 0 {
		return nil, nil
	}
	now := time.Now()
	yearAgo := now.AddDate(-1, 0, 0)

	// Fetch one row per (member_id, date) for the last year — deduped to one visit per day.
	type row struct {
		MemberID  uint      `gorm:"column:member_id"`
		VisitDate time.Time `gorm:"column:visit_date"`
	}
	var rows []row
	r.db.Raw(`
		SELECT member_id, DATE(check_in_at) AS visit_date
		FROM attendance
		WHERE member_id IN ? AND check_in_at >= ?
		GROUP BY member_id, DATE(check_in_at)
		ORDER BY member_id, visit_date
	`, memberIDs, yearAgo).Scan(&rows)

	// Build a set of visited dates per member.
	type dateSet = map[string]bool
	visitMap := make(map[uint]dateSet, len(memberIDs))
	for _, id := range memberIDs {
		visitMap[id] = make(dateSet)
	}
	for _, r := range rows {
		visitMap[r.MemberID][r.VisitDate.Format("2006-01-02")] = true
	}

	// Last visit per member.
	type lastRow struct {
		MemberID    uint       `gorm:"column:member_id"`
		LastVisitAt *time.Time `gorm:"column:last_visit_at"`
	}
	var lastRows []lastRow
	r.db.Raw(`
		SELECT member_id, MAX(check_in_at) AS last_visit_at
		FROM attendance WHERE member_id IN ?
		GROUP BY member_id
	`, memberIDs).Scan(&lastRows)
	lastMap := make(map[uint]*time.Time, len(lastRows))
	for _, lr := range lastRows {
		t := lr.LastVisitAt
		lastMap[lr.MemberID] = t
	}

	// Total visits per member.
	type totalRow struct {
		MemberID uint  `gorm:"column:member_id"`
		Total    int64 `gorm:"column:total"`
	}
	var totalRows []totalRow
	r.db.Raw(`SELECT member_id, COUNT(*) AS total FROM attendance WHERE member_id IN ? GROUP BY member_id`, memberIDs).Scan(&totalRows)
	totalMap := make(map[uint]int64, len(totalRows))
	for _, tr := range totalRows {
		totalMap[tr.MemberID] = tr.Total
	}

	result := make([]*models.MemberAttendanceStats, 0, len(memberIDs))
	for _, id := range memberIDs {
		visited := visitMap[id]
		s := &models.MemberAttendanceStats{
			MemberID:    id,
			TotalVisits: totalMap[id],
			LastVisitAt: lastMap[id],
			Week:        periodStats(visited, now, 7),
			Month:       periodStats(visited, now, 30),
			Quarter:     periodStats(visited, now, 90),
			HalfYear:    periodStats(visited, now, 180),
			Year:        periodStats(visited, now, 365),
		}
		s.Risk = classifyRisk(s.Month)
		if s.TotalVisits > 0 {
			weeks := float64(now.Sub(now.AddDate(-1, 0, 0)).Hours()) / (7 * 24)
			if weeks > 0 {
				s.AvgVisitsPerWeek = float64(s.Year.Present) / weeks
			}
		}
		result = append(result, s)
	}
	return result, nil
}

func (r *attendanceRepository) statsForMember(memberID uint) *models.MemberAttendanceStats {
	now := time.Now()
	yearAgo := now.AddDate(-1, 0, 0)

	type row struct {
		VisitDate time.Time `gorm:"column:visit_date"`
	}
	var rows []row
	r.db.Raw(`
		SELECT DATE(check_in_at) AS visit_date
		FROM attendance
		WHERE member_id = ? AND check_in_at >= ?
		GROUP BY DATE(check_in_at)
	`, memberID, yearAgo).Scan(&rows)

	visited := make(map[string]bool, len(rows))
	for _, row := range rows {
		visited[row.VisitDate.Format("2006-01-02")] = true
	}

	stats := &models.MemberAttendanceStats{
		MemberID: memberID,
		Week:     periodStats(visited, now, 7),
		Month:    periodStats(visited, now, 30),
		Quarter:  periodStats(visited, now, 90),
		HalfYear: periodStats(visited, now, 180),
		Year:     periodStats(visited, now, 365),
	}

	r.db.Model(&models.Attendance{}).Where("member_id = ?", memberID).Count(&stats.TotalVisits)
	r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND duration_mins IS NOT NULL", memberID).
		Select("COALESCE(AVG(duration_mins), 0)").
		Scan(&stats.AvgDurationMins)

	var last models.Attendance
	if err := r.db.Where("member_id = ?", memberID).Order("check_in_at DESC").First(&last).Error; err == nil {
		stats.LastVisitAt = &last.CheckInAt
	}

	// Streak: consecutive days present counting back from yesterday.
	streak := 0
	for i := 1; ; i++ {
		d := now.AddDate(0, 0, -i).Format("2006-01-02")
		if visited[d] {
			streak++
		} else {
			break
		}
	}
	stats.Streak = streak

	if stats.Year.Present > 0 {
		stats.AvgVisitsPerWeek = float64(stats.Year.Present) / 52.0
	}

	stats.Risk = classifyRisk(stats.Month)
	return stats
}

// periodStats counts distinct visit days vs absent days in the last N days ending today.
func periodStats(visited map[string]bool, now time.Time, days int) models.AttendancePeriod {
	present := 0
	for i := 0; i < days; i++ {
		d := now.AddDate(0, 0, -i).Format("2006-01-02")
		if visited[d] {
			present++
		}
	}
	return models.AttendancePeriod{
		Present:      present,
		Absent:       days - present,
		DaysInPeriod: days,
	}
}

// classifyRisk returns a risk level based on monthly attendance percentage.
func classifyRisk(month models.AttendancePeriod) string {
	if month.DaysInPeriod == 0 {
		return "at_risk"
	}
	pct := float64(month.Present) / float64(month.DaysInPeriod) * 100
	switch {
	case pct >= 60:
		return "regular"
	case pct >= 30:
		return "irregular"
	default:
		return "at_risk"
	}
}

func (r *attendanceRepository) CountTodayByMember(memberID uint, facilityID uint) (int64, error) {
	today := time.Now().Truncate(24 * time.Hour)
	tomorrow := today.AddDate(0, 0, 1)
	var count int64
	err := r.db.Model(&models.Attendance{}).
		Where("member_id = ? AND facility_id = ? AND check_in_at >= ? AND check_in_at < ?",
			memberID, facilityID, today, tomorrow).
		Count(&count).Error
	return count, err
}
