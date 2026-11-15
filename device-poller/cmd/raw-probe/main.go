// raw-probe: connects to the ZKTeco device and reads whatever it sends first,
// then tries sending a minimal packet and reading the reply.
// Use this to figure out what the device actually expects.
package main

import (
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"time"
)

func main() {
	addr := "192.168.1.53:4370"
	if len(os.Args) > 1 {
		addr = os.Args[1]
	}

	// Try UDP first (pyzk default)
	fmt.Printf("Trying UDP to %s...\n", addr)
	udpAddr, _ := net.ResolveUDPAddr("udp", addr)
	udpConn, err := net.DialUDP("udp", nil, udpAddr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "udp dial error: %v\n", err)
	} else {
		defer udpConn.Close()
		inner := []byte{0xE8, 0x03, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF}
		var s uint16
		for i := 0; i+1 < len(inner); i += 2 {
			s += uint16(inner[i]) | uint16(inner[i+1])<<8
		}
		s = ^s
		upkt := append([]byte{0x50, 0x50, byte(s), byte(s >> 8)}, inner...)
		fmt.Printf("Sending UDP CMD_CONNECT:\n%s", hex.Dump(upkt))
		udpConn.SetDeadline(time.Now().Add(3 * time.Second))
		udpConn.Write(upkt)
		ubuf := make([]byte, 256)
		n, err := udpConn.Read(ubuf)
		if n > 0 {
			fmt.Printf("UDP Reply (%d bytes):\n%s\n", n, hex.Dump(ubuf[:n]))
		} else {
			fmt.Printf("No UDP reply: %v\n", err)
		}
	}

	fmt.Printf("\nConnecting TCP to %s...\n", addr)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		fmt.Fprintf(os.Stderr, "tcp dial error: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close()
	fmt.Println("TCP connected OK")

	// Step 1: read with short timeout to see if device sends a greeting
	conn.SetDeadline(time.Now().Add(2 * time.Second))
	buf := make([]byte, 256)
	n, err := conn.Read(buf)
	if n > 0 {
		fmt.Printf("Device sent greeting (%d bytes):\n%s\n", n, hex.Dump(buf[:n]))
	} else if err != nil {
		fmt.Printf("No greeting received (timeout/error): %v\n", err)
	}

	// Step 2: CMD_CONNECT (12 bytes)
	// Format: magic(2) + chksum(2) + cmd(2) + 0x0000(2) + session_id(2) + reply_id(2)
	// Checksum over bytes [4..11]: cmd(2) + 0x0000(2) + session(2) + reply(2)
	inner := []byte{
		0xE8, 0x03, // CMD_CONNECT = 1000 LE
		0x00, 0x00, // reserved zeros
		0x00, 0x00, // session_id = 0
		0xFF, 0xFF, // reply_id = 0xFFFF
	}
	var sum uint16
	for i := 0; i+1 < len(inner); i += 2 {
		sum += uint16(inner[i]) | uint16(inner[i+1])<<8
	}
	sum = ^sum

	pkt := make([]byte, 4+len(inner))
	pkt[0], pkt[1] = 0x50, 0x50
	pkt[2] = byte(sum)
	pkt[3] = byte(sum >> 8)
	copy(pkt[4:], inner)

	fmt.Printf("\nSending CMD_CONNECT (%d bytes):\n%s\n", len(pkt), hex.Dump(pkt))
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	if _, err := conn.Write(pkt); err != nil {
		fmt.Fprintf(os.Stderr, "write error: %v\n", err)
		os.Exit(1)
	}

	// Wait briefly for the device to process and reply
	time.Sleep(500 * time.Millisecond)

	// Step 3: read reply (try multiple reads)
	conn.SetDeadline(time.Now().Add(5 * time.Second))
	total := 0
	for {
		n, err = conn.Read(buf[total:])
		total += n
		if err != nil {
			break
		}
		if total >= cap(buf) {
			break
		}
	}
	if total > 0 {
		fmt.Printf("Reply (%d bytes):\n%s\n", total, hex.Dump(buf[:total]))
	} else {
		fmt.Printf("No reply received. Error: %v\n", err)
	}
}
