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
	cfg              Config
	loc              *time.Location
	mu               sync.Mutex
	state            State
	apiTok           string
	apiOnce          sync.Once
	lastCmdSent      = map[string]time.Time{} // SN → last time we sent a DATA QUERY command
	lastUserInfoSent = map[string]time.Time{} // SN → last time we sent a USERINFO QUERY command
	deviceUserNames  = map[string]string{}    // device_user_id → name (populated from USERINFO)
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
	mux.HandleFunc("/iclock/devicecmd.aspx", handleDeviceCmd)
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
		// Device is initialising — send configuration with last-known stamp.
		// Include current IST time so the device clock is corrected on every connect.
		stamp := getStamp(sn)
		now := time.Now().In(loc) // loc = Asia/Kolkata
		resp := fmt.Sprintf(
			"GET OPTION FROM: %s\r\nATTLOGStamp=%s\r\nOPERLOGStamp=9999999999\r\nATTPHOTOStamp=None\r\n"+
				"ErrorDelay=30\r\nDelay=10\r\nTransTimes=00:00;23:59\r\nTransInterval=1\r\n"+
				"TransFlag=TransData AttLog\r\nTimeZone=5.5\r\nRealtime=1\r\nEncrypt=None\r\n"+
				"DateTime=%s\r\n",
			sn, stamp, now.Format("2006-01-02 15:04:05"),
		)
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, resp)
		log.Printf("[%s] INIT sn=%s stamp=%s datetime=%s", sn, sn, stamp, now.Format("15:04:05"))
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

// handleDeviceCmd: device posts data here in response to C:DATA:QUERY commands.
// Body starts with the table name ("ATTLOG" or "USERINFO") then records.
func handleDeviceCmd(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	sn := r.URL.Query().Get("SN")
	content := string(body)
	log.Printf("[%s] devicecmd %d bytes: %q", sn, len(body), content)

	lines := strings.Split(strings.TrimSpace(content), "\n")
	if len(lines) == 0 {
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "OK")
		return
	}

	// First non-empty line is the table header
	tableHeader := ""
	var dataLines []string
	for _, l := range lines {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		if tableHeader == "" {
			tableHeader = l
			continue
		}
		dataLines = append(dataLines, l)
	}

	switch tableHeader {
	case "ATTLOG":
		if len(dataLines) > 0 {
			processAttLog(sn, "", strings.Join(dataLines, "\n"), w)
		} else {
			w.Header().Set("Content-Type", "text/plain")
			fmt.Fprint(w, "OK")
		}
	case "USERINFO":
		processUserInfo(sn, dataLines)
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "OK")
	case "ENROLL_FP":
		// Device reports enrollment result.
		// Format: PIN=50001\tFP=0\tFlag=1  (Flag=1 = success, Flag=0 = failure)
		for _, l := range dataLines {
			parts := strings.Fields(l)
			pinVal, flagVal := "", ""
			for _, p := range parts {
				if strings.HasPrefix(p, "PIN=") {
					pinVal = strings.TrimPrefix(p, "PIN=")
				}
				if strings.HasPrefix(p, "Flag=") {
					flagVal = strings.TrimPrefix(p, "Flag=")
				}
			}
			if pinVal != "" {
				success := flagVal == "1"
				log.Printf("[%s] ENROLL_FP result PIN=%s Flag=%s success=%v", sn, pinVal, flagVal, success)
				go notifyEnrollComplete(pinVal, success)
			}
		}
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "OK")
	default:
		w.Header().Set("Content-Type", "text/plain")
		fmt.Fprint(w, "OK")
	}
}

// processUserInfo parses USERINFO records and caches device_user_id → name.
// Format: UserID\tName\tPassword\tCard\tRole\t...
func processUserInfo(sn string, lines []string) {
	mu.Lock()
	defer mu.Unlock()
	count := 0
	for _, l := range lines {
		fields := strings.Split(l, "\t")
		if len(fields) < 2 {
			continue
		}
		userID := strings.TrimSpace(fields[0])
		name := strings.TrimSpace(fields[1])
		if userID != "" && name != "" {
			deviceUserNames[userID] = name
			count++
		}
	}
	if count > 0 {
		log.Printf("[%s] USERINFO cached %d user names", sn, count)
	}
}

