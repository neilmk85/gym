package services_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gym-backend/internal/services"
)

// ─── ParseDateRange ───────────────────────────────────────────────────────────

func TestParseDateRange_Defaults(t *testing.T) {
	now := time.Now()
	dr, err := services.ParseDateRange("", "")
	require.NoError(t, err)

	// From should be the first day of the current month at midnight.
	expectedFrom := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	assert.Equal(t, expectedFrom, dr.From)

	// To should be approximately now (within 1 second).
	assert.WithinDuration(t, now, dr.To, time.Second)
}

func TestParseDateRange_CustomFromTo(t *testing.T) {
	dr, err := services.ParseDateRange("2026-01-01", "2026-03-31")
	require.NoError(t, err)

	assert.Equal(t, 2026, dr.From.Year())
	assert.Equal(t, time.January, dr.From.Month())
	assert.Equal(t, 1, dr.From.Day())
	assert.Equal(t, 0, dr.From.Hour())

	assert.Equal(t, 2026, dr.To.Year())
	assert.Equal(t, time.March, dr.To.Month())
	assert.Equal(t, 31, dr.To.Day())
	// "to" date gets extended to end of day (23:59:59).
	assert.Equal(t, 23, dr.To.Hour())
	assert.Equal(t, 59, dr.To.Minute())
}

func TestParseDateRange_ToBeforeFrom(t *testing.T) {
	_, err := services.ParseDateRange("2026-04-01", "2026-03-01")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "from date must be before to date")
}

func TestParseDateRange_SameDay(t *testing.T) {
	// Same day: from=start-of-day, to=end-of-day — valid.
	dr, err := services.ParseDateRange("2026-04-12", "2026-04-12")
	require.NoError(t, err)
	assert.True(t, dr.From.Before(dr.To))
}

func TestParseDateRange_InvalidFromFormat(t *testing.T) {
	_, err := services.ParseDateRange("12-04-2026", "")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "from date")
}

func TestParseDateRange_InvalidToFormat(t *testing.T) {
	_, err := services.ParseDateRange("", "April 2026")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "to date")
}

func TestParseDateRange_OnlyFromProvided(t *testing.T) {
	now := time.Now()
	dr, err := services.ParseDateRange("2026-01-01", "")
	require.NoError(t, err)

	assert.Equal(t, time.January, dr.From.Month())
	assert.WithinDuration(t, now, dr.To, time.Second)
}

func TestParseDateRange_OnlyToProvided(t *testing.T) {
	now := time.Now()
	dr, err := services.ParseDateRange("", "2026-12-31")
	require.NoError(t, err)

	// From should still default to start of current month.
	expectedFrom := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	assert.Equal(t, expectedFrom, dr.From)
	assert.Equal(t, 31, dr.To.Day())
}
