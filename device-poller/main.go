// device-poller: pulls attendance records from the eSSL X 2008 biometric
// device (ZMM220 platform, ZKTeco binary protocol) and pushes them to the
// StayFit API as check-in / check-out events.
//
// Run on any machine on the gym's local network (192.168.1.x).
// Configure via config.json. Map device user IDs to member IDs in mapping.json.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"time"

	"device-poller/api"
	"device-poller/zk"
)

// ─── config types ─────────────────────────────────────────────────────────────

type Config struct {
	DeviceAddr   string `json:"device_addr"`    // e.g. "192.168.1.53:4370"
	APIURL       string `json:"api_url"`        // e.g. "https://stayfit.tvaksa.com"
	AdminEmail   string `json:"admin_email"`
	AdminPass    string `json:"admin_password"`
	FacilityID   uint   `json:"facility_id"`
	PollSecs     int    `json:"poll_interval_secs"` // default 120
	MappingFile  string `json:"mapping_file"`       // path to mapping.json
	StateFile    string `json:"state_file"`         // path to state.json
}

// Mapping maps device user IDs (string) to StayFit member IDs (uint).
type Mapping map[string]uint

type State struct {
	LastSyncAt time.Time `json:"last_sync_at"`
}

// ─── main ─────────────────────────────────────────────────────────────────────

func main() {
	cfgPath := "config.json"
	if len(os.Args) > 1 {
		cfgPath = os.Args[1]
	}

	cfg, err := loadConfig(cfgPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	log.Printf("device-poller starting | device=%s api=%s facility=%d poll=%ds",
		cfg.DeviceAddr, cfg.APIURL, cfg.FacilityID, cfg.PollSecs)

	for {
		if err := poll(cfg); err != nil {
			log.Printf("poll error: %v", err)
		}
		time.Sleep(time.Duration(cfg.PollSecs) * time.Second)
	}
}

// ─── poll cycle ───────────────────────────────────────────────────────────────

func poll(cfg *Config) error {
	mapping, err := loadMapping(cfg.MappingFile)
	if err != nil {
		return fmt.Errorf("load mapping: %w", err)
	}
	if len(mapping) == 0 {
		log.Printf("WARNING: mapping file is empty; no records will be posted")
	}

	state, err := loadState(cfg.StateFile)
	if err != nil {
		log.Printf("WARNING: could not load state file (%v); processing ALL records", err)
		state = &State{LastSyncAt: time.Time{}}
	}

	log.Printf("connecting to device %s", cfg.DeviceAddr)
	client, err := zk.Connect(cfg.DeviceAddr, 0)
	if err != nil {
		return fmt.Errorf("connect device: %w", err)
	}
	defer client.Close()

	records, err := client.GetAttendance()
	if err != nil {
		return fmt.Errorf("get attendance: %w", err)
	}

	log.Printf("fetched %d records from device", len(records))

	// Keep only records newer than last sync
	var newRecords []zk.AttRecord
	for _, r := range records {
		if r.Timestamp.After(state.LastSyncAt) {
			newRecords = append(newRecords, r)
		}
	}

	if len(newRecords) == 0 {
		log.Printf("no new records since %s", state.LastSyncAt.Format(time.RFC3339))
		return nil
	}

	// Sort ascending so we process check-ins before check-outs
	sort.Slice(newRecords, func(i, j int) bool {
		return newRecords[i].Timestamp.Before(newRecords[j].Timestamp)
	})

	log.Printf("processing %d new records", len(newRecords))

	apiClient, err := api.New(cfg.APIURL, cfg.AdminEmail, cfg.AdminPass)
	if err != nil {
		return fmt.Errorf("API login: %w", err)
	}

	var lastProcessed time.Time
	ok, skipped := 0, 0

	for _, r := range newRecords {
		memberID, found := mapping[r.UserID]
		if !found {
			log.Printf("skip: device user_id=%q not in mapping (verify=%d ts=%s)",
				r.UserID, r.VerifyType, r.Timestamp.Format("2006-01-02 15:04:05"))
			skipped++
			continue
		}

		var postErr error
		switch r.Status {
		case zk.StatusCheckIn:
			postErr = apiClient.CheckIn(memberID, cfg.FacilityID, r.Timestamp, r.VerifyType)
		case zk.StatusCheckOut:
			postErr = apiClient.CheckOut(memberID)
		default:
			log.Printf("skip: unknown status=%d member_id=%d ts=%s", r.Status, memberID, r.Timestamp.Format("15:04:05"))
			skipped++
			continue
		}

		if postErr != nil {
			log.Printf("API error: member_id=%d ts=%s: %v", memberID, r.Timestamp.Format("15:04:05"), postErr)
			// Don't advance lastProcessed for failed records so they retry next cycle
			continue
		}

		action := "check-in"
		if r.Status == zk.StatusCheckOut {
			action = "check-out"
		}
		log.Printf("OK: member_id=%d %s at %s (device_user=%s)",
			memberID, action, r.Timestamp.Format("15:04:05"), r.UserID)
		ok++

		if r.Timestamp.After(lastProcessed) {
			lastProcessed = r.Timestamp
		}
	}

	log.Printf("done: %d posted, %d skipped", ok, skipped)

	// Advance state to 1 second after the last successfully processed record
	if !lastProcessed.IsZero() {
		state.LastSyncAt = lastProcessed.Add(time.Second)
		if err := saveState(cfg.StateFile, state); err != nil {
			log.Printf("WARNING: could not save state: %v", err)
		}
	}

	return nil
}

// ─── config / state / mapping ─────────────────────────────────────────────────

func loadConfig(path string) (*Config, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var cfg Config
	if err := json.NewDecoder(f).Decode(&cfg); err != nil {
		return nil, err
	}

	// Defaults
	if cfg.DeviceAddr == "" {
		cfg.DeviceAddr = "192.168.1.53:4370"
	}
	if cfg.PollSecs <= 0 {
		cfg.PollSecs = 120
	}
	if cfg.MappingFile == "" {
		cfg.MappingFile = filepath.Join(filepath.Dir(path), "mapping.json")
	}
	if cfg.StateFile == "" {
		cfg.StateFile = filepath.Join(filepath.Dir(path), "state.json")
	}

	if cfg.APIURL == "" || cfg.AdminEmail == "" || cfg.AdminPass == "" {
		return nil, fmt.Errorf("api_url, admin_email and admin_password are required")
	}

	return &cfg, nil
}

func loadMapping(path string) (Mapping, error) {
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return Mapping{}, nil
		}
		return nil, err
	}
	defer f.Close()

	var m Mapping
	return m, json.NewDecoder(f).Decode(&m)
}

func loadState(path string) (*State, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var s State
	return &s, json.NewDecoder(f).Decode(&s)
}

func saveState(path string, s *State) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
