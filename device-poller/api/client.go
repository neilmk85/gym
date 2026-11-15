// StayFit API client for the device poller.
// Handles login, token refresh, check-in and check-out.
package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client is an authenticated StayFit API client.
type Client struct {
	baseURL    string
	httpClient *http.Client
	token      string
	email      string
	password   string
}

// New creates a new API client and logs in immediately.
func New(baseURL, email, password string) (*Client, error) {
	c := &Client{
		baseURL:    baseURL,
		email:      email,
		password:   password,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
	return c, c.login()
}

func (c *Client) login() error {
	body, _ := json.Marshal(map[string]string{
		"email":    c.email,
		"password": c.password,
	})
	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("login request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("login failed: status %d", resp.StatusCode)
	}

	var result struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("login decode: %w", err)
	}
	if result.AccessToken == "" {
		return fmt.Errorf("login: empty access_token in response")
	}
	c.token = result.AccessToken
	return nil
}

// CheckIn records a biometric check-in for the given member.
func (c *Client) CheckIn(memberID uint, facilityID uint, checkInAt time.Time, verifyType int) error {
	method := verifyMethodLabel(verifyType)
	body, _ := json.Marshal(map[string]interface{}{
		"member_id":   memberID,
		"facility_id": facilityID,
		"method":      "card", // closest existing method; "biometric" can be added later
		"notes":       fmt.Sprintf("biometric:%s device-auto at %s", method, checkInAt.Format("15:04")),
	})

	resp, err := c.doPost("/api/v1/attendance/check-in", body)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		// Token expired — re-login once and retry
		if err := c.login(); err != nil {
			return fmt.Errorf("re-login: %w", err)
		}
		resp, err = c.doPost("/api/v1/attendance/check-in", body)
		if err != nil {
			return err
		}
	}
	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("check-in failed: member_id=%d status=%d", memberID, resp.StatusCode)
	}
	return nil
}

// CheckOut records a biometric check-out for the given member.
func (c *Client) CheckOut(memberID uint) error {
	body, _ := json.Marshal(map[string]interface{}{
		"member_id": memberID,
		"notes":     "biometric device-auto",
	})

	resp, err := c.doPost("/api/v1/attendance/check-out", body)
	if err != nil {
		return err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		if err := c.login(); err != nil {
			return fmt.Errorf("re-login: %w", err)
		}
		resp, err = c.doPost("/api/v1/attendance/check-out", body)
		if err != nil {
			return err
		}
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("check-out failed: member_id=%d status=%d", memberID, resp.StatusCode)
	}
	return nil
}

func (c *Client) doPost(path string, body []byte) (*http.Response, error) {
	req, err := http.NewRequest("POST", c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	return c.httpClient.Do(req)
}

func verifyMethodLabel(v int) string {
	switch v {
	case 1:
		return "fingerprint"
	case 2:
		return "face"
	case 4:
		return "card"
	default:
		return "unknown"
	}
}
