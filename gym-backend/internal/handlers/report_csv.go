package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"time"

	"gym-backend/internal/repositories"
)

// writeCSV sets CSV response headers and writes all rows.
func writeCSV(w http.ResponseWriter, filename string, headers []string, rows [][]string) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.WriteHeader(http.StatusOK)

	cw := csv.NewWriter(w)
	_ = cw.Write(headers)
	for _, row := range rows {
		_ = cw.Write(row)
	}
	cw.Flush()
}

// csvFilename returns "<prefix>-YYYY-MM-DD.csv".
func csvFilename(prefix string) string {
	return fmt.Sprintf("%s-%s.csv", prefix, time.Now().Format("2006-01-02"))
}

// revenueCSV writes a RevenueReport as CSV.
// Two sections: summary header + daily breakdown.
func revenueCSV(w http.ResponseWriter, rep *repositories.RevenueReport) {
	headers := []string{"date", "revenue", "transactions"}
	rows := make([][]string, 0, len(rep.ByDay)+1)

	// Summary row first
	rows = append(rows, []string{
		"TOTAL",
		fmt.Sprintf("%.2f", rep.NetRevenue),
		fmt.Sprintf("%d", rep.TransactionCount),
	})
	for _, d := range rep.ByDay {
		rows = append(rows, []string{
			d.Date,
			fmt.Sprintf("%.2f", d.Amount),
			fmt.Sprintf("%d", d.Count),
		})
	}

	writeCSV(w, csvFilename("revenue"), headers, rows)
}

// attendanceCSV writes an AttendanceReport as CSV (daily breakdown).
func attendanceCSV(w http.ResponseWriter, rep *repositories.AttendanceReport) {
	headers := []string{"date", "check_ins"}
	rows := make([][]string, 0, len(rep.ByDay))
	for _, d := range rep.ByDay {
		rows = append(rows, []string{d.Date, fmt.Sprintf("%d", d.Count)})
	}
	writeCSV(w, csvFilename("attendance"), headers, rows)
}

// membersCSV writes a MemberReport summary as CSV.
func membersCSV(w http.ResponseWriter, rep *repositories.MemberReport) {
	headers := []string{"metric", "value"}
	rows := [][]string{
		{"total_members", fmt.Sprintf("%d", rep.TotalMembers)},
		{"active_members", fmt.Sprintf("%d", rep.ActiveMembers)},
		{"paused_members", fmt.Sprintf("%d", rep.PausedMembers)},
		{"cancelled_members", fmt.Sprintf("%d", rep.CancelledMembers)},
		{"expired_members", fmt.Sprintf("%d", rep.ExpiredMembers)},
		{"new_this_month", fmt.Sprintf("%d", rep.NewThisMonth)},
	}
	for _, g := range rep.ByGender {
		rows = append(rows, []string{"gender_" + g.Gender, fmt.Sprintf("%d", g.Count)})
	}
	writeCSV(w, csvFilename("members"), headers, rows)
}

// classesCSV writes a ClassReport (top-classes utilization) as CSV.
func classesCSV(w http.ResponseWriter, rep *repositories.ClassReport) {
	headers := []string{"class_id", "name", "max_capacity", "enrolled", "utilization_pct"}
	rows := make([][]string, 0, len(rep.TopClasses))
	for _, c := range rep.TopClasses {
		rows = append(rows, []string{
			fmt.Sprintf("%d", c.ClassID),
			c.Name,
			fmt.Sprintf("%d", c.MaxCapacity),
			fmt.Sprintf("%d", c.Enrolled),
			fmt.Sprintf("%.1f", c.Utilization),
		})
	}
	writeCSV(w, csvFilename("classes"), headers, rows)
}
