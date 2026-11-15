// adms-server: production eSSL ADMS HTTP server.
//
// The eSSL X 2008 device (ZMM220) connects to this server and POSTs
// attendance records. This server:
//   - Handles the full ADMS handshake (cdata.aspx + getrequest.aspx)
//   - Parses ATTLOG records (tab-separated: userID, timestamp, status, verify)
//   - Maps device user IDs to StayFit member IDs via mapping.json
//   - Posts check-in / check-out to the StayFit API
//   - Tracks per-device stamps so the device only sends new records
//
// Config: config.json  (see Config struct)
// Mapping: mapping.json  { "10018": 101, "10019": 102, ... }
// State: state.json  (auto-managed, tracks last-seen stamps)
//
// Deploy on VPS: build linux/amd64 binary, run as systemd service.
// Point device to: stayfit.tvaksa.com:5077
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ─── config ───────────────────────────────────────────────────────────────────

type Config struct {
	Port         string `json:"port"`          // e.g. "5077"
	APIURL       string `json:"api_url"`       // e.g. "https://stayfit.tvaksa.com"
	AdminEmail   string `json:"admin_email"`
	AdminPass    string `json:"admin_password"`
	FacilityID   uint   `json:"facility_id"`
	MappingFile  string `json:"mapping_file"`
	StateFile    string `json:"state_file"`
	TimeZone     string `json:"timezone"` // e.g. "Asia/Kolkata"
}

type Mapping map[string]uint // device_user_id → member_id

type State struct {
	Stamps  map[string]string `json:"stamps"`  // SN → last ATTLOG stamp
	Seen    map[string]bool   `json:"seen"`    // "SN:userID:timestamp" dedup keys
}

// ─── globals ──────────────────────────────────────────────────────────────────

var (
	cfg     Config
	loc     *time.Location
	mu      sync.Mutex
	state   State
	apiTok  string
	apiOnce sync.Once
)

func main() {
	cfgPath := "config.json"
	if len(os.Args) > 1 {
		cfgPath = os.Args[1]
	}
	if err := loadConfig(cfgPath); err != nil {
		log.Fatalf("config: %v", err)
	}

	var err error
	loc, err = time.LoadLocation(cfg.TimeZone)
	if err != nil {
		log.Printf("WARNING: unknown timezone %q, using UTC", cfg.TimeZone)
		loc = time.UTC
	}

	loadState()

	mux := http.NewServeMux()
	mux.HandleFunc("/iclock/cdata.aspx", handleCdata)
	mux.HandleFunc("/iclock/getrequest.aspx", handleGetRequest)
	mux.HandleFunc("/iclock/ping", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprint(w, "OK")
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("UNKNOWN: %s %s from %s", r.Method, r.URL.String(), r.RemoteAddr)
		fmt.Fprint(w, "OK")
	})

	log.Printf("ADMS server on :%s | api=%s facility=%d", cfg.Port, cfg.APIURL, cfg.FacilityID)
	log.Fatal(http.ListenAndServe(":"+cfg.Port, mux))
}

// ─── ADMS handlers ────────────────────────────────────────────────────────────

