// cmd/import-members/main.go
// One-time import script: reads stayfit_active_members.csv → inserts into stayfit_db
//
// Usage (on VPS, from gym-backend directory):
//   DB_HOST=localhost DB_USER=root DB_PASSWORD=... DB_NAME=stayfit_db \
//   JWT_SECRET=... ./import-members /path/to/stayfit_active_members.csv
//
// What it creates per row:
//   • users   (email = phone@stayfit.local, password = "Welcome@1234", role = member)
//   • members (member_code = SF-<old_id>, joined_date = First Join Date)
//   • subscriptions (start = Last Renewed On, end = Expiry Date, status = active)
//   • payments (amount = Amount Paid, method = cash, status = completed)
//
// Safe to re-run: skips rows where phone already exists as a user.

package main

import (
	"encoding/csv"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ── plan name → plan ID mapping ────────────────────────────────────────────────
var planMap = map[string]uint{
	"male 1 month":                    17,
	"male 3 months":                   18,
	"male 6 months":                   19,
	"male 1 year":                     20,
	"female 1 month":                  21,
	"female 3 months":                 22,
	"female 6 months":                 23,
	"female 1 year":                   24,
	"couple package 1 year":           11,
	"student couple package":          11,
	"student couple package 6 month":  11,
	"student couple package 1 year":   11,
}

// normalise removes extra spaces and lowercases the plan name
func normalisePlan(raw string) string {
	fields := strings.Fields(strings.ToLower(raw))
	return strings.Join(fields, " ")
}

func planID(raw string) (uint, bool) {
	n := normalisePlan(raw)
	id, ok := planMap[n]
	if ok {
		return id, true
	}
	// try prefix matches for minor variants
	for key, id := range planMap {
		if strings.HasPrefix(n, key) || strings.HasPrefix(key, n) {
			return id, true
		}
	}
	return 0, false
}

// ── date parsing ───────────────────────────────────────────────────────────────
func parseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{"02-01-2006", "2006-01-02", "01/02/2006", "2-1-2006"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse date %q", s)
}

// ── name splitting ─────────────────────────────────────────────────────────────
func splitName(full string) (first, last string) {
	full = strings.TrimSpace(full)
	parts := strings.Fields(full)
	if len(parts) == 0 {
		return "Unknown", ""
	}
	if len(parts) == 1 {
		return parts[0], ""
	}
	return strings.Join(parts[:len(parts)-1], " "), parts[len(parts)-1]
}

// ── gender from plan name ──────────────────────────────────────────────────────
func genderFromPlan(raw string) string {
	n := strings.ToLower(raw)
	if strings.Contains(n, "female") {
		return "F"
	}
	if strings.Contains(n, "male") {
		return "M"
	}
	return "M" // default
}

// ── parse amount ───────────────────────────────────────────────────────────────
func parseAmount(s string) float64 {
	s = strings.TrimSpace(s)
	// remove commas
	s = strings.ReplaceAll(s, ",", "")
	f, _ := strconv.ParseFloat(s, 64)
	return math.Abs(f)
}

// ── minimal model structs (only fields we write) ───────────────────────────────

type User struct {
	ID           uint   `gorm:"primaryKey;autoIncrement"`
	Email        string `gorm:"size:255;uniqueIndex;not null"`
	Phone        string `gorm:"size:20"`
	PasswordHash string `gorm:"size:255;not null"`
	FirstName    string `gorm:"size:100;not null"`
	LastName     string `gorm:"size:100;not null"`
	Gender       *string `gorm:"type:enum('M','F','Other')"`
	Role         string `gorm:"type:enum('superadmin','owner','reception','manager','trainer','member');not null"`
	Status       string `gorm:"type:enum('active','inactive','suspended','locked');default:active"`
	FacilityID   *uint  `gorm:"index"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (User) TableName() string { return "users" }

type Member struct {
	ID               uint      `gorm:"primaryKey;autoIncrement"`
	UserID           uint      `gorm:"uniqueIndex;not null"`
	FacilityID       uint      `gorm:"not null;index"`
	MemberCode       string    `gorm:"size:30;uniqueIndex"`
	MembershipStatus string    `gorm:"type:enum('active','paused','expired','cancelled');default:active;index"`
	CurrentPlanID    *uint
	JoinedDate       time.Time `gorm:"type:date;not null"`
	MemberNotes      string    `gorm:"type:text"`
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (Member) TableName() string { return "members" }

type Subscription struct {
	ID             uint      `gorm:"primaryKey;autoIncrement"`
	MemberID       uint      `gorm:"not null;index"`
	PlanID         uint      `gorm:"not null"`
	StartDate      time.Time `gorm:"type:date;not null"`
	EndDate        time.Time `gorm:"type:date;not null"`
	Status         string    `gorm:"type:enum('active','paused','expired','cancelled');default:active;index"`
	OriginalAmount float64   `gorm:"type:decimal(10,2)"`
	DiscountAmount float64   `gorm:"type:decimal(10,2);default:0"`
	FinalAmount    float64   `gorm:"type:decimal(10,2)"`
	Currency       string    `gorm:"size:3;default:INR"`
	AutoRenew      bool      `gorm:"default:true"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (Subscription) TableName() string { return "subscriptions" }

type Payment struct {
	ID             uint      `gorm:"primaryKey;autoIncrement"`
	MemberID       uint      `gorm:"not null;index"`
	SubscriptionID *uint     `gorm:"index"`
	Amount         float64   `gorm:"type:decimal(10,2);not null"`
	Currency       string    `gorm:"size:3;default:INR"`
	PaymentMethod  string    `gorm:"type:enum('cash','upi','card','bank_transfer','razorpay','other');not null"`
	Status         string    `gorm:"type:enum('pending','completed','failed','refunded');default:completed;index"`
	Notes          string    `gorm:"type:text"`
	PaidAt         time.Time `gorm:"not null"`
	RecordedByID   uint
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func (Payment) TableName() string { return "payments" }

// ── main ───────────────────────────────────────────────────────────────────────

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: import-members <path/to/stayfit_active_members.csv>")
	}
	csvPath := os.Args[1]

	// ── DB connection ──────────────────────────────────────────────────────────
	host     := getEnv("DB_HOST", "localhost")
	port     := getEnv("DB_PORT", "3306")
	user     := getEnv("DB_USER", "root")
	password := getEnv("DB_PASSWORD", "")
	dbName   := getEnv("DB_NAME", "stayfit_db")

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		user, password, host, port, dbName)

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("DB connect: %v", err)
	}

	// ── find the admin user (RecordedByID for payments) ───────────────────────
	var adminID uint = 1
	var adminUser struct{ ID uint }
	db.Raw("SELECT id FROM users WHERE role='owner' OR role='superadmin' LIMIT 1").Scan(&adminUser)
	if adminUser.ID > 0 {
		adminID = adminUser.ID
	}

	// ── bcrypt default password ────────────────────────────────────────────────
	hash, err := bcrypt.GenerateFromPassword([]byte("Welcome@1234"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("bcrypt: %v", err)
	}
	defaultPassword := string(hash)
	facilityID := uint(1)

	// ── read CSV ───────────────────────────────────────────────────────────────
	f, err := os.Open(csvPath)
	if err != nil {
		log.Fatalf("open CSV: %v", err)
	}
	defer f.Close()

	r := csv.NewReader(f)
	r.TrimLeadingSpace = true
	records, err := r.ReadAll()
	if err != nil {
		log.Fatalf("read CSV: %v", err)
	}

	// columns:
	// 0  Client ID
	// 1  Name
	// 2  Phone
	// 3  Current Plan
	// 4  Last Renewed On
	// 5  Expiry Date
	// 6  Days Left
	// 7  Renewal Urgency
	// 8  Amount Paid
	// 9  Pending Amount
	// 10 Total Visits
	// 11 First Join Date
	// 12 All Bill Dates
	// 13 Representative

	skipped, created, failed := 0, 0, 0

	for i, row := range records {
		if i == 0 {
			continue // header
		}
		if len(row) < 12 {
			log.Printf("row %d: too few columns, skipping", i+1)
			skipped++
			continue
		}

		oldClientID := strings.TrimSpace(row[0])
		fullName     := strings.TrimSpace(row[1])
		phone        := strings.TrimSpace(row[2])
		planRaw      := strings.TrimSpace(row[3])
		renewedOnStr := strings.TrimSpace(row[4])
		expiryStr    := strings.TrimSpace(row[5])
		amountStr    := strings.TrimSpace(row[8])
		joinDateStr  := strings.TrimSpace(row[11])

		// ── plan lookup ───────────────────────────────────────────────────────
		pID, ok := planID(planRaw)
		if !ok {
			log.Printf("row %d [%s]: unknown plan %q — skipping", i+1, fullName, planRaw)
			failed++
			continue
		}

		// ── dates ─────────────────────────────────────────────────────────────
		joinDate, err := parseDate(joinDateStr)
		if err != nil {
			log.Printf("row %d [%s]: bad join date %q: %v", i+1, fullName, joinDateStr, err)
			failed++
			continue
		}
		renewedOn, err := parseDate(renewedOnStr)
		if err != nil {
			log.Printf("row %d [%s]: bad renewed date %q: %v", i+1, fullName, renewedOnStr, err)
			failed++
			continue
		}
		expiry, err := parseDate(expiryStr)
		if err != nil {
			log.Printf("row %d [%s]: bad expiry %q: %v", i+1, fullName, expiryStr, err)
			failed++
			continue
		}

		amount := parseAmount(amountStr)

		// ── email (placeholder) ───────────────────────────────────────────────
		email := fmt.Sprintf("%s@stayfit.local", phone)

		// ── skip if phone/email already in DB ─────────────────────────────────
		var existing User
		db.Where("email = ? OR phone = ?", email, phone).First(&existing)
		if existing.ID > 0 {
			log.Printf("row %d [%s]: phone %s already exists (user %d) — skipping", i+1, fullName, phone, existing.ID)
			skipped++
			continue
		}

		// ── run inside a transaction ───────────────────────────────────────────
		txErr := db.Transaction(func(tx *gorm.DB) error {
			firstName, lastName := splitName(fullName)
			gender := genderFromPlan(planRaw)

			// 1. User
			u := User{
				Email:        email,
				Phone:        phone,
				PasswordHash: defaultPassword,
				FirstName:    firstName,
				LastName:     lastName,
				Gender:       &gender,
				Role:         "member",
				Status:       "active",
				FacilityID:   &facilityID,
			}
			if err := tx.Create(&u).Error; err != nil {
				return fmt.Errorf("create user: %w", err)
			}

			// 2. Member
			memberCode := fmt.Sprintf("SF-%s", oldClientID)
			m := Member{
				UserID:           u.ID,
				FacilityID:       facilityID,
				MemberCode:       memberCode,
				MembershipStatus: "active",
				CurrentPlanID:    &pID,
				JoinedDate:       joinDate,
				MemberNotes:      fmt.Sprintf("Imported from Easy Gym Software (Client ID %s)", oldClientID),
			}
			if err := tx.Create(&m).Error; err != nil {
				return fmt.Errorf("create member: %w", err)
			}

			// 3. Subscription
			sub := Subscription{
				MemberID:       m.ID,
				PlanID:         pID,
				StartDate:      renewedOn,
				EndDate:        expiry,
				Status:         "active",
				OriginalAmount: amount,
				FinalAmount:    amount,
				Currency:       "INR",
				AutoRenew:      true,
			}
			if err := tx.Create(&sub).Error; err != nil {
				return fmt.Errorf("create subscription: %w", err)
			}

			// 4. Update member with current subscription ID
			if err := tx.Model(&m).Updates(map[string]interface{}{
				"current_subscription_id": sub.ID,
			}).Error; err != nil {
				return fmt.Errorf("update member sub id: %w", err)
			}

			// 5. Payment (only if amount > 0)
			if amount > 0 {
				subID := sub.ID
				pay := Payment{
					MemberID:       m.ID,
					SubscriptionID: &subID,
					Amount:         amount,
					Currency:       "INR",
					PaymentMethod:  "cash",
					Status:         "completed",
					Notes:          fmt.Sprintf("Imported from Easy Gym Software. Original Client ID: %s", oldClientID),
					PaidAt:         renewedOn,
					RecordedByID:   adminID,
				}
				if err := tx.Create(&pay).Error; err != nil {
					return fmt.Errorf("create payment: %w", err)
				}
			}

			return nil
		})

		if txErr != nil {
			log.Printf("row %d [%s]: FAILED: %v", i+1, fullName, txErr)
			failed++
		} else {
			log.Printf("row %d [%s]: imported (plan=%d, exp=%s)", i+1, fullName, pID, expiry.Format("2006-01-02"))
			created++
		}
	}

	fmt.Printf("\n──────────────────────────────────────\n")
	fmt.Printf("  Import complete\n")
	fmt.Printf("  Created : %d\n", created)
	fmt.Printf("  Skipped : %d (duplicates)\n", skipped)
	fmt.Printf("  Failed  : %d (see logs above)\n", failed)
	fmt.Printf("──────────────────────────────────────\n")
	fmt.Printf("\nDefault password for all imported members: Welcome@1234\n")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