// handleGetRequest: device polls for commands every ~10s.
// We alternate between ATTLOG and USERINFO queries once per minute each
// so we always have fresh user names for auto-creating StayFit members.
func pingHeartbeat() {
	go func() {
		req, err := http.NewRequest("POST", cfg.APIURL+"/api/v1/biometric/device-heartbeat", nil)
		if err != nil {
			return
		}
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}

func handleGetRequest(w http.ResponseWriter, r *http.Request) {
	sn := r.URL.Query().Get("SN")
	w.Header().Set("Content-Type", "text/plain")

	// Record that the device is alive.
	pingHeartbeat()

	// Priority 1: delete a user from the device (two-phase).
	if del := getDeleteRequested(); del != nil {
		if del.Phase == 1 {
			// Phase 1: wipe all fingerprint templates for this user
			// FINGERTMP uses key=value format (not Tab-delimited like USERINFO)
			log.Printf("[%s] DELETE fingerprint templates PIN=%s (phase 1)", sn, del.DeviceUserID)
			fmt.Fprintf(w, "C:DATA DEL FINGERTMP\tPin=%s\r\n", del.DeviceUserID)
		} else {
			// Phase 2: wipe the user record
			log.Printf("[%s] DELETE user record PIN=%s (phase 2)", sn, del.DeviceUserID)
			fmt.Fprintf(w, "C:DATA DEL USERINFO\tTab\t%s\t\r\n", del.DeviceUserID)
		}
		return
	}

	// Priority 1b: sync a user name on the device.
	if sync := getSyncDeviceUserRequested(); sync != nil {
		log.Printf("[%s] SYNC user PIN=%s name=%q on device", sn, sync.DeviceUserID, sync.Name)
		fmt.Fprintf(w, "C:DATA UPD USERINFO\tTab\t%s\t%s\t\t\t0\t\r\n", sync.DeviceUserID, sync.Name)
		return
	}

	// Priority 2: enrollment — two phases:
	//   1. create_user: push user record so device has the slot
	//   2. enroll_fp:   trigger fingerprint capture
	if enroll := getEnrollRequested(); enroll != nil {
		switch enroll.Phase {
		case "create_user":
			name := enroll.SubjectName
			if name == "" {
				name = "Member"
			}
			log.Printf("[%s] ENROLL phase1 create user PIN=%s name=%q", sn, enroll.DeviceUserID, name)
			// C:DATA UPD USERINFO Tab\tPIN\tName\tPassword\tCard\tRole\t
			fmt.Fprintf(w, "C:DATA UPD USERINFO\tTab\t%s\t%s\t\t\t0\t\r\n", enroll.DeviceUserID, name)
		case "enroll_fp":
			log.Printf("[%s] ENROLL phase2 ENROLL_FP PIN=%s FP=0", sn, enroll.DeviceUserID)
			fmt.Fprintf(w, "C:ENROLL_FP:PIN=%s&FP=0&OPTIONS=0\r\n", enroll.DeviceUserID)
		}
		return
	}

	mu.Lock()
	attlogDue := time.Since(lastCmdSent[sn]) > 55*time.Second
	userinfoDue := time.Since(lastUserInfoSent[sn]) > 5*time.Minute
	if attlogDue {
		lastCmdSent[sn] = time.Now()
	}
	if userinfoDue {
		lastUserInfoSent[sn] = time.Now()
	}
	mu.Unlock()

	// Check if the frontend requested an immediate scan (link-device modal open).
	if !attlogDue && isScanRequested() {
		mu.Lock()
		lastCmdSent[sn] = time.Now()
		mu.Unlock()
		fmt.Fprint(w, "C:DATA:QUERY ATTLOG\r\n")
		return
	}

	if userinfoDue {
		fmt.Fprint(w, "C:DATA:QUERY USERINFO\r\n")
		return
	}
	if attlogDue {
		fmt.Fprint(w, "C:DATA:QUERY ATTLOG\r\n")
		return
	}
	fmt.Fprint(w, "OK")
}

func isScanRequested() bool {
	resp, err := http.Get(cfg.APIURL + "/api/v1/biometric/scan-requested")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var body struct {
		Requested bool `json:"requested"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return false
	}
	return body.Requested
}

type enrollCommand struct {
	Phase        string `json:"phase"`          // "create_user" | "enroll_fp"
	DeviceUserID string `json:"device_user_id"`
	SubjectName  string `json:"subject_name"`
	Finger       int    `json:"finger"`
}

func getEnrollRequested() *enrollCommand {
	resp, err := http.Get(cfg.APIURL + "/api/v1/biometric/enroll-requested")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var body struct {
		Requested    bool   `json:"requested"`
		Phase        string `json:"phase"`
		DeviceUserID string `json:"device_user_id"`
		SubjectName  string `json:"subject_name"`
		Finger       int    `json:"finger"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil
	}
	if !body.Requested {
		return nil
	}
	return &enrollCommand{
		Phase:        body.Phase,
		DeviceUserID: body.DeviceUserID,
		SubjectName:  body.SubjectName,
		Finger:       body.Finger,
	}
}

type syncCommand struct {
	DeviceUserID string
	Name         string
}

func getSyncDeviceUserRequested() *syncCommand {
	resp, err := http.Get(cfg.APIURL + "/api/v1/biometric/sync-device-user-requested")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var body struct {
		Requested    bool   `json:"requested"`
		DeviceUserID string `json:"device_user_id"`
		Name         string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || !body.Requested {
		return nil
	}
	return &syncCommand{DeviceUserID: body.DeviceUserID, Name: body.Name}
}

type deleteCommand struct {
	DeviceUserID string
	Phase        int // 1=delete fingerprint templates, 2=delete user record
}

func getDeleteRequested() *deleteCommand {
	resp, err := http.Get(cfg.APIURL + "/api/v1/biometric/delete-requested")
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	var body struct {
		Requested    bool   `json:"requested"`
		DeviceUserID string `json:"device_user_id"`
		Phase        int    `json:"phase"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || !body.Requested {
		return nil
	}
	return &deleteCommand{DeviceUserID: body.DeviceUserID, Phase: body.Phase}
}

func notifyEnrollComplete(deviceUserID string, success bool) {
	body, _ := json.Marshal(map[string]interface{}{
		"device_user_id": deviceUserID,
		"success":        success,
	})
	req, err := http.NewRequest("POST", cfg.APIURL+"/api/v1/biometric/enroll-complete", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[enroll-complete] error: %v", err)
		return
	}
	resp.Body.Close()
	log.Printf("[enroll-complete] notified deviceUserID=%s success=%v", deviceUserID, success)
}

// ─── ATTLOG processing ────────────────────────────────────────────────────────

func processAttLog(sn, stamp, body string, w http.ResponseWriter) {
	mapping := loadMapping()
	trainerMapping := loadTrainerMapping()
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

		// Notify backend of this scan for scan-to-link auto-detect.
		mu.Lock()
		scanName := deviceUserNames[userID]
		mu.Unlock()
		go notifyScan(userID, scanName)

		// Check if this device user is a trainer — record punch and skip member flow.
		if trainerID, isTrainer := trainerMapping[userID]; isTrainer {
			go apiRecordTrainerPunch(trainerID, ts)
			markSeen(dedupKey)
			lastStamp = tsStr
			ok++
			log.Printf("[%s] TRAINER-PUNCH trainer_id=%d device_user=%s at %s", sn, trainerID, userID, tsStr)
			continue
		}

		// Map device user ID → StayFit member ID
		memberID, found := mapping[userID]
		if !found {
			mu.Lock()
			name := deviceUserNames[userID]
			mu.Unlock()
			log.Printf("[%s] UNMAPPED device_user=%s name=%q — skipping (enroll and map this person in StayFit first)", sn, userID, name)
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

func notifyScan(deviceUserID, name string) {
	body, _ := json.Marshal(map[string]string{
		"device_user_id": deviceUserID,
		"name":           name,
	})
	req, err := http.NewRequest("POST", cfg.APIURL+"/api/v1/biometric/notify-scan", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[notify-scan] error: %v", err)
		return
	}
	resp.Body.Close()
}

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
		"notes":       fmt.Sprintf("biometric auto %s", time.Now().In(loc).Format("15:04")),
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

// loadMapping fetches device_user_id → member_id mappings from StayFit API.
// Falls back to local mapping.json if the API is unavailable.
func loadMapping() Mapping {
	if err := ensureToken(); err == nil {
		req, _ := http.NewRequest("GET", cfg.APIURL+"/api/v1/members/device-mappings", nil)
		req.Header.Set("Authorization", "Bearer "+apiTok)
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode == http.StatusOK {
			defer resp.Body.Close()
			var envelope struct {
				Data Mapping `json:"data"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&envelope); err == nil && len(envelope.Data) > 0 {
				log.Printf("loadMapping: fetched %d entries from API", len(envelope.Data))
				return envelope.Data
			}
		}
		if resp != nil {
			resp.Body.Close()
		}
	}
	// Fallback: local mapping.json
	f, err := os.Open(cfg.MappingFile)
	if err != nil {
		return Mapping{}
	}
	defer f.Close()
	var m Mapping
	_ = json.NewDecoder(f).Decode(&m)
	return m
}