// handleCdata handles both GET (init handshake) and POST (data push) on /iclock/cdata.aspx
func handleCdata(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	sn := r.URL.Query().Get("SN")
	table := r.URL.Query().Get("table")

	if r.Method == http.MethodGet {
		// Device is initialising — send configuration with last-known stamp
		stamp := getStamp(sn)
		resp := fmt.Sprintf(
			"GET OPTION FROM: %s\r\nATTLOGStamp=%s\r\nOPERLOGStamp=9999999999\r\nATTPHOTOStamp=None\r\n"+
				"ErrorDelay=30\r\nDelay=10\r\nTransTimes=00:00;23:59\r\nTransInterval=1\r\n"+
				"TransFlag=TransData AttLog\r\nTimeZone=5.5\r\nRealtime=1\r\nEncrypt=None\r\n",
			sn, stamp,
		)
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, resp)
		log.Printf("[%s] INIT sn=%s stamp=%s", sn, sn, stamp)
		return
	}

	if r.Method == http.MethodPost {
		switch table {
		case "ATTLOG":
			processAttLog(sn, r.URL.Query().Get("Stamp"), string(body), w)
		case "options":
			log.Printf("[%s] device-info received (%d bytes)", sn, len(body))
			w.Header().Set("Content-Type", "text/plain")
			fmt.Fprintf(w, "OK: 0 PushVersion=2.4.1\r\n")
		default:
			log.Printf("[%s] POST table=%q (%d bytes)", sn, table, len(body))
			fmt.Fprint(w, "OK")
		}
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// handleGetRequest: device polls for server commands; we reply empty (no commands)
func handleGetRequest(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprint(w, "OK")
}

// ─── ATTLOG processing ────────────────────────────────────────────────────────

func processAttLog(sn, stamp, body string, w http.ResponseWriter) {
	mapping := loadMapping()
	lines := strings.Split(strings.TrimSpace(body), "\n")

	ok, skipped, dups, unknown := 0, 0, 0, 0
	var lastStamp string

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.Split(line, "\t")
		if len(fields) < 3 {
			continue
		}

		userID := strings.TrimSpace(fields[0])
		tsStr := strings.TrimSpace(fields[1])
		statusStr := strings.TrimSpace(fields[2])

		// Parse timestamp
		ts, err := time.ParseInLocation("2006-01-02 15:04:05", tsStr, loc)
		if err != nil {
			log.Printf("[%s] bad timestamp %q: %v", sn, tsStr, err)
			continue
		}

		status, _ := strconv.Atoi(statusStr)

		// Deduplicate
		dedupKey := fmt.Sprintf("%s:%s:%s", sn, userID, tsStr)
		if isSeen(dedupKey) {
			dups++
			continue
		}

		// Map device user ID → StayFit member ID
		memberID, found := mapping[userID]
		if !found {
			log.Printf("[%s] UNMAPPED device_user=%s ts=%s — add to mapping.json", sn, userID, tsStr)
			unknown++
			continue
		}

		// Call StayFit API
		var apiErr error
		switch status {
		case 0: // check-in
			apiErr = apiCheckIn(memberID, ts)
		case 1: // check-out
			apiErr = apiCheckOut(memberID)
		default:
			skipped++
			continue
		}

		if apiErr != nil {
			log.Printf("[%s] API error member_id=%d %s: %v", sn, memberID, tsStr, apiErr)
			skipped++
			continue
		}

		action := "CHECK-IN"
		if status == 1 {
			action = "CHECK-OUT"
		}
		log.Printf("[%s] OK %s member_id=%d device_user=%s at %s", sn, action, memberID, userID, tsStr)
		markSeen(dedupKey)
		ok++
		lastStamp = tsStr
	}

	log.Printf("[%s] ATTLOG processed: %d ok, %d skipped, %d dups, %d unmapped", sn, ok, skipped, dups, unknown)

	if lastStamp != "" {
		setStamp(sn, lastStamp)
	}

	w.Header().Set("Content-Type", "text/plain")
	fmt.Fprintf(w, "OK: %d\r\n", len(lines))
}

// ─── StayFit API ──────────────────────────────────────────────────────────────

func ensureToken() error {
	var loginErr error
	apiOnce.Do(func() {
		loginErr = doLogin()
	})
	return loginErr
}

