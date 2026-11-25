# Biometric Integration — Requirements & Process

*2026-11-24 · Nilesh - Tvaksa*

This document covers everything needed — hardware, enrollment, mapping, and configuration — to get biometric attendance data from the machine into the StayFit gym software, for both members and staff.

---

## 1. Overview

The biometric machine captures a fingerprint or face scan every time a member or staff member enters or exits the gym. A middleware service running on the server receives each scan instantly, identifies the person, and writes the event to the StayFit database as an attendance record. No manual check-in is needed. The entire flow — from scan to database — happens in under a second.

---

## 2. One-Time Hardware & Network Setup

This is done once before the system goes live.

| Task | Detail | Done by |
| --- | --- | --- |
| Connect machine to network | Machine must be on the same network as the internet (Wi-Fi or LAN) | Gym / IT |
| Confirm machine can reach the server | Machine sends data to stayfit.tvaksa.com; firewall must allow outbound HTTP | IT |
| Install middleware on server | A service on the VPS receives raw punch events from the machine and forwards them to the app | Done |
| Configure machine ADMS URL | Set the server address in the machine's admin panel so it knows where to push data | Done |
| Verify test scan reaches server | Do a test scan and confirm it appears in the software | Done |

---

## 3. Member Enrollment & Mapping

Each member goes through a two-step process once.

**Step 1 — Enroll on the machine**

The gym staff enrolls the member's fingerprint or face on the biometric machine. The machine assigns a unique Device User ID (e.g. 1001, 1002) to that member.

**Step 2 — Map to the member profile in StayFit**

The gym admin enters that Device User ID against the member's profile in the software. After this, every scan by that member is automatically linked to their account.

| What happens after mapping | Detail |
| --- | --- |
| First scan of the day | Auto Check-In recorded with timestamp |
| Second scan of the day | Auto Check-Out recorded; duration calculated |
| Expired or cancelled membership | Scan is received but attendance is NOT recorded |
| Unknown device ID (not mapped) | Scan is logged as unrecognised; no attendance created |

**Who does this:** Gym admin or reception staff, once per member at the time of joining.

---

## 4. Staff Enrollment & Mapping

The process is the same as for members, but mapped to a staff or trainer profile instead.

**Step 1 — Enroll on the machine**

Enroll the staff member's fingerprint or face. The machine assigns a Device User ID (e.g. 2001, 2002).

**Step 2 — Map to the staff profile in StayFit**

The admin enters that Device User ID against the staff member's profile. The middleware then knows to route that person's punches to the staff attendance module, not the member attendance module.

| What is recorded per punch | Detail |
| --- | --- |
| Punch timestamp (device clock) | Exact time the scan happened on the machine — stored for reference only |
| Server received timestamp | Time the server got the data — this is the official time used for all calculations |
| All punches stored | Every scan throughout the day is kept, not just first and last |
| Duty hours | Calculated as: Last punch time − First punch time for that day, using server time |

> **Note on time accuracy:** The biometric machine's clock can be manually changed by employees to manipulate attendance records. To prevent this, the system uses the **server time** (the time the data was received by our server) for all attendance calculations — not the time reported by the machine. The machine's clock time is stored for reference but carries no weight in duty hour or attendance computations.

**Who does this:** Gym admin, once per staff member at the time of onboarding.

---

## 5. How Data Flows — Step by Step

1. **Member or staff scans** their fingerprint or face at the biometric machine.
2. The **machine sends the scan event** (Device User ID + timestamp) to the middleware service on the server.
3. The **middleware looks up the Device User ID** against the mapping table to identify the person.
4. It calls the **StayFit backend API** with the person's ID and the scan time.
5. The backend determines whether this is a **member scan or a staff scan** and routes accordingly.
6. For members: checks for an open check-in. First scan = check-in; second scan = check-out with duration.
7. For staff: stores the punch timestamp. All punches are kept; duty hours are computed at the end of the day.
8. The record is **written to the database** and immediately visible in the admin panel.
9. The **live last-scan display** on the dashboard updates to show who just scanned and when.

The entire flow from scan to database takes under one second.

---

## 6. Member Attendance

Once a member is enrolled and mapped, attendance is fully automatic.

- **Check-In:** The first scan of the day creates an attendance record with the entry time.
- **Check-Out:** The second scan of the day closes that record and calculates the visit duration.
- **Inactive members:** If a membership is expired or cancelled, the scan is received but ignored — no attendance is created.
- **Manual override:** Reception staff can still manually add or correct attendance records from the admin panel if needed.

| Where to view | Location in software |
| --- | --- |
| Individual member's visit history | Members → Member Profile → Attendance tab |
| Today's check-ins across all members | Attendance page (live view) |
| Last person who scanned | Dashboard — live scan widget |
| Monthly visit counts and trends | Reports → Members Report |

---

## 7. Staff Attendance

For staff, every single punch is stored — not just the first and last. This gives an accurate record even when staff step out briefly during the day.

- **Duty hours** are calculated as: last punch of the day minus first punch of the day.
- Both the **device clock time** and the **server received time** are stored. The **server time is always used for calculations** — the device clock is ignored, as it can be manually changed by employees to manipulate attendance records.
- Attendance status (Present, Absent, Half Day, Leave, Holiday) is marked by the admin at month end, using the punch data as a reference.
- **Salary slips** are generated from the attendance record: present days × daily rate, with deductions and bonuses applied.

| Where to view | Location in software |
| --- | --- |
| Monthly punch log per staff member | Staff → Staff Profile → Attendance tab |
| Duty hours per day | Same view — first and last punch with hours |
| Attendance marking (Present/Absent etc.) | Staff → Attendance |
| Salary slip generation | Staff → Payroll |
| Full attendance report | Reports → Staff Attendance |

---

## 8. Shift-Based Attendance — Planned Enhancement

Currently the system records actual punch times and calculates duty hours. The next planned enhancement introduces shift definitions, which will make attendance marking automatic and more precise.

**What will be added:**

- **Define shifts per staff member** — e.g. Morning Shift 6:00 am – 2:00 pm, Evening Shift 2:00 pm – 10:00 pm.
- **Late arrival flag** — if a staff member punches in after their shift start time, the record is automatically flagged as late.
- **Early departure flag** — if the last punch is before the shift end time, the record is flagged accordingly.
- **Automatic attendance status** — Present, Half Day, or Absent is derived from shift compliance without manual marking.
- **Overtime calculation** — hours worked beyond the shift end time are tracked separately.
- **Payroll impact** — late arrivals and early departures can be mapped to deduction rules for salary computation.

**Current status:** Punch recording and duty hours are live. Shift definitions and auto-flagging are on the roadmap.

---

