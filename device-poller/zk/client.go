// ZKTeco binary protocol client for eSSL X 2008 (ZMM220 platform)
// Connects over TCP port 4370 to the attendance device.
package zk

import (
	"encoding/binary"
	"fmt"
	"net"
	"time"
)

// Command codes
const (
	cmdConnect       = 1000
	cmdExit          = 1001
	cmdEnableDevice  = 1002
	cmdDisableDevice = 1003
	cmdAckOK         = 2000
	cmdAckError      = 2001
	cmdPrepareData   = 1500
	cmdData          = 1501
	cmdFreeData      = 1502
)

// Verify types from the device
const (
	VerifyFingerprint = 1
	VerifyFace        = 2
	VerifyCard        = 4
	VerifyPassword    = 10
)

// Status values in the attendance log
const (
	StatusCheckIn  = 0
	StatusCheckOut = 1
)

// pktMagic is the 2-byte prefix for every ZKTeco packet
const pktMagic = 0x5050

// ZKTeco packet layout (12 bytes before payload):
//   [0-1]  magic     0x5050
//   [2-3]  checksum  uint16 LE, over bytes [4..end]
//   [4-5]  command   uint16 LE
//   [6-7]  0x0000    reserved (checksum placeholder in inner buffer)
//   [8-9]  session_id uint16 LE
//  [10-11] reply_id   uint16 LE
//  [12..]  payload
const headerLen = 12

// initialReplyID matches pyzk convention (USHRT_MAX)
const initialReplyID = 0xFFFF

// AttRecord is a single attendance entry read from the device.
type AttRecord struct {
	UserID     string
	VerifyType int
	Timestamp  time.Time
	Status     int // StatusCheckIn or StatusCheckOut
}

// Client holds an open TCP connection to the device.
type Client struct {
	conn      net.Conn
	sessionID uint16
	replyID   uint16
	password  uint32
}

// Connect dials the device and completes the CMD_CONNECT handshake.
// addr should be "ip:port", e.g. "192.168.1.53:4370".
// password is the device password (default 0).
func Connect(addr string, password uint32) (*Client, error) {
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", addr, err)
	}

	c := &Client{conn: conn, replyID: initialReplyID, password: password}
	c.conn.SetDeadline(time.Now().Add(15 * time.Second))

	// CMD_CONNECT: send empty payload first; some firmware ignores the password field
	if err := c.sendCmd(cmdConnect, nil); err != nil {
		conn.Close()
		return nil, fmt.Errorf("send CMD_CONNECT: %w", err)
	}

	cmd, _, err := c.recv()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("recv CMD_CONNECT reply: %w", err)
	}
	if cmd != cmdAckOK {
		conn.Close()
		return nil, fmt.Errorf("CMD_CONNECT rejected (cmd=%d) — wrong password?", cmd)
	}

	return c, nil
}

// GetAttendance fetches all attendance records from the device.
// Returns them unsorted.
func (c *Client) GetAttendance() ([]AttRecord, error) {
	c.conn.SetDeadline(time.Now().Add(60 * time.Second))

	// Request the ATTLOG data table
	if err := c.sendCmd(cmdFreeData, nil); err != nil {
		return nil, fmt.Errorf("free data: %w", err)
	}
	cmd, _, err := c.recv()
	if err != nil {
		return nil, fmt.Errorf("free data reply: %w", err)
	}
	if cmd != cmdAckOK {
		return nil, fmt.Errorf("free data rejected (cmd=%d)", cmd)
	}

	// Send data read request for ATTLOG table
	if err := c.sendCmd(cmdPrepareData, []byte("ATTLOG\x00")); err != nil {
		return nil, fmt.Errorf("send ATTLOG request: %w", err)
	}

	// First reply: either ACK_OK with inline data, or PREPARE_DATA with size
	cmd, data, err := c.recv()
	if err != nil {
		return nil, fmt.Errorf("ATTLOG first reply: %w", err)
	}

	var raw []byte

	switch cmd {
	case cmdPrepareData:
		// Device is sending chunked data; first 4 bytes = total size
		if len(data) < 4 {
			return nil, fmt.Errorf("PREPARE_DATA: short size field (%d bytes)", len(data))
		}
		totalSize := int(binary.LittleEndian.Uint32(data[:4]))
		raw = make([]byte, 0, totalSize)

		// Accumulate CMD_DATA chunks
		for len(raw) < totalSize {
			c.conn.SetDeadline(time.Now().Add(30 * time.Second))
			cmd, chunk, err := c.recv()
			if err != nil {
				return nil, fmt.Errorf("read data chunk: %w", err)
			}
			if cmd == cmdFreeData {
				break // end of data transfer
			}
			if cmd != cmdData {
				return nil, fmt.Errorf("unexpected cmd %d during data transfer", cmd)
			}
			raw = append(raw, chunk...)
		}

	case cmdAckOK:
		// Small dataset came inline
		raw = data

	default:
		return nil, fmt.Errorf("unexpected initial reply cmd=%d", cmd)
	}

	return parseAttLog(raw), nil
}

// Close sends CMD_EXIT and closes the TCP connection.
func (c *Client) Close() error {
	c.conn.SetDeadline(time.Now().Add(5 * time.Second))
	_ = c.sendCmd(cmdExit, nil)
	return c.conn.Close()
}