func doLogin() error {
	body, _ := json.Marshal(map[string]string{
		"email":    cfg.AdminEmail,
		"password": cfg.AdminPass,
	})
	resp, err := http.Post(cfg.APIURL+"/api/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("login: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login status %d", resp.StatusCode)
	}
	var result struct {
		AccessToken string `json:"access_token"`
		Data        struct {
			Tokens struct {
				AccessToken string `json:"access_token"`
			} `json:"tokens"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	tok := result.AccessToken
	if tok == "" {
		tok = result.Data.Tokens.AccessToken
	}
	if tok == "" {
		return fmt.Errorf("empty token")
	}
	apiTok = tok
	log.Printf("API: logged in OK")
	return nil
}

func apiCheckIn(memberID uint, ts time.Time) error {
	if err := ensureToken(); err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]interface{}{
		"member_id":   memberID,
		"facility_id": cfg.FacilityID,
		"method":      "card",
		"notes":       fmt.Sprintf("biometric auto %s", ts.Format("15:04")),
	})
	resp, err := apiPost("/api/v1/attendance/check-in", body)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		// Token expired — re-login once
		apiOnce = sync.Once{}
		if err := ensureToken(); err != nil {
			return err
		}
		resp, err = apiPost("/api/v1/attendance/check-in", body)
		if err != nil {
			return err
		}
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("check-in status %d", resp.StatusCode)
	}
	return nil
}

func apiCheckOut(memberID uint) error {
	if err := ensureToken(); err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]interface{}{
		"member_id": memberID,
		"notes":     "biometric auto",
	})
	resp, err := apiPost("/api/v1/attendance/check-out", body)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		apiOnce = sync.Once{}
		if err := ensureToken(); err != nil {
			return err
		}
		resp, err = apiPost("/api/v1/attendance/check-out", body)
		if err != nil {
			return err
		}
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("check-out status %d", resp.StatusCode)
	}
	return nil
}

func apiPost(path string, body []byte) (*http.Response, error) {
	req, _ := http.NewRequest("POST", cfg.APIURL+path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiTok)
	client := &http.Client{Timeout: 15 * time.Second}
	return client.Do(req)
}

// ─── state (stamps + dedup) ───────────────────────────────────────────────────

func loadState() {
	mu.Lock()
	defer mu.Unlock()
	state = State{Stamps: map[string]string{}, Seen: map[string]bool{}}
	f, err := os.Open(cfg.StateFile)
	if err != nil {
		return
	}
	defer f.Close()
	_ = json.NewDecoder(f).Decode(&state)
	if state.Stamps == nil {
		state.Stamps = map[string]string{}
	}
	if state.Seen == nil {
		state.Seen = map[string]bool{}
	}
}

func saveState() {
	data, _ := json.MarshalIndent(state, "", "  ")
	_ = os.WriteFile(cfg.StateFile, data, 0644)
}

func getStamp(sn string) string {
	mu.Lock()
	defer mu.Unlock()
	if s, ok := state.Stamps[sn]; ok {
		return s
	}
	return "None"
}

func setStamp(sn, stamp string) {
	mu.Lock()
	defer mu.Unlock()
	state.Stamps[sn] = stamp
	saveState()
}

func isSeen(key string) bool {
	mu.Lock()
	defer mu.Unlock()
	return state.Seen[key]
}

func markSeen(key string) {
	mu.Lock()
	defer mu.Unlock()
	state.Seen[key] = true
	saveState()
}

// ─── config / mapping ─────────────────────────────────────────────────────────

func loadConfig(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	if err := json.NewDecoder(f).Decode(&cfg); err != nil {
		return err
	}
	if cfg.Port == "" {
		cfg.Port = "5077"
	}
	if cfg.TimeZone == "" {
		cfg.TimeZone = "Asia/Kolkata"
	}
	if cfg.MappingFile == "" {
		cfg.MappingFile = filepath.Join(filepath.Dir(path), "mapping.json")
	}
	if cfg.StateFile == "" {
		cfg.StateFile = filepath.Join(filepath.Dir(path), "state.json")
	}
	return nil
}

func loadMapping() Mapping {
	f, err := os.Open(cfg.MappingFile)
	if err != nil {
		return Mapping{}
	}
	defer f.Close()
	var m Mapping
	_ = json.NewDecoder(f).Decode(&m)
	return m
}
