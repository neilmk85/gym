// test-device: quick connectivity check — connects to the ZKTeco device
// and dumps attendance records to stdout. Run on the gym's local network.
//
//	go run ./cmd/test-device  192.168.1.53:4370
package main

import (
	"fmt"
	"os"

	"device-poller/zk"
)

func main() {
	addr := "192.168.1.53:4370"
	if len(os.Args) > 1 {
		addr = os.Args[1]
	}

	fmt.Printf("Connecting to %s...\n", addr)
	c, err := zk.Connect(addr, 0) // password 0 = factory default
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}
	defer c.Close()
	fmt.Println("Connected OK")

	fmt.Println("Fetching attendance records...")
	records, err := c.GetAttendance()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: %v\n", err)
		os.Exit(1)
	}

	if len(records) == 0 {
		fmt.Println("No records returned from device.")
		return
	}

	fmt.Printf("%-10s %-20s %-12s %-10s\n", "UserID", "Timestamp", "Status", "Verify")
	fmt.Println("--------------------------------------------------------------")
	for _, r := range records {
		status := "check-in"
		if r.Status == zk.StatusCheckOut {
			status = "check-out"
		}
		fmt.Printf("%-10s %-20s %-12s %d\n",
			r.UserID,
			r.Timestamp.Format("2006-01-02 15:04:05"),
			status,
			r.VerifyType,
		)
	}
	fmt.Printf("\nTotal: %d records\n", len(records))
}