// ─── packet I/O ──────────────────────────────────────────────────────────────

func (c *Client) sendCmd(cmd uint16, data []byte) error {
	pkt := buildPacket(cmd, c.sessionID, c.replyID, data)
	c.replyID++
	_, err := c.conn.Write(pkt)
	return err
}

// recv reads one full packet and returns (command, data, error).
// RECEIVE format differs from SEND format:
//   SEND:    magic(2) chksum(2) cmd(2) 0000(2) session(2) reply(2) data
//   RECEIVE: magic(2) chksum(2) session(2) reply(2) cmd(2) data
// Header = 10 bytes, cmd at offset 8.
func (c *Client) recv() (uint16, []byte, error) {
	hdr := make([]byte, 10) // 10-byte receive header
	if _, err := readFull(c.conn, hdr); err != nil {
		return 0, nil, fmt.Errorf("read header: %w", err)
	}

	if hdr[0] != 0x50 || hdr[1] != 0x50 {
		return 0, nil, fmt.Errorf("bad magic: %02x %02x", hdr[0], hdr[1])
	}

	// receive layout: magic(2) chksum(2) session(2) reply(2) cmd(2)
	c.sessionID = binary.LittleEndian.Uint16(hdr[4:6])
	cmd := binary.LittleEndian.Uint16(hdr[8:10])

	// Try to read remaining bytes; ZKTeco over TCP has no explicit length
	// field, so we read what's buffered within a short window.
	c.conn.SetDeadline(time.Now().Add(2 * time.Second))
	var payload []byte
	buf := make([]byte, 4096)
	for {
		n, err := c.conn.Read(buf)
		if n > 0 {
			payload = append(payload, buf[:n]...)
		}
		if err != nil {
			break // timeout or EOF — no more data for this packet
		}
		if n < len(buf) {
			break // got less than a full buffer; likely end of this response
		}
	}
	// Restore longer deadline for next operation
	c.conn.SetDeadline(time.Now().Add(30 * time.Second))

	return cmd, payload, nil
}

// ─── packet builder ───────────────────────────────────────────────────────────

func buildPacket(cmd, sessionID, replyID uint16, data []byte) []byte {
	// Inner body (gets checksummed): cmd(2) + 0x0000(2) + session(2) + reply(2) + data
	inner := make([]byte, 8+len(data))
	binary.LittleEndian.PutUint16(inner[0:], cmd)
	// inner[2:4] = 0x0000 reserved (zero by default)
	binary.LittleEndian.PutUint16(inner[4:], sessionID)
	binary.LittleEndian.PutUint16(inner[6:], replyID)
	if data != nil {
		copy(inner[8:], data)
	}

	chk := checksum(inner)

	// Full packet: magic(2) + chksum(2) + inner
	pkt := make([]byte, 4+len(inner))
	binary.LittleEndian.PutUint16(pkt[0:], pktMagic)
	binary.LittleEndian.PutUint16(pkt[2:], chk)
	copy(pkt[4:], inner)
	return pkt
}

// checksum matches pyzk's createChkSum: 16-bit sum with natural uint16 overflow, then bitwise NOT.
// Using uint32 carry-folding gives different results, so we use uint16 here.
func checksum(data []byte) uint16 {
	var sum uint16
	for i := 0; i+1 < len(data); i += 2 {
		sum += binary.LittleEndian.Uint16(data[i:])
	}
	if len(data)%2 != 0 {
		sum += uint16(data[len(data)-1])
	}
	return ^sum
}

// ─── attendance log parser ────────────────────────────────────────────────────

const attRecordSize = 40

func parseAttLog(raw []byte) []AttRecord {
	records := make([]AttRecord, 0, len(raw)/attRecordSize)
	for i := 0; i+attRecordSize <= len(raw); i += attRecordSize {
		rec := raw[i : i+attRecordSize]

		// User ID: first 9 bytes, ASCII, null-padded
		uid := string(nullTrim(rec[0:9]))

		verify := int(rec[9])
		ts := decodeZKTime(binary.LittleEndian.Uint32(rec[10:14]))
		status := int(rec[14])

		records = append(records, AttRecord{
			UserID:     uid,
			VerifyType: verify,
			Timestamp:  ts,
			Status:     status,
		})
	}
	return records
}

// decodeZKTime converts a ZKTeco packed 32-bit timestamp to time.Time.
// ZK time: seconds = t%60; minutes = (t/60)%60; hours = (t/3600)%24;
// day = (t/86400)%31+1; month = (t/86400/31)%12+1; year = t/86400/31/12+2000
func decodeZKTime(t uint32) time.Time {
	second := t % 60
	t /= 60
	minute := t % 60
	t /= 60
	hour := t % 24
	t /= 24
	day := t%31 + 1
	t /= 31
	month := t%12 + 1
	t /= 12
	year := 2000 + t
	return time.Date(int(year), time.Month(month), int(day),
		int(hour), int(minute), int(second), 0, time.Local)
}

func nullTrim(b []byte) []byte {
	for i, v := range b {
		if v == 0 {
			return b[:i]
		}
	}
	return b
}

func readFull(conn net.Conn, buf []byte) (int, error) {
	total := 0
	for total < len(buf) {
		n, err := conn.Read(buf[total:])
		total += n
		if err != nil {
			return total, err
		}
	}
	return total, nil
}