// loadTrainerMapping fetches device_user_id → trainer_id from StayFit API.
// Returns empty map if unavailable; no local fallback needed.
func loadTrainerMapping() map[string]uint {
	resp, err := http.Get(cfg.APIURL + "/api/v1/trainers/device-mappings")
	if err != nil {
		return map[string]uint{}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return map[string]uint{}
	}
	var envelope struct {
		Data map[string]uint `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return map[string]uint{}
	}
	if len(envelope.Data) > 0 {
		log.Printf("loadTrainerMapping: fetched %d entries from API", len(envelope.Data))
	}
	return envelope.Data
}

func apiRecordTrainerPunch(trainerID uint, ts time.Time) {
	body, _ := json.Marshal(map[string]interface{}{
		"trainer_id":         trainerID,
		"punched_at":         ts.Format(time.RFC3339),
		"server_received_at": time.Now().UTC().Format(time.RFC3339),
	})
	req, err := http.NewRequest("POST", cfg.APIURL+"/api/v1/trainer-punches", bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[trainer-punch] error: %v", err)
		return
	}
	resp.Body.Close()
}

func saveMapping(m Mapping) error {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(cfg.MappingFile, data, 0644)
}

// apiCreateMember creates a new StayFit member for an unmapped device user.
// Uses the name from USERINFO (or a placeholder if unknown), generates
// placeholder email/phone since the device doesn't store them.
func apiCreateMember(deviceUserID, name string) (uint, error) {
	if err := ensureToken(); err != nil {
		return 0, err
	}

	firstName := name
	lastName := "."
	if name == "" {
		firstName = "Device"
		lastName = "User" + deviceUserID
	} else if parts := strings.SplitN(name, " ", 2); len(parts) == 2 {
		firstName = parts[0]
		lastName = parts[1]
	}

	body, _ := json.Marshal(map[string]interface{}{
		"first_name":  firstName,
		"last_name":   lastName,
		"email":       fmt.Sprintf("device.%s@gym.local", deviceUserID),
		"phone":       "0000000000",
		"facility_id": cfg.FacilityID,
	})

	resp, err := apiPost("/api/v1/members", body)
	if err != nil {
		return 0, fmt.Errorf("create member: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		apiOnce = sync.Once{}
		if err := ensureToken(); err != nil {
			return 0, err
		}
		resp, err = apiPost("/api/v1/members", body)
		if err != nil {
			return 0, err
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return 0, fmt.Errorf("create member status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		ID   uint `json:"id"`
		Data struct {
			ID uint `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("decode create member response: %w", err)
	}
	id := result.ID
	if id == 0 {
		id = result.Data.ID
	}
	if id == 0 {
		return 0, fmt.Errorf("create member: no ID in response")
	}
	return id, nil
}
