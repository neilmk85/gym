# Gym Management System — Development Plan & Enhanced Requirements

## 1. Executive Summary

The Gym Management System is a comprehensive, end-to-end solution designed to manage all operational aspects of modern fitness facilities. This system encompasses member lifecycle management, subscription billing, class and personal training scheduling, attendance tracking, performance analytics, and trainer coordination across web and mobile platforms.

This document serves three critical purposes:
1. **Analyze** the existing requirements specification, identifying strengths and gaps
2. **Enhance** the specification with production-ready details covering security, scalability, compliance, and user experience
3. **Plan** the development roadmap with realistic timelines, resource allocation, and risk mitigation strategies

The system will be built using a modern, efficient tech stack: Go 1.26 backend with HTTP and GORM for database abstraction, React frontend with Vite for rapid development, and Flutter mobile apps for cross-platform reach. The architecture emphasizes clean separation of concerns, minimal external dependencies, and operational simplicity through systemd deployment without containerization.

---

## 2. Analysis of Current Requirements

### 2.1 Strengths of Existing Specification

The current requirements document demonstrates several architectural and organizational strengths:

| Strength | Description | Benefit |
|----------|-------------|---------|
| **Clear Role Hierarchy** | Five distinct roles (Admin, Manager, Trainer, Trainer-Assistant, Member) with defined permissions | Scalable access control, clear responsibility boundaries |
| **Handler-Service-Repository Pattern** | Layered architecture separates concerns clearly | Testable, maintainable, extensible codebase |
| **Minimal Dependencies Philosophy** | Use standard Go libraries (net/http), avoid heavy frameworks | Faster deployment, fewer vulnerabilities, easier debugging |
| **Hybrid Training Model** | Support for PT, group classes, and self-directed training | Flexible revenue models, higher member satisfaction |
| **External Device Integration** | Support for third-party attendance devices (turnstiles, RFID) | Automation, anti-passback, modern member experience |
| **Comprehensive Template System** | Reusable training and diet templates | Trainer efficiency, consistency, scalability |
| **Multi-Platform Support** | Web admin, trainer mobile, client mobile | Full ecosystem, member engagement |

### 2.2 Identified Gaps & Missing Requirements

The analysis reveals 30+ critical gaps that must be addressed for production readiness:

| # | Area | Gap/Issue | Impact | Priority |
|---|------|-----------|--------|----------|
| 1 | Authentication | No password reset / forgot password flow | Members locked out of accounts permanently | Critical |
| 2 | Authentication | No email verification for signup | Account takeover risk, bot registrations | Critical |
| 3 | Data Governance | No soft-delete strategy (GDPR/data retention) | Regulatory non-compliance, audit trail gaps | Critical |
| 4 | API Security | No rate limiting or throttling on APIs | DDoS vulnerable, brute force attacks possible | Critical |
| 5 | Audit Trail | No audit logging for admin/trainer actions | Liability exposure, fraud detection disabled | Critical |
| 6 | File Management | No file/image upload handling (member photos, trainer profiles, exercise images) | Cannot fulfill PT/class features, poor UX | High |
| 7 | API Design | No search/filter/pagination specs for list endpoints | Unscalable, memory exhaustion on large datasets | High |
| 8 | Performance | No caching strategy (Redis/in-memory) | Slow dashboards, database overload | High |
| 9 | Reliability | No backup and disaster recovery plan | Data loss risk, extended downtime | High |
| 10 | API Design | No error code standardization | Inconsistent error handling on clients | High |
| 11 | API Design | No API versioning strategy beyond v1 | Breaking changes affect all clients simultaneously | High |
| 12 | Operations | No health check endpoints for monitoring | Cannot detect failures proactively | High |
| 13 | Operations | No graceful shutdown handling | Data corruption risk, member data loss | High |
| 14 | Database | No migration strategy documented | Manual, error-prone upgrades | High |
| 15 | Authentication | Missing session timeout and refresh token logic | Security risk, stale sessions | High |
| 16 | Payments | No webhook support for payment gateway callbacks | Async payment confirmation impossible, reconciliation gaps | High |
| 17 | Billing | No multi-currency or tax handling (GST/VAT) | Cannot operate internationally, tax compliance | High |
| 18 | Billing | No cancellation/refund policies for classes and PT | Member disputes, unclear refund terms | High |
| 19 | Classes | No waitlist for full classes | Member experience poor, revenue loss opportunity | Medium |
| 20 | Training | No trainer availability/calendar management | Inefficient scheduling, member frustration | Medium |
| 21 | Memberships | No member freeze/pause membership feature | Members cancel instead of pausing (lost MRR) | Medium |
| 22 | Billing | No promo codes or discount system | Cannot run campaigns, competitive disadvantage | Medium |
| 23 | Reporting | No reporting export (PDF/CSV/Excel) | Gym manager cannot analyze business metrics | Medium |
| 24 | Data Management | No data import for existing members | Migration from legacy systems impossible | Medium |
| 25 | Compliance | No terms of service / waiver management | Legal liability, unenforceable agreements | Medium |
| 26 | Member Profile | No emergency contact for members | Safety/liability issue in emergencies | Medium |
| 27 | Operations | No inventory tracking (equipment maintenance/replacement) | Cannot optimize capex, compliance issues | Medium |
| 28 | Notifications | No notification preference management per user | Spam complaints, poor user experience | Medium |
| 29 | Attendance | No anti-passback prevention (double check-in) | Fake attendance, gaming statistics | Medium |
| 30 | Performance | No database indexing strategy specified | Slow queries, n+1 problems | Medium |

---

## 3. Enhanced Requirements Specification

### 3.1 Authentication & Authorization (Enhanced)

#### 3.1.1 JWT & Refresh Token Flow

**Access Token (JWT)**
- Validity: 15 minutes
- Contains: user_id, role, permissions, issued_at, expires_at
- Signing: HS256 algorithm with secret key
- Claims structure:
  ```json
  {
    "sub": "user_123",
    "email": "user@gym.com",
    "role": "member",
    "permissions": ["read:own_profile", "checkin:self"],
    "iat": 1712973600,
    "exp": 1712974500
  }
  ```

**Refresh Token**
- Validity: 7 days
- One refresh token per device/session
- Stored in httpOnly cookies
- Contains rotation hash to detect token theft
- Revocable via token blacklist (Redis)

**Logout Flow**
- Client sends refresh token to revocation endpoint
- Server adds token to blacklist (expire after 7 days)
- Both access and refresh tokens invalidated

#### 3.1.2 Password Reset via Email/SMS OTP

**Email Reset Flow**
1. Member requests password reset with email
2. Generate 6-digit OTP, valid for 15 minutes
3. Send via email with clickable reset link
4. Validate OTP, set new password
5. Invalidate all existing refresh tokens

**SMS OTP Flow (for mobile)**
1. Member requests password reset with phone number
2. Generate 6-digit OTP, valid for 10 minutes
3. Send via SMS (Twilio or similar)
4. Validate OTP in mobile app
5. Member sets new password
6. Invalidate all refresh tokens

**Constraints**
- Max 3 reset requests per hour per email/phone
- Password must differ from last 5 passwords
- Failed OTP attempts: max 5 before account lockout (30 min)

#### 3.1.3 Role-Based Access Control (RBAC)

**Role Hierarchy**
```
Admin
  ├─ Manage all users
  ├─ View all reports
  ├─ Configure settings
  ├─ Manage payments
  └─ Audit logs access

Manager
  ├─ Member management
  ├─ Attendance reports
  ├─ PT/Class management
  ├─ Payment view (not refunds)
  └─ Cannot delete data

Trainer
  ├─ Manage own PT sessions
  ├─ Manage own classes
  ├─ Create training templates
  ├─ View assigned members
  └─ Cannot modify plans/pricing

Trainer-Assistant
  ├─ Check-in members
  ├─ View class roster
  ├─ Record attendance
  └─ Read-only member info

Member
  ├─ View own profile
  ├─ Book classes/PT
  ├─ Checkin (turnstile/QR)
  ├─ View training progress
  └─ Cannot view others' data
```

**Permission Model**
- Resource-based: `resource:action` (e.g., `member:read`, `payment:refund`)
- Middleware checks role against endpoint requirement
- Scope restrictions: managers can only see members in their facility

#### 3.1.4 Session Management

- Sessions stored in Redis with member_id as key
- Session data: login_time, last_activity, device_fingerprint, ip_address
- Idle timeout: 30 minutes of inactivity → auto-logout
- Concurrent sessions: max 3 per user
- Session attributes encrypted before Redis storage

#### 3.1.5 Account Security

**Account Lockout Policy**
- 5 failed login attempts → 30-minute lockout
- 10 failed attempts in 24 hours → requires admin unlock
- Failed OTP attempts: 5 → 15-minute lockout

**API Key Management**
- Issued to external devices (turnstiles, fitness trackers)
- Format: `gym_<facility_id>_<random_32_chars>`
- Rotation: must rotate every 90 days
- Rate limited: 1000 requests/minute per key
- Audit: all API key usage logged with timestamp

#### 3.1.6 Two-Factor Authentication (2FA) - Optional Enhancement

- Available for Admin/Manager roles
- Methods: TOTP (Google Authenticator) or SMS
- Recovery codes: 10 codes per user, single-use

---

### 3.2 Member Management (Enhanced)

#### 3.2.1 Member Profile Schema

**Core Fields**
- Name, email, phone, date of birth
- Gender, height, weight
- Emergency contact: name, relationship, phone number
- Membership status: active, paused, expired, cancelled
- Member since (joining date)
- Facility assigned (which gym location)

**Enhanced Fields**
- **Profile Photo**: JPEG/PNG, max 2MB, thumbnail 150x150px
- **Health Declaration**: 
  - Medical conditions
  - Medications
  - Allergies
  - Previous injuries
  - Fitness assessment score (calculated)
- **Communication Preferences**:
  - Email marketing: yes/no
  - SMS notifications: yes/no
  - Push notifications: yes/no
  - Preferred communication channel
- **Tags/Segments**: Fitness goals (weight loss, strength, endurance), experience level, etc.
- **Member Notes**: Internal notes from trainers/managers (not visible to member)

#### 3.2.2 Member Lifecycle Management

**States and Transitions**
```
[Prospect] → (signup) → [Active] 
[Active] → (pause) → [Paused] → (resume) → [Active]
[Active] → (cancel) → [Cancelled] → (reactivate) → [Active]
[Active] → (expiry) → [Expired]
[Expired] → (renew) → [Active]
```

**Pause Feature**
- Valid for 1-3 months
- Billing paused, membership extends by pause duration
- Access revoked during pause
- Notifications before re-activation

**Cancellation**
- Reason tracking: moved, cost, dissatisfied, other
- Notice period: 7-30 days depending on plan
- Refund eligibility based on plan
- Offboarding email with feedback survey

**Reactivation**
- Members can rejoin within 6 months without re-signup
- Immediate or scheduled (future date)
- Promo code for returning members

#### 3.2.3 Membership Freeze Policy

**When Freeze Applicable**
- Medical reasons
- Travel (max 6 months)
- Financial hardship
- Maternity/paternity

**Processing**
- Freeze duration: 1-12 months
- Billing: paused, no charges
- Access: revoked
- Membership end date extended by freeze duration
- Can freeze up to 2 times per year

#### 3.2.4 Soft Delete Strategy

**Rationale**: GDPR Article 17 (right to erasure) requires data handling

**Implementation**
- Add `deleted_at` timestamp to members table
- Add `deletion_reason` enum: GDPR_request, account_closure, admin_removal, spam
- Soft delete on cancellation
- Hard delete after 180 days for GDPR requests
- Hard delete after 30 days if requested by member
- Audit trail: deleted_by, deletion_reason, deletion_date

**Data Retention Policy**
- Financial records: 7 years (tax requirement)
- Attendance logs: 3 years (business analytics)
- Session data: 90 days (privacy)
- Contact data: removed on hard delete
- Training progress: anonymized after delete

---

### 3.3 Membership & Subscription System (Enhanced)

#### 3.3.1 Subscription State Machine

```
[Plan Selection] → (purchase) → [Active]
[Active] → (pause) → [Paused] → (resume) → [Active]
[Active] → (upgrade/downgrade) → [Active]
[Active] → (cancel) → [Cancelled]
[Paused] → (cancel) → [Cancelled]
[Paused] → (expiry) → [Expired]
[Active] → (expiry) → [Expired]
[Expired] → (renew) → [Active]
[Cancelled] → (reactivate) → [Active]
```

#### 3.3.2 Promo Codes & Discounts

**Promo Code Types**
- **Percentage Discount**: e.g., 20% off
- **Fixed Amount**: e.g., ₹500 off
- **Free Month**: first month free
- **BOGO**: buy membership, get 1 month free

**Configuration**
- Code: unique, case-insensitive
- Valid from/to dates
- Max uses: total and per member
- Applicable plans: specific or all
- Applicable roles: new members only or all
- Usage tracking: code, member, date, amount saved

**Validation Rules**
- Code exists and is active
- Not exceeded max uses
- Member hasn't used code before (if once-per-member)
- Applicable to selected plan
- Valid date range

**Application**
- Applied at checkout, before payment
- Shows original price, discount, final price
- Invoice shows promo code details
- Refund calculation: if member refunded, discount removed pro-rata

#### 3.3.3 Auto-Renewal Logic

**Configuration per Plan**
- Auto-renew: enabled/disabled
- Renewal reminder: 7 days before expiry
- Grace period: 3 days after expiry (access maintained)
- Failed payment retry: 3 attempts (day of, day+1, day+2)

**Renewal Flow**
1. 7 days before expiry: send reminder email
2. On expiry date: attempt to charge saved payment method
3. If successful: subscription extends, invoice generated
4. If failed: retry up to 2 more times
5. After 3 failed attempts: notify member, request payment
6. After grace period: subscription expired, access revoked

**Invoice Generation**
- Auto-generated PDF
- Sent to member email
- Includes: plan name, amount, renewal date, cancellation instructions
- Tax included if applicable

#### 3.3.4 Plan Upgrades & Downgrades

**Upgrade Logic**
- Member can upgrade anytime
- Price difference pro-rated: new plan cost × (remaining days / subscription period)
- Charged immediately for difference
- Immediately apply new plan benefits
- Reset subscription end date to new plan's period

**Downgrade Logic**
- Downgrades effective at next renewal
- Current plan remains until expiry
- Invoice shows credit: (downgrade savings) × (remaining months)
- Applied as credit on next renewal invoice

**Example**
```
Scenario: Member on ₹3000/month plan (30 days remaining)
          Upgrades to ₹5000/month plan
          
Calculation: (₹5000 - ₹3000) × (30 / 30) = ₹2000 charge
```

#### 3.3.5 Membership Transfer

**Transferring Membership**
- Members can transfer active membership to family member
- One transfer per subscription
- Requires recipient email confirmation
- Transferred membership maintains original renewal date
- Original member no longer has access

#### 3.3.6 Family & Corporate Plans

**Family Plans**
- Primary member + up to 4 dependents
- Single billing for all members
- Family members have individual member profiles
- Family manager can view all members' activity
- Discounted per-person cost vs. individual plans

**Corporate Plans**
- Negotiated bulk pricing
- Admin account for company
- Employee on-boarding: bulk CSV import
- Subsidized cost per employee
- Expense tracking at corporate level

**Trial Memberships**
- 7/14/30 day free trial
- Full access during trial
- Card required at signup (for auto-conversion)
- Auto-converts to paid plan on expiry (unless cancelled)
- Trial members can cancel anytime
- Discounted offer on conversion: e.g., first month 50% off

---

### 3.4 Attendance System (Enhanced)

#### 3.4.1 Check-in Methods

**QR Code Scan**
- Mobile app generates dynamic QR code
- Valid for 60 seconds (updates every 10 seconds)
- Each gym has QR scanner at entrance
- Instant check-in confirmation on app

**RFID Card**
- Member swipes card at turnstile
- Instant LED confirmation (green=success, red=denied)
- Offline mode: saves 100 recent valid card IDs
- Sync on reconnection

**Biometric (Future)**
- Fingerprint/face recognition
- Stored locally on turnstile device
- Zero latency check-in

**Manual Check-in**
- Trainer-Assistant taps member name in app
- Used for walk-ins, password resets, etc.
- Requires trainer PIN confirmation
- Logged with trainer_id for audit

#### 3.4.2 Anti-Passback Prevention

**Problem**: Member A checks in, hands RFID card to Member B (double occupancy)

**Solution**
- Record check-in with timestamp + member_id
- Prevent same member re-entry within 10 minutes
- If re-entry attempt: alert turnstile operator via red LED + tone
- Fallback: manual approval required
- Log all failed anti-passback attempts

**Implementation**
- Redis cache: `member_123:last_checkin = 1712973600`
- On check-in: get last_checkin, validate time delta > 600 seconds
- Update on successful check-in

#### 3.4.3 Geofencing for Self Check-in

**Scenario**: Mobile app check-in, prevent remote check-ins

**Setup**
- Define gym location: latitude/longitude, radius (50m)
- Enable geo-check-in in settings

**Flow**
1. Member opens app near gym
2. Request location permission (already have)
3. Check-in button appears (within geofence)
4. Tap check-in, app verifies distance < 50m
5. If > 50m: error "Please enter gym to check-in"

**Privacy Note**
- Only location used for check-in validation
- Not stored, not tracked
- Disabled when member not checking in

#### 3.4.4 Attendance Streaks & Gamification

**Streak Tracking**
- Consecutive days of check-ins
- Reset on missed day
- Displayed on member dashboard
- Badges: 7-day, 30-day, 90-day streaks

**Rewards**
- 7-day streak: +50 gym points
- 30-day streak: +200 gym points + email congratulations
- 90-day streak: +500 gym points + free PT session (configurable)

**Leaderboard**
- Top 10 members by streak (weekly/monthly)
- Displayed in member app (optional feature)
- Excludes premium features (no cash value)

#### 3.4.5 Late/Early Check-in Handling

**Late Entry Policy**
- Class starts: 6:00 PM
- Late entry allowed until: 6:10 PM
- After 6:10 PM: class counts as "missed", no credit
- Member notified: "Class started 5 minutes ago. Late entry fee: ₹100?"

**Early Checkout**
- Member checks out before session end
- Still counts as attended if stayed > 50% of duration
- Logged for workout quality metrics

**No-Show Policy**
- Not checked in by 15 minutes after class start
- Class marked as "no-show"
- Visible on member attendance report
- After 3 no-shows in month: warning email
- After 5 no-shows: auto-cancel from future classes

#### 3.4.6 Capacity-Based Access Control

**Class Capacity Management**
- Class capacity: 20 members max
- Booking limit: 18 (2 buffer for walk-ins)
- Waitlist: members can join when full
- Check-in: access granted if within capacity

**Facility Capacity (Gym-wide)**
- Max 200 members simultaneously in gym
- Turnstile tracks real-time count
- When full: QR/RFID rejected, redirect to "gym at capacity" page
- Admin alert if breached

**Implementation**
- Redis: `gym_123:current_occupancy = 145`
- On check-in: increment counter, check limit
- On check-out (automated): decrement after 3 hours idle

#### 3.4.7 Attendance Reporting

**Member Attendance Report**
- Date range: last 30/90/180 days
- Metrics:
  - Total visits: 23
  - Average visits/week: 4.2
  - Current streak: 12 days
  - Last visited: today at 6:15 PM
  - Favorite time: 6 PM - 7 PM
  - Facility usage: breakdown by facility
  - Class attendance: # attended vs. booked
  - PT sessions: # attended vs. scheduled

**Facility Attendance Report** (Manager view)
- Date range customizable
- Total visits by hour: shows peak times
- Member count: new vs. returning
- Attendance by membership type
- No-show rate
- Trend analysis: week-over-week growth
- Export to CSV

**Attendance via External Device**
- Turnstile: auto-sync every 5 minutes
- Failed syncs: stored locally, retry on reconnection
- Reconciliation: compare device logs with server
- Discrepancy report: alerts if > 5 syncs failed

---

### 3.5 Payment System (Enhanced)

#### 3.5.1 Payment Gateway Integration

**Supported Providers**
1. **Razorpay** (primary for India)
   - Modes: API integration, Checkout hosted
   - Methods: credit card, debit card, UPI, netbanking, wallet
   - Settlement: T+1 business day
   - Webhook: payment.authorized, payment.failed, payment.captured

2. **Stripe** (international expansion)
   - Methods: cards, ACH, Google Pay, Apple Pay
   - Settlement: daily
   - 3D Secure: mandatory for cards > $100

3. **PayPal** (future)
   - Standard and Express checkout

#### 3.5.2 Payment Flow

**Web Checkout Flow**
```
1. Member selects plan, applies promo code
2. Displays: amount, tax (if applicable), final total
3. Member clicks "Pay Now"
4. Redirect to Razorpay Checkout (hosted)
5. Member enters payment details
6. Razorpay processes, returns status
7. Server validates webhook signature
8. Update subscription status: "active"
9. Send invoice email
10. Redirect to success page with invoice download
```

**Mobile Checkout Flow**
```
1. Member selects plan in Flutter app
2. Initiate Razorpay SDK integration
3. Razorpay overlay opens in app (native)
4. Member enters details
5. App receives payment result
6. App sends payment_id to backend for verification
7. Backend validates with Razorpay API
8. Subscription activated
9. Success screen with invoice
```

#### 3.5.3 Webhook Handling

**Razorpay Webhook Events**
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_123456",
        "amount": 300000,
        "currency": "INR",
        "status": "captured",
        "notes": {
          "member_id": "mbr_789",
          "subscription_id": "sub_456"
        }
      }
    }
  }
}
```

**Processing**
1. Verify webhook signature using secret key
2. Extract member_id, subscription_id from notes
3. Update subscription: status = "active", activated_at = now()
4. Generate invoice
5. Send confirmation email
6. Log transaction with payment_id

**Error Handling**
- Invalid signature: reject (potential replay attack)
- Missing member_id: log alert, manual review
- Duplicate webhook: idempotent (check if subscription already active)

#### 3.5.4 Partial Payments & Installments

**Partial Payment**
- Member can pay portion of amount
- Remaining amount due: shown on dashboard
- Payment reminder: every 7 days
- Auto-reminder: 3 days before expiry date

**Installment Plans** (optional feature)
- For annual plans: 3/6/12 month installments
- First installment: charged immediately
- Remaining: scheduled auto-payments
- If installment fails: all benefits suspended
- Catch-up payment: member can pay missed installment anytime

#### 3.5.5 Refund Workflow

**Refund Types**
1. **Cancellation Refund**: member cancels mid-subscription
   - Eligible if within 14 days of purchase
   - Full refund of unused portion
   - Processing: 5-7 business days

2. **Class/PT Cancellation Refund**: member cancels class/PT session
   - Refundable if cancelled 24 hours before start
   - Amount: class/PT cost
   - Processed within 24 hours

3. **Admin Refund**: manager issues refund (dispute resolution)
   - Requires reason: duplicate charge, technical error, member satisfaction
   - Amount: customizable
   - Logged with manager comment

**Refund Processing**
- Create refund record with reason, amount, date
- Request refund via Razorpay API
- Webhook: refund.processed
- Update subscription: refund_amount, refund_date
- Send refund email with confirmation

**GST Handling on Refund**
- If refund after 14 days: no GST reversal (tax not refundable)
- If refund within 14 days: full GST reversal
- Invoice shows: original GST, refund GST, net refund

#### 3.5.6 Invoice Generation & Management

**Invoice Fields**
- Invoice ID: auto-generated (format: INV-2024-001234)
- Member: name, email, phone, address
- Billing date, due date
- Item: plan name, duration, amount
- Tax: GST 18% (if applicable)
- Discount: promo code, amount
- Total amount, paid amount, balance
- Payment method (card last 4 digits masked)
- Terms: cancellation policy, refund policy

**Storage & Delivery**
- Stored as PDF in local filesystem: `/storage/invoices/2024/04/INV-2024-001234.pdf`
- Sent to member email on payment success
- Available on member portal for download
- Retention: 7 years (tax requirement)

**GST/Tax Handling**
- GST rate: 18% (configurable by admin)
- Applied on subscription amount
- Invoice shows: amount (before tax), tax, total
- Tax ID: registered to facility/gym
- GST-compliant format per Indian requirements

#### 3.5.7 Payment Reconciliation

**Daily Reconciliation Process**
```
1. Fetch all payments from Razorpay API (last 24h)
2. For each payment:
   - Check if payment_id exists in our database
   - If missing: alert (possible unlinked payment)
   - If exists: verify amount, status, member_id
   - If mismatch: alert for manual review
3. Generate reconciliation report
4. Mark all verified payments
5. Flag unresolved items for manager review
```

**Outstanding Balance Tracking**
- Table: `payment_outstanding`
  - member_id, amount_due, due_date, reason
- Updated on: refund, partial payment, failed auto-renewal
- Aging report: 30, 60, 90 day overdue buckets
- Auto-email reminder: 7 days before due, on due date, 7 days after

**Payment Reminders**
- 7 days before renewal: "Your membership renews on April 20"
- On renewal date: "Attempting to charge your saved card"
- If failed: "Payment failed. Please update your payment method"
- Manual payment link: allows member to pay online

---

### 3.6 Personal Training (Enhanced)

#### 3.6.1 Trainer Availability & Calendar

**Availability Setup**
- Trainer sets working hours: e.g., "Mon-Fri 6-9 PM, Sat 8-12 PM"
- Session duration: 30, 45, 60 minutes (configurable)
- Break time: 15 minutes between sessions
- Availability scope: specific facility or multi-facility

**Calendar View**
- Member sees: Trainer available slots (green), booked (gray), unavailable (red)
- Trainer sees: Own calendar with booked sessions, member notes, preparation time
- Manager sees: All trainers, color-coded by facility

**Blackout Dates**
- Trainer can mark unavailable: vacation, sick, training
- Date range, reason, auto-sync to member calendar
- Members receive notification of cancellation

#### 3.6.2 Session Booking & Scheduling

**Booking Flow**
```
1. Member selects trainer, views available slots
2. Selects date/time, number of sessions (1, 4, 8, 12)
3. Selects training type: 1-on-1, small group (2-4)
4. Confirms: date, time, duration, cost, trainer
5. Payment: from wallet, credit card, or prepaid PT package
6. Booking confirmed, calendar updated
7. SMS/push notification to trainer
```

**Session Types**
- **1-on-1 Personal Training**: trainer + 1 member
- **Small Group**: trainer + 2-4 members (discounted rate)
- **Class Session**: trainer + 8-20 members (class booking)

**Rescheduling Policy**
- Member can reschedule: 24 hours notice
- Reschedule window: up to 7 days in future
- Free reschedules: 2 per month
- After 2: ₹100 fee per reschedule
- Trainer approval: automatic within available slots

**Session Package Options**
- 4 sessions: valid for 30 days, 5% discount
- 8 sessions: valid for 60 days, 10% discount
- 12 sessions: valid for 90 days, 15% discount
- Unused sessions: non-refundable after expiry (with notice)

#### 3.6.3 Cancellation & Fees

**Member Cancellation**
- 24+ hours before: full refund, 0 fee
- 6-24 hours: 50% refund, 50% fee
- < 6 hours: 0 refund, 100% cancellation fee
- No-show: 100% charge, member notified

**Trainer Cancellation**
- 24+ hours: free reschedule offered, full refund
- < 24 hours: full refund, complimentary session offered

**Session Expiry**
- Sessions valid for: 30/60/90 days (package-dependent)
- Expiry notice: email 7 days before
- Expired sessions: auto-cancel, refund to wallet
- Can manually extend: manager approval required

#### 3.6.4 Session Execution & Tracking

**Pre-Session**
- Trainer receives reminder: 24 hours, 1 hour, 15 minutes
- Member receives reminder: 24 hours, 1 hour before
- Auto check-in: member marked attended 10 min before (if booked class)

**During Session**
- Trainer starts session: app records start time
- Takes notes in session (form: exercises, sets, reps, feedback)
- Takes progress photos (with member consent)
- Records body measurements (if first session or monthly)

**Post-Session**
- Trainer ends session: records end time (duration)
- Marks member: attended, no-show, cancelled
- Session auto-saved with notes, photos, measurements
- Member receives notification: session completed, next session booked

**Session Notes Structure**
```json
{
  "session_id": "pt_123",
  "date": "2024-04-12",
  "trainer_id": "trainer_45",
  "member_id": "member_78",
  "duration": 60,
  "exercises": [
    {
      "exercise_id": "ex_10",
      "name": "Bench Press",
      "sets": 4,
      "reps": 8,
      "weight": 80,
      "notes": "Good form, increase weight next session"
    }
  ],
  "measurements": {
    "weight": 85.5,
    "chest": 100,
    "waist": 90
  },
  "photos": ["storage/photos/session_123_1.jpg"],
  "overall_feedback": "Great session, member pushing hard",
  "next_session_focus": "Increase weight on squats"
}
```

#### 3.6.5 Trainer Rating & Review System

**Review Triggers**
- After every 5 sessions: prompt member for feedback
- Voluntary: member can review anytime
- Mandatory for refund disputes (auto-survey)

**Review Fields**
- Rating: 1-5 stars
- Knowledge: 1-5 (does trainer know exercises/progression?)
- Motivation: 1-5 (did trainer push/encourage?)
- Professionalism: 1-5 (punctuality, cleanliness, respect?)
- Written comment: optional, max 500 chars
- Would you recommend: yes/no

**Review Visibility**
- Hidden from trainer until completed (prevents bias)
- Trainer can respond to negative reviews (< 3 stars)
- Public profile shows: average rating, total reviews, top 5 reviews

**Rating Impact**
- < 3.5 avg rating: manager review, coaching offered
- < 3.0 avg rating: manager conversation required
- 4.5+ rating: featured trainer, bonus opportunity

#### 3.6.6 Progress Tracking

**Progress Photos**
- Member photos: front, side, back at signup, monthly, end-of-program
- Comparison slider: before/after
- Member only: full control over visibility
- Trainer can request: "Can I take progress photos for tracking?"
- Member can approve/deny each session

**Measurements Tracking**
- Height, weight, body fat %, measurements (chest, waist, hips, arms, legs)
- Recorded: every PT session (weight), monthly (full measurements)
- Graph: weight trend, measurements trend
- Goal tracking: current vs. target weight

**Workout Performance**
- Exercise library with difficulty progression
- Session-to-session comparison: weight, reps, sets
- Strength gains: "Bench press +10kg from last session"
- Endurance gains: "Completed 5 extra reps on squats"
- Personal records (PB): tracked and celebrated

**Goal Setting**
- Member sets goals: "Lose 5kg in 3 months", "Bench 100kg"
- Trainer assigns training template aligned to goals
- Progress towards goal: visual progress bar
- Milestone celebrations: email, app notification

---

### 3.7 Classes & Studio (Enhanced)

#### 3.7.1 Class Scheduling & Recurring Schedules

**Class Setup**
- Class name: "Spin & Burn", "Yoga Fundamentals"
- Facility: specific gym location
- Trainer: assigned trainer
- Schedule: recurring or one-time
- Capacity: 20 members max
- Duration: 45, 60, 90 minutes
- Cost: ₹500 per class or part of membership
- Level: beginner, intermediate, advanced

**Recurring Schedule**
- Repeat: weekly on Mon/Wed/Fri at 6:30 PM
- Duration: until specified end date or indefinitely
- Auto-generate: 12 weeks of classes at once
- Exception dates: skip, cancel, or reschedule
- Update master: change all future instances

**Class Booking Flow**
```
1. Member browses classes: filter by date, time, facility, trainer
2. Select class, see: available slots, member list, trainer info
3. Confirm booking
4. Charge: ₹500 or deduct from membership class quota
5. Confirmation: email, calendar invite, app notification
6. 24 hours before: reminder notification
7. Auto-check-in: 10 minutes before start (optional)
```

#### 3.7.2 Waitlist System

**Waitlist Management**
- Class full (20 members booked): additional bookings go to waitlist
- Waitlist position: "Position #3, 2 people ahead of you"
- Notification: when member moves up or space available
- Auto-promotion: if member cancels, first on waitlist auto-booked
- Opt-out: member can stay on waitlist and not join if promoted

**Waitlist to Booking**
1. Member on waitlist #1 gets notified
2. "A spot is available! Confirm within 1 hour?"
3. If accept: booked, charged, calendar updated
4. If no response: after 1 hour, offer to next on waitlist
5. If decline: stay on waitlist for future instances

#### 3.7.3 Class Cancellations & Notifications

**Cancellation Scenarios**

**1. Trainer Cancels Class**
- Reason: sick, emergency, personal
- Immediate notification: push, email, SMS to all booked members
- Options for members:
  - Automatically move to next occurrence
  - Reschedule with substitute trainer
  - Refund/credit
  - Waitlist members cleared from cancellation

**2. Facility Cancels Class**
- Reason: low enrollment, equipment failure, special event
- 24-hour notice if possible
- Notification: all members, credit issued
- If < 24 hours notice: ₹50 credit per member

**3. Member Cancels Booking**
- Free cancellation: 24+ hours before
- Non-refundable: < 24 hours before
- No-show: charge full amount, member notified
- Cancel class credit: "You will lose this spot. Confirm?"

**Notification Template**
```
Spin & Burn class on April 15 at 6:30 PM is cancelled.
Reason: Trainer unavailable
We've credited your account with ₹500.
Next class: April 17 at 6:30 PM (Can we book you?)
```

#### 3.7.4 Substitute Trainer Handling

**Process**
1. Original trainer unavailable (marks as unavailable)
2. Manager searches for substitute: same class type, available time
3. Confirms substitute trainer
4. Notification to member: "Your trainer is unavailable. [New Trainer] will lead class"
5. If member unsatisfied: cancel with full refund, no questions asked

**Criteria for Substitute**
- Same certification level (yoga instructor for yoga, etc.)
- Member hasn't blacklisted trainer (no mandatory substitutes)
- Trainer availability at exact class time

#### 3.7.5 Class Packages & Buy-In

**Package Models**

**1. Class Passes**
- 10-class pass: ₹4500 (save ₹500 vs. single classes)
- 20-class pass: ₹8500 (save ₹1500)
- Valid for: 90 days from purchase
- Rollover: unused classes expire, no credit

**2. Unlimited Monthly**
- ₹2000/month for unlimited classes in category
- Categories: "Spin", "Yoga", "CrossFit", "All Classes"
- No booking required: show up, entry granted if space available
- Multi-category: ₹3000/month for all classes

**3. BOGO & Promotions**
- "Buy 4 classes, get 1 free"
- "First class free" for new members
- Seasonal: "March special: 20 classes for ₹7999"
- Applied at checkout, shown in summary

#### 3.7.6 Class Ratings & Feedback

**Post-Class Survey**
- Sent 1 hour after class end
- Trainer quality: 1-5 (technique, form correction, motivation)
- Difficulty level: too easy, just right, too hard
- Class pacing: too slow, just right, too fast
- Would attend again: yes/no
- Additional feedback: text (optional)

**Ratings Aggregation**
- Shown on class listing: "4.7 avg rating from 23 reviews"
- Used for scheduling: low-rated time slots adjusted
- Trainer feedback: "Afternoon classes rated 4.2, evening 4.8"

**Feedback Action**
- Negative feedback triggers follow-up: manager contacts trainer
- Positive feedback: featured on gym marketing materials
- Recurring issues (< 3.5 rating): trainer coaching/replacement

---

### 3.8 Training & Diet Templates (Enhanced)

#### 3.8.1 Exercise Library

**Exercise Master Data**
- Exercise name: "Bench Press", "Squats", "Yoga Sun Salutation"
- Category: strength, cardio, flexibility, calisthenics
- Difficulty: beginner, intermediate, advanced
- Equipment: barbell, dumbbell, kettlebell, machine, bodyweight, yoga mat
- Muscle groups: primary, secondary (chest-primary, shoulders-secondary)
- Instructions: step-by-step (text + images)
- Video link: external video URL (YouTube, Vimeo)
- Duration: 45s video reference
- Safety notes: common mistakes, injury prevention

**Exercise Images/Videos**
- Stored in: `/storage/exercises/`
- Formats: JPEG for images, MP4 for video
- Resolution: 720p for videos, 400x300px for thumbnails
- Indexed for fast retrieval

#### 3.8.2 Training Templates

**Template Structure**
```
Template: "Beginner Strength - 3 Days/Week"
Duration: 12 weeks
Goal: Weight loss + strength building
Level: Beginner
Days/Week: 3 (Mon/Wed/Fri)
Session Duration: 45-60 minutes

Day 1 (Monday): Lower Body
├─ Warmup: 5-minute treadmill walk (no tracking)
├─ Exercise 1: Leg Press
│  ├─ Sets: 3
│  ├─ Reps: 12-15
│  ├─ Weight: 100kg (prescribed)
│  ├─ Rest: 60s
│  └─ Notes: "Control descent, full range of motion"
├─ Exercise 2: Leg Curl (machine)
│  └─ Sets: 3, Reps: 12, Weight: 60kg, Rest: 45s
├─ Exercise 3: Leg Extensions
│  └─ Sets: 3, Reps: 15, Weight: 70kg, Rest: 45s
└─ Cool down: 5-minute walk + stretching

Day 2 (Wednesday): Upper Body Push
├─ Exercise 1: Bench Press
│  └─ Sets: 4, Reps: 8-10, Weight: 60kg, Rest: 90s
├─ Exercise 2: Incline Dumbbell Press
│  └─ Sets: 3, Reps: 10-12, Weight: 25kg per side, Rest: 60s
├─ Exercise 3: Tricep Dips
│  └─ Sets: 3, Reps: 8-12, Weight: bodyweight, Rest: 60s
└─ Exercise 4: Tricep Rope Pushdown
   └─ Sets: 3, Reps: 12-15, Weight: 40kg, Rest: 45s

Day 3 (Friday): Upper Body Pull
└─ [Similar structure for pull exercises]
```

#### 3.8.3 Progressive Overload Tracking

**Concept**: Track member's progress through increasing difficulty

**Progression Rules**
- If member completes all prescribed reps for 2 consecutive sessions:
  - Increase weight by 5% (or next available increment)
  - Reset reps to lower end of range
  - Log progression with date, previous weight, new weight

**Example**
```
Session 1: Bench Press 60kg x 8 reps ✓
Session 2: Bench Press 60kg x 8 reps ✓
Session 3: Bench Press 63kg x 8 reps (+ 5% progression)
Session 4: Bench Press 63kg x 8 reps ✓
Session 5: Bench Press 63kg x 9 reps ✓
Session 6: Bench Press 66kg x 8 reps (+ 5% progression)
```

**Deload Week**
- Every 4 weeks: reduce weight by 10%, lower volume
- Prevents overtraining, allows recovery, prevents injury
- Auto-triggered by trainer in template

#### 3.8.4 Template Versioning

**Versioning System**
- Templates versioned: v1.0, v1.1, v2.0
- Track changes: "Updated exercise order for flow", "Increased weight on day 2"
- Version created when: trainer edits, bug fix, enhancement
- Active version: latest used for new assignments
- Assigned version: frozen when assigned to member (no auto-updates)

**Member Template Assignment**
- Trainer creates plan from template v1.5
- Member follows plan for 12 weeks
- If trainer updates template to v1.6: no effect on member's active plan
- At completion: trainer can assign new version

#### 3.8.5 Diet Templates

**Macro Calculator**
- Inputs: member weight, goal (bulk/cut/maintain), activity level
- TDEE calculation: Harris-Benedict formula
- Macro split: protein 30%, carbs 45%, fat 25% (configurable)
- Daily targets: e.g., "3000 cal, 225g protein, 338g carbs, 100g fat"

**Diet Template Structure**
```
Template: "High Protein Fat Loss - 2000 cal/day"
Duration: 12 weeks
Goal: Weight loss
Calorie target: 2000 cal/day
Macros: P 180g (36%), C 200g (40%), F 55g (24%)

Meal 1: Breakfast
├─ Eggs (3) + 2 toast
├─ Cals: 450, P: 18g, C: 35g, F: 20g

Meal 2: Mid-morning snack
├─ Protein shake (whey)
├─ Cals: 180, P: 30g, C: 5g, F: 2g

Meal 3: Lunch
├─ Chicken breast 200g + brown rice 150g + broccoli
├─ Cals: 580, P: 52g, C: 62g, F: 8g

Meal 4: Pre-workout
├─ Apple + almond butter
├─ Cals: 220, P: 8g, C: 25g, F: 10g

Meal 5: Dinner
├─ Fish 200g + sweet potato + salad
├─ Cals: 480, P: 50g, C: 60g, F: 8g

Meal 6: Evening snack
├─ Greek yogurt + berries
├─ Cals: 170, P: 22g, C: 13g, F: 2g

Daily Totals: 2080 cal, P: 180g, C: 200g, F: 50g
```

**Meal Library**
- 200+ pre-built meals with macros
- Searchable: by meal type, calories, cuisine
- Member can customize: swap meals, adjust portions
- Favorite meals: quick reorder

#### 3.8.6 Meal Prep Suggestions

**Smart Prep Plans**
- Generate 5-day meal prep shopping list
- Group by grocery section (proteins, produce, etc.)
- Recipes: detailed preparation instructions
- Estimated prep time: "Prepares in 3 hours on Sunday"

**Shopping List Export**
- Format: PDF, can check off items
- Grouped by store section
- Estimated cost: "₹2500 for 5 days"
- Alternative options: "No chicken? Try turkey -₹200"

#### 3.8.7 Supplement Tracking

**Supplement Management**
- Library: protein, creatine, BCAA, multivitamin, etc.
- Member tracks daily intake: "Whey protein 2 scoops, Creatine 5g"
- Schedule: daily, weekdays, weekend
- Cost tracking: price per serving
- Compliance: "This week 6/7 days taken"

**Supplement Info**
- Dosage: recommended, upper limit
- Timing: pre/post workout, with meals
- Form: powder, pill, liquid
- Brand options: price comparison
- Notes: benefits, potential side effects

---

### 3.9 Notifications System (Enhanced)

#### 3.9.1 Notification Types & Channels

**Channels**
- **Push Notification**: via Firebase Cloud Messaging (FCM)
- **Email**: SMTP (SendGrid or similar)
- **SMS**: Twilio or similar provider
- **In-App**: stored in database, displayed in app

**Notification Types**

| Type | Triggers | Channels | Example |
|------|----------|----------|---------|
| **Attendance** | Checkin reminder, late entry, streak milestone | Push, Email | "Your class starts in 1 hour" |
| **Booking** | Booking confirmed, class cancelled, waitlist promoted | Push, Email, SMS | "Your class with Trainer X is confirmed" |
| **Payment** | Renewal reminder, failed payment, refund processed | Email, SMS | "Payment failed. Update card?" |
| **Training** | PT session reminder, session cancelled, progress milestone | Push, Email | "Session tomorrow at 6 PM" |
| **Membership** | Expiry reminder, freeze ending, plan upgrade offer | Email, SMS, Push | "Your membership expires in 7 days" |
| **Admin** | Member joined, high-value action, abuse flag | In-App, Email | "New premium member registered" |

#### 3.9.2 Notification Preferences

**Granular Control**
- Per notification type: enable/disable
- Per channel: enable/disable
- Quiet hours: "Don't notify 10 PM - 8 AM"
- Digest mode: "Combine notifications, send once daily at 9 AM"

**Preference Schema**
```json
{
  "member_id": "member_123",
  "preferences": {
    "attendance": {
      "enabled": true,
      "push": true,
      "email": true,
      "sms": false
    },
    "payment": {
      "enabled": true,
      "push": false,
      "email": true,
      "sms": true
    },
    "quiet_hours": {
      "enabled": true,
      "start": "22:00",
      "end": "08:00"
    },
    "digest_mode": {
      "enabled": false,
      "frequency": "daily",
      "time": "09:00"
    }
  }
}
```

#### 3.9.3 Notification Templates

**Template System**
- Predefined templates for common notifications
- Variables: member_name, trainer_name, class_name, date, time
- Multi-language support (for future)

**Example Template**
```
Template: "Class Reminder"
Subject: "{{class_name}} starts in 1 hour"
Body: "Hi {{member_name}},

Your {{class_name}} class with {{trainer_name}} is starting in 1 hour at {{time}}.

See you there!
- {{gym_name}}"

Email: yes
Push: yes
SMS: optional (if member opted in)
```

#### 3.9.4 In-App Notification Center

**Notification Center Features**
- Chronological list of notifications (newest first)
- Mark as read/unread
- Delete individual notification
- Clear all (with confirmation)
- Filter: by type, date range, read status

**Notification Display**
```
- [New] Class "Spin & Burn" confirmed for Apr 15, 6 PM
- Payment failed. Update your card? [ACTION]
- You completed a 7-day attendance streak! [BADGE]
- Trainer X started following you
```

#### 3.9.5 Delayed/Scheduled Notifications

**Use Cases**
- Class reminder: 24 hours before and 1 hour before
- Payment due: 7 days before, 1 day before, on due date
- Renewal reminder: 14 days, 7 days, 1 day before

**Implementation**
- Store notification with scheduled_for timestamp
- Background job runs every minute, checks scheduled notifications
- Send if time >= scheduled_for and not already sent
- Mark as sent to prevent duplicates

---

### 3.10 Analytics & Reporting (Enhanced)

#### 3.10.1 Dashboard KPIs

**Member Dashboard**
- Attendance: this week, this month, streak
- Classes: upcoming, completed, waitlisted
- PT sessions: upcoming, completed, progress
- Body metrics: weight, measurements, progress chart
- Workout performance: PRs, recent sessions
- Goals: progress towards target

**Trainer Dashboard**
- Schedule: upcoming sessions today, this week
- Member count: assigned members, new this month
- Class roster: next class details, no-shows
- Ratings: average rating, recent reviews
- Earnings: this month (if commission-based)

**Manager Dashboard**
- Key metrics:
  - Active members: total, new this month, churn
  - Revenue: this month, YTD, monthly trend
  - Utilization: daily occupancy, peak hours, class attendance rate
  - Classes: most popular, highest rated, lowest attendance
  - PT: revenue, hours booked, trainer utilization
- Alerts: low attendance warnings, payment failures, equipment maintenance due

**Admin Dashboard**
- System health: uptime, API latency, database connections
- Business metrics: detailed breakdown by facility, segment
- Financial: total revenue, outstanding payments, refunds
- Members: growth trend, retention rate, churn rate
- Staffing: trainer utilization, class allocation

#### 3.10.2 Custom Reports

**Configurable Reports**
- Date range: week, month, quarter, year, custom
- Filters: by facility, member segment, trainer, class type
- Metrics: select from 30+ available
- Format: table, chart, summary
- Export: PDF, CSV, Excel

**Available Metrics**
- Attendance: total visits, unique members, visits per member, peak times
- Classes: bookings, attendance rate, no-show rate, ratings, revenue
- PT: bookings, attendance rate, no-show rate, revenue, hours
- Members: new, active, paused, cancelled, churn rate
- Revenue: subscriptions, PT, classes, other; by payment method
- Payments: total, average, failed rate, refunds, overdue balance

#### 3.10.3 Export Formats

**PDF Reports**
- Branded: gym name, logo, date
- Charts: attendance trend, revenue by source
- Tables: member list, payment details
- Summary: key metrics, month-over-month comparison

**CSV Export**
- Comma-separated, importable to Excel/Google Sheets
- Includes all rows and columns without aggregation
- Example: attendance_report_Apr2024.csv with 5000+ rows

**Excel Export**
- Multiple sheets: summary, details, charts
- Formatted: colors, borders, conditional formatting
- Pivot-ready: proper column headers, data types

#### 3.10.4 Scheduled Reports

**Automated Reports**
- Configure once: "Weekly attendance report every Monday 9 AM"
- Report generated, emailed to specified recipients
- Frequency: daily, weekly, monthly, quarterly
- Recipients: manager, admin, owner
- Format: PDF preferred (can switch to CSV)

**Report Scheduling**
- Time: choose time (in facility timezone)
- Recipients: email list, supports multiple
- Enabled/disabled toggle
- Edit anytime without disruption

#### 3.10.5 KPI Dashboards

**Dashboards** (customizable widgets)

**Member Retention Dashboard**
- Churn rate: this month, trend (6-month)
- Retention cohort: members joined 3/6/12 months ago, still active %
- Cancellation reasons: pie chart breakdown
- At-risk members: low attendance recently (manual review)
- Win-back: offers to cancelled members who rejoined

**Revenue Dashboard**
- Total revenue: this month, YTD, comparison to last year
- Revenue by source: subscriptions, PT, classes, products
- Average revenue per member: member tier, trend
- Revenue forecast: projected YTD based on current pace

**Fitness Progress Dashboard**
- Member goals achieved: # members hit weight loss goal, etc.
- Strength progression: average weight increase by exercise
- Attendance consistency: # members with streaks
- Body transformation: # members with significant progress

#### 3.10.6 Churn Prediction

**At-Risk Scoring** (future ML feature)
- Factors: declining attendance, missed sessions, payment failures
- Score 1-100: green (low risk), yellow (medium), red (high)
- Automated: calculated weekly
- Action: send re-engagement offer to red-flagged members

**Predictive Actions**
- Members with score > 70 (high risk): email with "We miss you" offer
- Offer: 20% discount to renew, free PT session, upgrade at same price
- Track: conversion rate, identify most effective offers

---

### 3.11 New Module: Communication Hub

#### 3.11.1 Member Announcements

**Announcement Types**
- **Facility-wide**: announcement visible to all members
- **Segment-based**: target by membership tier, fitness goal, engagement level
- **Group-specific**: private message to specific member list
- **Trainer-to-member**: personal message from trainer

**Announcement Creation**
- Title, body (rich text: bold, links, images)
- Schedule: immediate or future date/time
- Audience: select segment or manually add members
- Channels: in-app banner, email, push notification
- Metrics: views, clicks, engagement

**Example Announcements**
- "New Strength Training Coach Joins Us" (facility-wide)
- "Spring Special: ₹999 for 10 classes" (all members)
- "Advanced Yoga Series Starts Next Week" (intermediate+ yoga members)
- "Your trainer recommend you try CrossFit" (personal, from trainer)

#### 3.11.2 Targeted Messaging by Segment

**Segmentation**
- Membership tier: basic, standard, premium
- Fitness goal: weight loss, muscle gain, endurance, flexibility
- Activity level: very active (5+ visits/week), active (3-5), occasional (1-2), inactive (< 1)
- Tenure: new (< 1 month), regular (1-12 months), loyal (> 1 year)
- Payment status: paid, overdue, failed payment

**Messaging Campaigns**

| Segment | Message | Goal | Frequency |
|---------|---------|------|-----------|
| New Members | "Welcome! Here's your first PT session free" | Onboarding | Once on day 1 |
| Inactive (30+ days) | "We miss you! ₹500 credit to come back" | Reactivation | Monthly |
| Expiring Soon | "Your membership expires in 7 days. Renew now?" | Retention | 7 days before |
| Premium Members | "VIP event: Meet our new strength coach" | Engagement | Quarterly |

#### 3.11.3 WhatsApp Business API Integration

**Setup**
- WhatsApp Business Account registration
- Verify phone number (gym support line)
- Get API access from Meta
- Integration with backend

**Use Cases**
1. **Session Reminders**: "Your session with Trainer X tomorrow at 6 PM"
2. **Payment Reminders**: "Payment due on April 20. Renew now: [link]"
3. **Announcement**: "New batch of Yoga classes starts Monday"
4. **Personalized**: "Hi John, 5 more checkins and you get free PT!"

**WhatsApp Message Format**
- Text: auto-formatted to fit WhatsApp
- Media: images, PDFs (schedule, invoice)
- Interactive buttons: "Renew", "Cancel", "View Schedule"
- Delivery: guaranteed, timestamps, read receipts

**Member Opt-in**
- WhatsApp business messages opt-in via app
- Can disable: settings > notifications > WhatsApp
- Unsubscribe: reply "STOP" (handles regulatory requirement)

#### 3.11.4 Email Campaigns for Renewals

**Renewal Campaign Sequence**

| Days Before Expiry | Email | Content |
|-------------------|-------|---------|
| 14 days | Renewal Reminder #1 | "Your membership expires soon. Renew now?" |
| 7 days | Renewal Reminder #2 | "Last week to renew at current price" |
| 1 day | Final Reminder | "Final notice: 24 hours left to renew" |
| Day 0 (expiry) | Auto-renew attempt | (if enabled) |
| 3 days after | Win-back offer | "Come back with 50% off first month" |

**Campaign Personalization**
- Member name: "Hi Sarah,"
- Membership type: "Your Premium membership expires..."
- Current streak: "Don't lose your 45-day attendance streak!"
- Upgrade opportunity: "Upgrade to Premium and save ₹500"

**Email Design**
- Branded template with gym logo
- Mobile-responsive
- CTA buttons: "Renew Now", "View Plans", "Pause Membership"
- Unsubscribe link (spam law compliance)

---

### 3.12 New Module: Inventory & Equipment Management

#### 3.12.1 Equipment Tracking

**Equipment Inventory**
- Equipment type: barbell, dumbbell, kettlebell, treadmill, bike, etc.
- Facility: gym location
- Serial number: unique identifier
- Acquisition date: when purchased
- Cost: original purchase price
- Depreciation: 5-year useful life
- Status: active, damaged, maintenance, retired
- Location: equipment bay, room number

**Equipment Master Data**
```
Equipment: "Treadmill Pro 2000"
├─ Serial: TM-001234
├─ Facility: Main Gym
├─ Acquired: 2022-01-15
├─ Cost: ₹150,000
├─ Depreciation: ₹30,000/year
├─ Warranty expiry: 2025-01-15
└─ Location: Cardio Area - Unit 5
```

#### 3.12.2 Maintenance Schedules

**Maintenance Types**
- **Preventive**: routine service (oil, inspect, clean)
- **Corrective**: fix identified issues
- **Predictive**: based on usage hours

**Maintenance Schedule**
- Equipment: treadmill, frequency: every 500 running hours
- Facility: main gym
- Estimated cost: ₹5000
- Vendor: fitness equipment service
- Last maintenance: 2024-03-15, next due: 2024-06-15

**Maintenance Workflow**
```
1. Maintenance due: system alerts 7 days before
2. Manager schedules: select equipment, date, vendor
3. Ticket created: date, assigned vendor, parts needed
4. Execution: vendor performs maintenance, logs work
5. Sign-off: manager approves, marks complete
6. Invoice: received and paid, expense recorded
7. History: maintenance log updated, next due date calculated
```

**Maintenance History**
- Equipment, date, type, cost, vendor, notes
- Track: downtime, recurring issues, replacement candidates

#### 3.12.3 Equipment Usage Logging

**Usage Tracking** (optional, IoT-enabled equipment)
- Connected equipment (smart treadmill, smart bike): logs usage via API
- Usage data: member_id, duration, calories, date, time
- Aggregated: equipment utilization rate, popular times
- Alert: if equipment > 8 hours daily (overuse)

**Usage Metrics**
- Total hours used: last month, all-time
- Peak times: highest usage (inform scheduling)
- Utilization rate: hours in use / hours available
- Maintenance prediction: hours to next maintenance

**Equipment Retirement**
- After 10 years or 10,000 hours: consider retirement
- Alert admin: "Treadmill X due for replacement"
- Replacement: purchase new, set up in same location
- Old equipment: donate, sell, or scrap
- Log: retirement date, disposition, salvage value

---

## 4. Enhanced Database Schema

### 4.1 Core Tables

#### users
```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE,
  gender ENUM('M', 'F', 'Other') DEFAULT NULL,
  role ENUM('admin', 'manager', 'trainer', 'trainer_assistant', 'member') NOT NULL,
  status ENUM('active', 'inactive', 'suspended', 'locked') DEFAULT 'active',
  profile_photo_url VARCHAR(500),
  bio TEXT,
  facility_id BIGINT,
  
  -- Enhanced fields
  height_cm INT,
  weight_kg DECIMAL(5, 2),
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(50),
  health_declaration JSON,
  communication_preferences JSON,
  
  -- Account security
  failed_login_attempts INT DEFAULT 0,
  locked_until DATETIME,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at DATETIME,
  phone_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at DATETIME,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_method ENUM('totp', 'sms'),
  
  -- Soft delete
  deleted_at DATETIME,
  deletion_reason ENUM('gdpr_request', 'account_closure', 'admin_removal', 'spam'),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_email (email),
  INDEX idx_phone (phone),
  INDEX idx_role (role),
  INDEX idx_facility (facility_id),
  INDEX idx_deleted_at (deleted_at),
  INDEX idx_status (status)
);
```

#### members
```sql
CREATE TABLE members (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNIQUE NOT NULL,
  facility_id BIGINT NOT NULL,
  member_code VARCHAR(20) UNIQUE,
  membership_status ENUM('active', 'paused', 'expired', 'cancelled') DEFAULT 'active',
  current_plan_id BIGINT,
  current_subscription_id BIGINT,
  joined_date DATE NOT NULL,
  member_notes TEXT,
  member_tags JSON,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (current_plan_id) REFERENCES plans(id),
  FOREIGN KEY (current_subscription_id) REFERENCES subscriptions(id),
  UNIQUE KEY uk_user_facility (user_id, facility_id),
  INDEX idx_facility (facility_id),
  INDEX idx_status (membership_status),
  INDEX idx_joined_date (joined_date)
);
```

#### plans
```sql
CREATE TABLE plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type ENUM('basic', 'standard', 'premium', 'corporate', 'trial') DEFAULT 'standard',
  billing_period_days INT NOT NULL (30),
  price_amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Features
  max_classes_per_month INT DEFAULT NULL,
  max_pt_sessions_per_month INT DEFAULT NULL,
  group_class_access BOOLEAN DEFAULT TRUE,
  pt_access BOOLEAN DEFAULT FALSE,
  locker_access BOOLEAN DEFAULT TRUE,
  facility_access BOOLEAN DEFAULT TRUE,
  
  auto_renew ENABLED BOOLEAN DEFAULT TRUE,
  grace_period_days INT DEFAULT 3,
  cancellation_notice_days INT DEFAULT 7,
  
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility (facility_id),
  INDEX idx_active (is_active)
);
```

#### subscriptions
```sql
CREATE TABLE subscriptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'paused', 'expired', 'cancelled') DEFAULT 'active',
  paused_at DATETIME,
  paused_until_date DATE,
  pause_reason VARCHAR(200),
  
  -- Pricing
  original_amount DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  promo_code_id BIGINT,
  final_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Auto-renewal
  auto_renew BOOLEAN DEFAULT TRUE,
  last_payment_id BIGINT,
  next_renewal_date DATE,
  
  cancelled_at DATETIME,
  cancellation_reason VARCHAR(200),
  cancellation_feedback TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id),
  FOREIGN KEY (last_payment_id) REFERENCES payments(id),
  INDEX idx_member (member_id),
  INDEX idx_status (status),
  INDEX idx_next_renewal (next_renewal_date)
);
```

#### attendance_logs
```sql
CREATE TABLE attendance_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  check_in_time DATETIME NOT NULL,
  check_out_time DATETIME,
  check_in_method ENUM('qr', 'rfid', 'manual', 'auto', 'geofence') DEFAULT 'qr',
  check_in_by_user_id BIGINT,
  
  -- Device integration
  device_id VARCHAR(100),
  anti_passback_checked BOOLEAN DEFAULT TRUE,
  
  duration_minutes INT GENERATED ALWAYS AS (TIMESTAMPDIFF(MINUTE, check_in_time, check_out_time)),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (check_in_by_user_id) REFERENCES users(id),
  FOREIGN KEY (device_id) REFERENCES devices(id),
  INDEX idx_member_date (member_id, DATE(check_in_time)),
  INDEX idx_facility_date (facility_id, DATE(check_in_time)),
  INDEX idx_check_in_time (check_in_time)
);
```

#### payments
```sql
CREATE TABLE payments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  subscription_id BIGINT,
  invoice_id BIGINT,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_method ENUM('credit_card', 'debit_card', 'upi', 'netbanking', 'wallet') DEFAULT 'credit_card',
  
  -- Gateway integration
  gateway_provider ENUM('razorpay', 'stripe', 'paypal') DEFAULT 'razorpay',
  gateway_payment_id VARCHAR(100),
  gateway_order_id VARCHAR(100),
  
  -- Status
  status ENUM('pending', 'authorized', 'captured', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
  status_updated_at DATETIME,
  
  -- Refund
  refund_amount DECIMAL(10, 2) DEFAULT 0,
  refund_reason VARCHAR(200),
  refund_status ENUM('none', 'pending', 'completed', 'failed'),
  
  -- Metadata
  card_last_4 VARCHAR(4),
  notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  INDEX idx_member (member_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_gateway_payment_id (gateway_payment_id)
);
```

#### invoices
```sql
CREATE TABLE invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  member_id BIGINT NOT NULL,
  
  -- Billing info
  billing_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Items
  item_description VARCHAR(255),
  item_amount DECIMAL(10, 2),
  tax_percentage DECIMAL(5, 2),
  tax_amount DECIMAL(10, 2),
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  
  -- Status
  status ENUM('draft', 'issued', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  paid_date DATE,
  
  -- File
  pdf_url VARCHAR(500),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_member (member_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date),
  INDEX idx_invoice_number (invoice_number)
);
```

---

### 4.2 Personal Training Tables

#### pt_packages
```sql
CREATE TABLE pt_packages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  name VARCHAR(100),
  num_sessions INT,
  price_amount DECIMAL(10, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  duration_days INT,
  session_duration_minutes INT DEFAULT 60,
  discount_percentage INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_trainer (trainer_id)
);
```

#### pt_sessions
```sql
CREATE TABLE pt_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT NOT NULL,
  member_id BIGINT,
  package_id BIGINT,
  facility_id BIGINT NOT NULL,
  
  scheduled_start_time DATETIME NOT NULL,
  scheduled_end_time DATETIME NOT NULL,
  session_type ENUM('1-on-1', 'small_group', 'class') DEFAULT '1-on-1',
  group_members BIGINT,
  
  actual_start_time DATETIME,
  actual_end_time DATETIME,
  
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
  cancellation_reason VARCHAR(200),
  cancelled_by BIGINT,
  cancelled_at DATETIME,
  
  -- Session details
  session_notes JSON,
  progress_photos JSON,
  measurements JSON,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL,
  FOREIGN KEY (package_id) REFERENCES pt_packages(id) ON DELETE SET NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (cancelled_by) REFERENCES users(id),
  INDEX idx_trainer_date (trainer_id, DATE(scheduled_start_time)),
  INDEX idx_member (member_id),
  INDEX idx_status (status)
);
```

#### trainer_availability
```sql
CREATE TABLE trainer_availability (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT NOT NULL,
  facility_id BIGINT NOT NULL,
  
  day_of_week INT (0-6, 0 = Sunday),
  start_time TIME,
  end_time TIME,
  session_duration_minutes INT DEFAULT 60,
  break_minutes INT DEFAULT 15,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  UNIQUE KEY uk_trainer_facility_dow (trainer_id, facility_id, day_of_week),
  INDEX idx_trainer (trainer_id)
);
```

#### trainer_blackout_dates
```sql
CREATE TABLE trainer_blackout_dates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(200),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_trainer_date (trainer_id, start_date)
);
```

#### trainer_reviews
```sql
CREATE TABLE trainer_reviews (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  session_id BIGINT,
  
  rating_overall INT (1-5),
  rating_knowledge INT (1-5),
  rating_motivation INT (1-5),
  rating_professionalism INT (1-5),
  
  review_text TEXT,
  would_recommend BOOLEAN,
  
  is_public BOOLEAN DEFAULT TRUE,
  trainer_response TEXT,
  trainer_responded_at DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES pt_sessions(id) ON DELETE SET NULL,
  INDEX idx_trainer (trainer_id),
  INDEX idx_created_at (created_at)
);
```

---

### 4.3 Classes Tables

#### classes
```sql
CREATE TABLE classes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT NOT NULL,
  trainer_id BIGINT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  
  capacity INT NOT NULL,
  booking_limit INT DEFAULT capacity - 2,
  
  duration_minutes INT,
  level ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'all',
  price_per_class DECIMAL(10, 2),
  
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSON,
  recurrence_until_date DATE,
  
  is_active BOOLEAN DEFAULT TRUE,
  display_order INT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  INDEX idx_facility (facility_id),
  INDEX idx_active (is_active)
);
```

#### class_schedules
```sql
CREATE TABLE class_schedules (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_id BIGINT NOT NULL,
  scheduled_start_time DATETIME NOT NULL,
  scheduled_end_time DATETIME NOT NULL,
  
  actual_start_time DATETIME,
  actual_end_time DATETIME,
  
  trainer_id BIGINT,
  substitute_trainer_id BIGINT,
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  cancellation_reason VARCHAR(200),
  cancelled_at DATETIME,
  
  current_bookings INT DEFAULT 0,
  current_occupancy INT DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (substitute_trainer_id) REFERENCES users(id),
  INDEX idx_class (class_id),
  INDEX idx_scheduled_start (scheduled_start_time),
  INDEX idx_status (status)
);
```

#### class_bookings
```sql
CREATE TABLE class_bookings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_schedule_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  
  booking_status ENUM('booked', 'attended', 'cancelled', 'no_show', 'waitlist') DEFAULT 'booked',
  booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  attended_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason VARCHAR(200),
  
  payment_id BIGINT,
  refunded BOOLEAN DEFAULT FALSE,
  refund_amount DECIMAL(10, 2),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (class_schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  UNIQUE KEY uk_schedule_member (class_schedule_id, member_id),
  INDEX idx_member (member_id),
  INDEX idx_status (booking_status)
);
```

#### waitlist
```sql
CREATE TABLE waitlist (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_schedule_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  position INT,
  
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notified_at DATETIME,
  confirmation_deadline DATETIME,
  auto_book BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (class_schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE KEY uk_schedule_member (class_schedule_id, member_id),
  INDEX idx_schedule_position (class_schedule_id, position)
);
```

#### class_ratings
```sql
CREATE TABLE class_ratings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  class_schedule_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  
  rating_trainer INT (1-5),
  rating_difficulty INT (1-3, 1=too easy, 2=just right, 3=too hard),
  rating_pacing INT (1-3, 1=too slow, 2=just right, 3=too fast),
  would_attend_again BOOLEAN,
  
  feedback_text TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (class_schedule_id) REFERENCES class_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE KEY uk_schedule_member (class_schedule_id, member_id)
);
```

---

### 4.4 Training & Diet Templates

#### exercise_library
```sql
CREATE TABLE exercise_library (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50),
  difficulty ENUM('beginner', 'intermediate', 'advanced') DEFAULT 'intermediate',
  
  equipment VARCHAR(200),
  primary_muscle_group VARCHAR(50),
  secondary_muscle_groups JSON,
  
  instructions TEXT,
  video_url VARCHAR(500),
  image_urls JSON,
  
  safety_notes TEXT,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_category (category),
  INDEX idx_muscle (primary_muscle_group)
);
```

#### training_templates
```sql
CREATE TABLE training_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT,
  facility_id BIGINT,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  goal VARCHAR(100),
  level ENUM('beginner', 'intermediate', 'advanced'),
  
  duration_weeks INT,
  sessions_per_week INT,
  session_duration_minutes INT,
  
  version VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
  INDEX idx_public (is_public),
  INDEX idx_trainer (trainer_id)
);
```

#### training_template_days
```sql
CREATE TABLE training_template_days (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  day_number INT (1-7),
  day_name VARCHAR(20),
  focus_area VARCHAR(100),
  duration_minutes INT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (template_id) REFERENCES training_templates(id) ON DELETE CASCADE,
  UNIQUE KEY uk_template_day (template_id, day_number),
  INDEX idx_template (template_id)
);
```

#### training_template_exercises
```sql
CREATE TABLE training_template_exercises (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  day_id BIGINT NOT NULL,
  exercise_id BIGINT NOT NULL,
  
  sets INT,
  reps_min INT,
  reps_max INT,
  weight_kg DECIMAL(6, 2),
  rest_seconds INT,
  notes TEXT,
  order_index INT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (day_id) REFERENCES training_template_days(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise_library(id),
  INDEX idx_day (day_id)
);
```

#### diet_templates
```sql
CREATE TABLE diet_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trainer_id BIGINT,
  facility_id BIGINT,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  goal VARCHAR(100),
  
  daily_calories INT,
  protein_grams INT,
  carbs_grams INT,
  fat_grams INT,
  
  duration_weeks INT,
  version VARCHAR(20),
  
  is_active BOOLEAN DEFAULT TRUE,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
  INDEX idx_public (is_public)
);
```

#### diet_template_meals
```sql
CREATE TABLE diet_template_meals (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  meal_number INT (1-6),
  meal_name VARCHAR(50),
  
  calories INT,
  protein_grams INT,
  carbs_grams INT,
  fat_grams INT,
  
  description TEXT,
  order_index INT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (template_id) REFERENCES diet_templates(id) ON DELETE CASCADE,
  INDEX idx_template (template_id)
);
```

#### member_training_plans
```sql
CREATE TABLE member_training_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  trainer_id BIGINT NOT NULL,
  template_id BIGINT,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'completed', 'on_hold', 'cancelled') DEFAULT 'active',
  
  goal_description TEXT,
  goal_target_value DECIMAL(10, 2),
  goal_metric VARCHAR(50),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES training_templates(id),
  INDEX idx_member_status (member_id, status)
);
```

#### member_training_logs
```sql
CREATE TABLE member_training_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  session_date DATE,
  
  exercise_id BIGINT,
  sets_completed INT,
  reps_completed INT,
  weight_used_kg DECIMAL(6, 2),
  duration_minutes INT,
  
  notes TEXT,
  difficulty ENUM('easy', 'medium', 'hard'),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (plan_id) REFERENCES member_training_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (exercise_id) REFERENCES exercise_library(id),
  INDEX idx_member_date (member_id, session_date)
);
```

#### member_diet_plans
```sql
CREATE TABLE member_diet_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  trainer_id BIGINT NOT NULL,
  template_id BIGINT,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('active', 'completed', 'on_hold', 'cancelled') DEFAULT 'active',
  
  goal_description TEXT,
  goal_target_kg DECIMAL(5, 2),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES diet_templates(id),
  INDEX idx_member_status (member_id, status)
);
```

#### member_diet_logs
```sql
CREATE TABLE member_diet_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  plan_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  log_date DATE,
  
  meal_number INT (1-6),
  meal_description TEXT,
  calories INT,
  protein_grams INT,
  carbs_grams INT,
  fat_grams INT,
  
  notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (plan_id) REFERENCES member_diet_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  INDEX idx_member_date (member_id, log_date)
);
```

---

### 4.5 System Tables

#### devices
```sql
CREATE TABLE devices (
  id VARCHAR(100) PRIMARY KEY,
  facility_id BIGINT NOT NULL,
  device_type ENUM('turnstile', 'qr_scanner', 'rfid_reader') NOT NULL,
  device_name VARCHAR(100),
  location VARCHAR(100),
  
  api_key VARCHAR(100) UNIQUE NOT NULL,
  api_key_last_rotated DATETIME,
  
  last_sync_time DATETIME,
  sync_status ENUM('online', 'offline', 'error'),
  offline_memory_used INT,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility (facility_id),
  INDEX idx_api_key (api_key)
);
```

#### api_keys
```sql
CREATE TABLE api_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  device_id VARCHAR(100),
  
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100),
  
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  rotated_at DATETIME,
  expires_at DATETIME,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (device_id) REFERENCES devices(id),
  INDEX idx_user (user_id),
  INDEX idx_expires (expires_at)
);
```

#### notifications
```sql
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  recipient_id BIGINT NOT NULL,
  notification_type VARCHAR(50),
  
  title VARCHAR(255),
  body TEXT,
  data JSON,
  
  channel ENUM('push', 'email', 'sms', 'in_app') DEFAULT 'push',
  
  sent_at DATETIME,
  read_at DATETIME,
  delivery_status ENUM('pending', 'sent', 'delivered', 'failed') DEFAULT 'pending',
  
  scheduled_for DATETIME,
  retry_count INT DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_recipient (recipient_id),
  INDEX idx_type (notification_type),
  INDEX idx_read_at (read_at)
);
```

#### notification_preferences
```sql
CREATE TABLE notification_preferences (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNIQUE NOT NULL,
  
  attendance_enabled BOOLEAN DEFAULT TRUE,
  attendance_push BOOLEAN DEFAULT TRUE,
  attendance_email BOOLEAN DEFAULT TRUE,
  attendance_sms BOOLEAN DEFAULT FALSE,
  
  payment_enabled BOOLEAN DEFAULT TRUE,
  payment_push BOOLEAN DEFAULT FALSE,
  payment_email BOOLEAN DEFAULT TRUE,
  payment_sms BOOLEAN DEFAULT TRUE,
  
  membership_enabled BOOLEAN DEFAULT TRUE,
  membership_push BOOLEAN DEFAULT TRUE,
  membership_email BOOLEAN DEFAULT TRUE,
  membership_sms BOOLEAN DEFAULT FALSE,
  
  booking_enabled BOOLEAN DEFAULT TRUE,
  booking_push BOOLEAN DEFAULT TRUE,
  booking_email BOOLEAN DEFAULT TRUE,
  booking_sms BOOLEAN DEFAULT FALSE,
  
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  digest_mode_enabled BOOLEAN DEFAULT FALSE,
  digest_frequency ENUM('daily', 'weekly') DEFAULT 'daily',
  digest_time TIME DEFAULT '09:00:00',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
);
```

#### promo_codes
```sql
CREATE TABLE promo_codes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT,
  code VARCHAR(50) UNIQUE NOT NULL,
  
  discount_type ENUM('percentage', 'fixed_amount', 'free_month', 'bogo') DEFAULT 'percentage',
  discount_value DECIMAL(10, 2),
  
  max_uses INT DEFAULT NULL,
  max_uses_per_member INT DEFAULT 1,
  current_uses INT DEFAULT 0,
  
  valid_from DATE,
  valid_until DATE,
  
  applicable_plans JSON,
  applicable_roles JSON,
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_by_user_id BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  INDEX idx_code (code),
  INDEX idx_active (is_active)
);
```

#### promo_code_usage
```sql
CREATE TABLE promo_code_usage (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  promo_code_id BIGINT NOT NULL,
  member_id BIGINT NOT NULL,
  subscription_id BIGINT,
  
  discount_amount DECIMAL(10, 2),
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL,
  UNIQUE KEY uk_member_promo (member_id, promo_code_id),
  INDEX idx_promo (promo_code_id)
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id BIGINT,
  
  old_values JSON,
  new_values JSON,
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user (user_id),
  INDEX idx_resource (resource_type, resource_id),
  INDEX idx_created_at (created_at)
);
```

#### settings
```sql
CREATE TABLE settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT,
  
  setting_key VARCHAR(100) UNIQUE,
  setting_value JSON,
  description TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility (facility_id)
);
```

#### payment_outstanding
```sql
CREATE TABLE payment_outstanding (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  member_id BIGINT NOT NULL,
  amount_due DECIMAL(10, 2),
  due_date DATE,
  reason VARCHAR(200),
  
  reminder_sent_count INT DEFAULT 0,
  last_reminder_sent DATETIME,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE KEY uk_member_due (member_id, due_date),
  INDEX idx_due_date (due_date),
  INDEX idx_days_overdue (due_date)
);
```

#### equipment
```sql
CREATE TABLE equipment (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  facility_id BIGINT NOT NULL,
  
  equipment_type VARCHAR(50),
  model VARCHAR(100),
  serial_number VARCHAR(100) UNIQUE,
  
  acquisition_date DATE,
  acquisition_cost DECIMAL(10, 2),
  useful_life_years INT DEFAULT 5,
  
  status ENUM('active', 'damaged', 'maintenance', 'retired') DEFAULT 'active',
  location VARCHAR(100),
  
  warranty_expiry DATE,
  notes TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (facility_id) REFERENCES facilities(id),
  INDEX idx_facility (facility_id),
  INDEX idx_status (status)
);
```

#### equipment_maintenance
```sql
CREATE TABLE equipment_maintenance (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  equipment_id BIGINT NOT NULL,
  
  maintenance_type ENUM('preventive', 'corrective', 'predictive') DEFAULT 'preventive',
  scheduled_date DATE,
  completed_date DATE,
  
  vendor_name VARCHAR(100),
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  
  description TEXT,
  parts_replaced TEXT,
  
  status ENUM('scheduled', 'in_progress', 'completed', 'cancelled') DEFAULT 'scheduled',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
  INDEX idx_equipment (equipment_id),
  INDEX idx_scheduled_date (scheduled_date)
);
```

#### facilities
```sql
CREATE TABLE facilities (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(50),
  state VARCHAR(50),
  postal_code VARCHAR(20),
  country VARCHAR(50),
  
  phone VARCHAR(20),
  email VARCHAR(255),
  
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  geofence_radius_meters INT DEFAULT 50,
  
  max_capacity INT DEFAULT 200,
  
  opening_time TIME DEFAULT '06:00:00',
  closing_time TIME DEFAULT '22:00:00',
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_city_state (city, state)
);
```

---

## 5. Enhanced API Design

### 5.1 API Standards & Conventions

#### 5.1.1 Base URL & Versioning

```
Development:  http://localhost:8080/api/v1
Staging:      https://staging-api.gym.local/api/v1
Production:   https://api.gym.local/api/v1
```

All endpoints are prefixed with `/api/v1`. Future breaking changes will use `/api/v2`.

#### 5.1.2 Standard Response Envelope

All API responses follow this structure:

**Success Response (200, 201, 204)**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@gym.com"
  },
  "meta": {
    "timestamp": "2024-04-12T14:30:00Z",
    "request_id": "req_abc123def456"
  }
}
```

**Error Response (4xx, 5xx)**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid credentials",
    "details": "Email not found in system"
  },
  "meta": {
    "timestamp": "2024-04-12T14:30:00Z",
    "request_id": "req_abc123def456"
  }
}
```

**Paginated Response**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Member 1" },
    { "id": 2, "name": "Member 2" }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 245,
      "total_pages": 13,
      "has_next": true,
      "has_prev": false
    },
    "timestamp": "2024-04-12T14:30:00Z",
    "request_id": "req_abc123def456"
  }
}
```

#### 5.1.3 Error Code Taxonomy

| Category | Code | HTTP Status | Description |
|----------|------|-------------|-------------|
| **Authentication** | AUTH_001 | 401 | Invalid credentials |
| | AUTH_002 | 401 | Token expired |
| | AUTH_003 | 401 | Token invalid |
| | AUTH_004 | 401 | Account locked |
| **Authorization** | AUTHZ_001 | 403 | Permission denied |
| | AUTHZ_002 | 403 | Resource access denied |
| **Member** | MBR_001 | 404 | Member not found |
| | MBR_002 | 409 | Email already registered |
| | MBR_003 | 400 | Invalid phone number |
| **Subscription** | SUB_001 | 404 | Subscription not found |
| | SUB_002 | 409 | Subscription already active |
| | SUB_003 | 400 | Invalid plan |
| **Payment** | PAY_001 | 400 | Payment failed |
| | PAY_002 | 409 | Duplicate payment |
| | PAY_003 | 402 | Insufficient funds |
| **Class** | CLASS_001 | 404 | Class not found |
| | CLASS_002 | 409 | Class full |
| | CLASS_003 | 400 | Booking already exists |
| **PT** | PT_001 | 404 | Session not found |
| | PT_002 | 409 | Trainer unavailable |
| **Validation** | VAL_001 | 400 | Required field missing |
| | VAL_002 | 400 | Invalid data type |
| | VAL_003 | 400 | Invalid format |
| **Rate Limit** | LIMIT_001 | 429 | Rate limit exceeded |
| **Server** | SRV_001 | 500 | Internal server error |
| | SRV_002 | 503 | Service unavailable |

#### 5.1.4 Rate Limiting

**Headers**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1712974500
```

**Limits by Endpoint**
- Public endpoints (signup, login): 10 req/min per IP
- Authenticated endpoints: 1000 req/hour per user
- API key endpoints: 10000 req/hour per key
- Turnstile/device endpoints: 100 req/second per device

**429 Response**
```json
{
  "success": false,
  "error": {
    "code": "LIMIT_001",
    "message": "Rate limit exceeded",
    "details": "You have made too many requests. Please try again in 60 seconds."
  },
  "meta": {
    "retry_after": 60
  }
}
```

#### 5.1.5 Pagination

**Query Parameters**
- `page`: 1-indexed page number (default: 1)
- `per_page`: items per page (default: 20, max: 100)
- `sort`: field to sort by, optionally prefixed with `-` for descending (e.g., `-created_at`)

**Example**
```
GET /api/v1/members?page=2&per_page=50&sort=-joined_date
```

**Response**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 2,
      "per_page": 50,
      "total": 2345,
      "total_pages": 47,
      "has_next": true,
      "has_prev": true
    }
  }
}
```

#### 5.1.6 Filtering & Search

**Query Parameters**
- `search`: full-text search across name, email, phone
- `status`: filter by status (active, cancelled, etc.)
- `facility_id`: filter by facility
- `date_from`, `date_to`: date range filters
- Custom filters per endpoint

**Example**
```
GET /api/v1/members?search=john&status=active&facility_id=1&date_from=2024-01-01
```

#### 5.1.7 Request Headers

**Required Headers**
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
X-Request-ID: <unique_request_id>
```

**Optional Headers**
```
X-Facility-ID: 1
Accept-Language: en-US
```

---

### 5.2 Complete API Endpoint Catalog

#### 5.2.1 Authentication Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/auth/signup` | Register new member | None | Public |
| POST | `/auth/login` | Login with email/password | None | Public |
| POST | `/auth/verify-email` | Verify email with OTP | None | Public |
| POST | `/auth/refresh-token` | Refresh access token | Refresh Token | All |
| POST | `/auth/logout` | Logout and revoke tokens | JWT | All |
| POST | `/auth/forgot-password` | Request password reset | None | Public |
| POST | `/auth/reset-password` | Reset password with OTP | OTP | Public |
| POST | `/auth/change-password` | Change password (authenticated) | JWT | All |
| POST | `/auth/2fa-setup` | Setup two-factor authentication | JWT | Admin/Manager |
| POST | `/auth/2fa-verify` | Verify 2FA code | None | Public |

#### 5.2.2 Member Management Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/members` | List all members | JWT | Admin/Manager |
| GET | `/members/:id` | Get member details | JWT | Admin/Manager/Self |
| POST | `/members` | Create new member (admin) | JWT | Admin/Manager |
| PUT | `/members/:id` | Update member profile | JWT | Admin/Manager/Self |
| DELETE | `/members/:id` | Soft delete member | JWT | Admin |
| PUT | `/members/:id/freeze` | Freeze membership | JWT | Admin/Manager/Self |
| PUT | `/members/:id/unfreeze` | Unfreeze membership | JWT | Admin/Manager |
| PUT | `/members/:id/pause` | Pause membership | JWT | Admin/Manager/Self |
| PUT | `/members/:id/resume` | Resume paused membership | JWT | Admin/Manager/Self |
| GET | `/members/:id/profile-photo` | Get member profile photo | JWT | Self/Trainer |
| POST | `/members/:id/profile-photo` | Upload profile photo | JWT | Self/Admin |
| PUT | `/members/:id/health-declaration` | Update health declaration | JWT | Self/Admin |
| GET | `/members/:id/communication-preferences` | Get notification preferences | JWT | Self/Admin |
| PUT | `/members/:id/communication-preferences` | Update notification preferences | JWT | Self/Admin |
| GET | `/members/:id/emergency-contacts` | Get emergency contacts | JWT | Self/Admin |
| PUT | `/members/:id/emergency-contacts` | Update emergency contacts | JWT | Self/Admin |
| GET | `/members/:id/notes` | Get member notes (internal) | JWT | Manager/Trainer |
| POST | `/members/:id/notes` | Add member note | JWT | Manager/Trainer |
| GET | `/members/:id/tags` | Get member tags/segments | JWT | Admin/Manager |
| PUT | `/members/:id/tags` | Update member tags | JWT | Admin/Manager |

#### 5.2.3 Membership & Plan Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/plans` | List all plans | JWT | All |
| GET | `/plans/:id` | Get plan details | JWT | All |
| POST | `/plans` | Create new plan | JWT | Admin |
| PUT | `/plans/:id` | Update plan | JWT | Admin |
| DELETE | `/plans/:id` | Deactivate plan | JWT | Admin |
| GET | `/subscriptions` | List member subscriptions | JWT | Admin/Manager/Self |
| GET | `/subscriptions/:id` | Get subscription details | JWT | Admin/Manager/Self |
| POST | `/subscriptions` | Create new subscription | JWT | Admin/Manager/Public |
| PUT | `/subscriptions/:id` | Update subscription | JWT | Admin/Manager |
| POST | `/subscriptions/:id/pause` | Pause subscription | JWT | Admin/Manager/Self |
| POST | `/subscriptions/:id/resume` | Resume subscription | JWT | Admin/Manager/Self |
| POST | `/subscriptions/:id/cancel` | Cancel subscription | JWT | Admin/Manager/Self |
| POST | `/subscriptions/:id/reactivate` | Reactivate cancelled subscription | JWT | Admin/Manager/Self |
| POST | `/subscriptions/:id/upgrade` | Upgrade subscription | JWT | Admin/Manager/Self |
| POST | `/subscriptions/:id/downgrade` | Downgrade subscription | JWT | Admin/Manager/Self |

#### 5.2.4 Promo Code Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/promo-codes` | List active promo codes | JWT | All |
| GET | `/promo-codes/:code/validate` | Validate promo code | JWT | Public |
| POST | `/promo-codes` | Create new promo code | JWT | Admin |
| PUT | `/promo-codes/:id` | Update promo code | JWT | Admin |
| DELETE | `/promo-codes/:id` | Deactivate promo code | JWT | Admin |
| GET | `/promo-codes/:id/usage` | Get promo code usage stats | JWT | Admin |

#### 5.2.5 Payment Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/payments` | List payments | JWT | Admin/Manager/Self |
| GET | `/payments/:id` | Get payment details | JWT | Admin/Manager/Self |
| POST | `/payments` | Create payment | JWT | Public/Member |
| POST | `/payments/:id/retry` | Retry failed payment | JWT | Admin/Member |
| POST | `/payments/razorpay/callback` | Razorpay webhook callback | Signature | System |
| POST | `/payments/:id/refund` | Request refund | JWT | Admin/Manager/Self |
| GET | `/payments/reconciliation` | Get reconciliation report | JWT | Admin |
| GET | `/invoices` | List invoices | JWT | Admin/Manager/Self |
| GET | `/invoices/:id` | Get invoice details | JWT | Admin/Manager/Self |
| GET | `/invoices/:id/pdf` | Download invoice PDF | JWT | Admin/Manager/Self |
| GET | `/payment-outstanding` | List outstanding payments | JWT | Admin/Manager |
| POST | `/payment-outstanding/:id/reminder` | Send payment reminder | JWT | Admin/Manager |

#### 5.2.6 Attendance Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/attendance/check-in` | Check-in member (QR/RFID/Manual) | JWT | Member/Assistant/Device |
| POST | `/attendance/check-out` | Check-out member | JWT | Member/Device |
| GET | `/attendance/current-occupancy` | Get current gym occupancy | JWT | Manager |
| GET | `/attendance/logs` | Get attendance logs | JWT | Admin/Manager/Self |
| GET | `/attendance/logs/:member_id` | Get member attendance history | JWT | Admin/Manager/Self |
| GET | `/attendance/reports/daily` | Daily attendance report | JWT | Admin/Manager |
| GET | `/attendance/reports/facility-usage` | Facility usage report | JWT | Admin/Manager |
| GET | `/attendance/streaks/:member_id` | Get member attendance streak | JWT | Self/Trainer |

#### 5.2.7 Personal Training Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/pt/packages` | List PT packages | JWT | All |
| GET | `/pt/packages/:id` | Get package details | JWT | All |
| POST | `/pt/packages` | Create PT package | JWT | Trainer/Admin |
| PUT | `/pt/packages/:id` | Update PT package | JWT | Trainer/Admin |
| GET | `/pt/availability` | Get trainer availability | JWT | All |
| POST | `/pt/availability` | Create availability slot | JWT | Trainer |
| PUT | `/pt/availability/:id` | Update availability slot | JWT | Trainer |
| DELETE | `/pt/availability/:id` | Delete availability slot | JWT | Trainer |
| POST | `/pt/blackout-dates` | Set trainer unavailable dates | JWT | Trainer/Admin |
| GET | `/pt/sessions` | List PT sessions | JWT | Admin/Manager/Trainer/Self |
| GET | `/pt/sessions/:id` | Get session details | JWT | Admin/Manager/Trainer/Self |
| POST | `/pt/sessions` | Book PT session | JWT | Member/Admin |
| PUT | `/pt/sessions/:id` | Update session | JWT | Trainer/Admin |
| POST | `/pt/sessions/:id/reschedule` | Reschedule session | JWT | Member/Trainer/Admin |
| POST | `/pt/sessions/:id/cancel` | Cancel session | JWT | Member/Trainer/Admin |
| POST | `/pt/sessions/:id/complete` | Mark session completed | JWT | Trainer |
| POST | `/pt/sessions/:id/notes` | Add session notes | JWT | Trainer |
| POST | `/pt/sessions/:id/photos` | Upload progress photos | JWT | Trainer/Member |
| POST | `/pt/sessions/:id/measurements` | Record measurements | JWT | Trainer |
| GET | `/pt/reviews` | List trainer reviews | JWT | All |
| POST | `/pt/reviews` | Create review | JWT | Member |
| PUT | `/pt/reviews/:id` | Update review | JWT | Member |
| POST | `/pt/reviews/:id/response` | Trainer response to review | JWT | Trainer |

#### 5.2.8 Class & Studio Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/classes` | List all classes | JWT | All |
| GET | `/classes/:id` | Get class details | JWT | All |
| POST | `/classes` | Create class | JWT | Trainer/Admin |
| PUT | `/classes/:id` | Update class | JWT | Trainer/Admin |
| DELETE | `/classes/:id` | Delete class | JWT | Trainer/Admin |
| GET | `/class-schedules` | List class schedules | JWT | All |
| GET | `/class-schedules/:id` | Get schedule details | JWT | All |
| POST | `/class-schedules` | Create class schedule | JWT | Trainer/Admin |
| POST | `/class-schedules/:id/cancel` | Cancel class | JWT | Trainer/Admin |
| GET | `/class-bookings` | List bookings | JWT | Admin/Manager/Self |
| POST | `/class-bookings` | Book class | JWT | Member/Admin |
| POST | `/class-bookings/:id/cancel` | Cancel booking | JWT | Member/Admin |
| POST | `/class-bookings/:id/mark-attended` | Mark attended | JWT | Assistant/Trainer |
| GET | `/waitlist` | Get class waitlist | JWT | Admin/Trainer |
| POST | `/waitlist` | Join waitlist | JWT | Member |
| POST | `/waitlist/:id/cancel` | Leave waitlist | JWT | Member |
| POST | `/waitlist/:id/promote` | Promote from waitlist | JWT | Admin |
| GET | `/class-ratings` | Get class ratings | JWT | All |
| POST | `/class-ratings` | Rate class | JWT | Member |

#### 5.2.9 Training Templates Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/training-templates` | List templates | JWT | All |
| GET | `/training-templates/:id` | Get template details | JWT | All |
| POST | `/training-templates` | Create template | JWT | Trainer/Admin |
| PUT | `/training-templates/:id` | Update template | JWT | Trainer/Admin |
| DELETE | `/training-templates/:id` | Delete template | JWT | Trainer/Admin |
| GET | `/exercise-library` | List exercises | JWT | All |
| GET | `/exercise-library/:id` | Get exercise details | JWT | All |
| POST | `/exercise-library` | Add exercise | JWT | Admin |
| GET | `/member-training-plans` | List member plans | JWT | Admin/Trainer/Self |
| POST | `/member-training-plans` | Assign training plan | JWT | Trainer/Admin |
| PUT | `/member-training-plans/:id` | Update plan | JWT | Trainer/Admin |
| POST | `/member-training-logs` | Log workout | JWT | Member/Trainer |
| GET | `/member-training-logs/:member_id` | Get member workout logs | JWT | Self/Trainer |

#### 5.2.10 Diet Templates Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/diet-templates` | List templates | JWT | All |
| GET | `/diet-templates/:id` | Get template details | JWT | All |
| POST | `/diet-templates` | Create template | JWT | Trainer/Admin |
| PUT | `/diet-templates/:id` | Update template | JWT | Trainer/Admin |
| DELETE | `/diet-templates/:id` | Delete template | JWT | Trainer/Admin |
| POST | `/diet-calculator` | Calculate macros | JWT | All |
| GET | `/member-diet-plans` | List member plans | JWT | Admin/Trainer/Self |
| POST | `/member-diet-plans` | Assign diet plan | JWT | Trainer/Admin |
| PUT | `/member-diet-plans/:id` | Update plan | JWT | Trainer/Admin |
| POST | `/member-diet-logs` | Log meal | JWT | Member |
| GET | `/member-diet-logs/:member_id` | Get member diet logs | JWT | Self/Trainer |

#### 5.2.11 Notification Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/notifications` | Get notifications | JWT | All |
| POST | `/notifications/:id/mark-read` | Mark notification read | JWT | Owner |
| POST | `/notifications/mark-all-read` | Mark all read | JWT | Self |
| DELETE | `/notifications/:id` | Delete notification | JWT | Owner |
| POST | `/notifications/clear` | Clear all notifications | JWT | Self |
| GET | `/notification-preferences` | Get preferences | JWT | Self |
| PUT | `/notification-preferences` | Update preferences | JWT | Self |

#### 5.2.12 Dashboard & Analytics Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/dashboard/member` | Member dashboard | JWT | Member |
| GET | `/dashboard/trainer` | Trainer dashboard | JWT | Trainer |
| GET | `/dashboard/manager` | Manager dashboard | JWT | Manager |
| GET | `/dashboard/admin` | Admin dashboard | JWT | Admin |
| GET | `/reports/attendance` | Attendance report | JWT | Admin/Manager |
| GET | `/reports/revenue` | Revenue report | JWT | Admin/Manager |
| GET | `/reports/members` | Member report | JWT | Admin/Manager |
| GET | `/reports/classes` | Class performance report | JWT | Admin/Manager |
| GET | `/reports/custom` | Custom report | JWT | Admin/Manager |
| GET | `/reports/:id/export` | Export report (PDF/CSV) | JWT | Admin/Manager |
| GET | `/analytics/churn-prediction` | Churn risk scores | JWT | Admin/Manager |
| GET | `/analytics/retention` | Retention metrics | JWT | Admin/Manager |

#### 5.2.13 Device & Integration Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/devices` | Register device | JWT | Admin |
| GET | `/devices/:id` | Get device details | JWT | Admin |
| PUT | `/devices/:id` | Update device | JWT | Admin |
| POST | `/devices/:id/sync` | Sync device data | API Key | Device |
| GET | `/devices/:id/offline-log` | Get offline logs | API Key | Device |
| POST | `/api-keys` | Generate API key | JWT | Admin/Trainer |
| GET | `/api-keys` | List API keys | JWT | Self/Admin |
| DELETE | `/api-keys/:id` | Revoke API key | JWT | Self/Admin |
| POST | `/api-keys/:id/rotate` | Rotate API key | JWT | Self/Admin |

#### 5.2.14 Communication Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| POST | `/announcements` | Create announcement | JWT | Admin/Manager |
| GET | `/announcements` | List announcements | JWT | All |
| GET | `/announcements/:id` | Get announcement | JWT | All |
| PUT | `/announcements/:id` | Update announcement | JWT | Admin/Manager |
| DELETE | `/announcements/:id` | Delete announcement | JWT | Admin/Manager |
| POST | `/campaigns/renewal` | Send renewal campaign | JWT | Admin |
| POST | `/campaigns/reactivation` | Send reactivation campaign | JWT | Admin |
| POST | `/messaging/whatsapp` | Send WhatsApp message | JWT | Admin |
| POST | `/messaging/email` | Send email | JWT | Admin |
| POST | `/messaging/sms` | Send SMS | JWT | Admin |

#### 5.2.15 Inventory Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/equipment` | List equipment | JWT | Admin/Manager |
| GET | `/equipment/:id` | Get equipment details | JWT | Admin/Manager |
| POST | `/equipment` | Add equipment | JWT | Admin |
| PUT | `/equipment/:id` | Update equipment | JWT | Admin |
| DELETE | `/equipment/:id` | Remove equipment | JWT | Admin |
| GET | `/maintenance` | List maintenance records | JWT | Admin/Manager |
| POST | `/maintenance` | Schedule maintenance | JWT | Admin/Manager |
| PUT | `/maintenance/:id` | Update maintenance record | JWT | Admin/Manager |
| GET | `/maintenance/:id/history` | Get maintenance history | JWT | Admin/Manager |

#### 5.2.16 Settings & Admin Endpoints

| Method | Endpoint | Description | Auth | Role |
|--------|----------|-------------|------|------|
| GET | `/settings` | Get settings | JWT | Admin |
| PUT | `/settings` | Update settings | JWT | Admin |
| GET | `/audit-logs` | Get audit logs | JWT | Admin |
| POST | `/facilities` | Create facility | JWT | Admin |
| GET | `/facilities` | List facilities | JWT | Admin |
| PUT | `/facilities/:id` | Update facility | JWT | Admin |
| POST | `/health` | Health check (no auth) | None | Public |

---

## 6. Architecture & Technical Enhancements

### 6.1 Enhanced Backend Structure

```
gym-backend/
├── cmd/
│   └── server/
│       └── main.go                          # Entry point
│
├── internal/
│   ├── app/
│   │   └── app.go                          # App initialization
│   │
│   ├── config/
│   │   ├── config.go                       # Config loading (env/file)
│   │   └── validator.go                    # Config validation
│   │
│   ├── middleware/
│   │   ├── cors.go                         # CORS middleware
│   │   ├── auth.go                         # JWT validation
│   │   ├── rbac.go                         # Role-based access
│   │   ├── ratelimit.go                    # Rate limiting
│   │   ├── request_id.go                   # Request ID injection
│   │   ├── logging.go                      # Structured logging
│   │   ├── recovery.go                     # Panic recovery
│   │   └── request_validation.go           # Request validation
│   │
│   ├── http/
│   │   ├── router.go                       # Route setup
│   │   ├── response.go                     # Response formatting
│   │   ├── request.go                      # Request models
│   │   │
│   │   └── handlers/
│   │       ├── auth.go                     # Auth endpoints
│   │       ├── member.go                   # Member endpoints
│   │       ├── plan.go                     # Plan endpoints
│   │       ├── subscription.go             # Subscription endpoints
│   │       ├── payment.go                  # Payment endpoints
│   │       ├── attendance.go               # Attendance endpoints
│   │       ├── pt.go                       # PT endpoints
│   │       ├── class.go                    # Class endpoints
│   │       ├── training.go                 # Training endpoints
│   │       ├── diet.go                     # Diet endpoints
│   │       ├── notification.go             # Notification endpoints
│   │       ├── dashboard.go                # Dashboard endpoints
│   │       ├── admin.go                    # Admin endpoints
│   │       ├── health.go                   # Health check
│   │       └── device.go                   # Device endpoints
│   │
│   ├── services/
│   │   ├── auth_service.go                 # Auth business logic
│   │   ├── member_service.go               # Member business logic
│   │   ├── subscription_service.go         # Subscription logic
│   │   ├── payment_service.go              # Payment processing
│   │   ├── attendance_service.go           # Attendance logic
│   │   ├── pt_service.go                   # PT business logic
│   │   ├── class_service.go                # Class logic
│   │   ├── training_service.go             # Training template logic
│   │   ├── notification_service.go         # Notification dispatch
│   │   ├── analytics_service.go            # Analytics/reporting
│   │   ├── device_service.go               # Device integration
│   │   ├── email_service.go                # Email sending
│   │   ├── sms_service.go                  # SMS sending
│   │   ├── payment_gateway_service.go      # Gateway integration (Razorpay)
│   │   ├── file_storage_service.go         # File storage
│   │   └── invoice_service.go              # Invoice generation
│   │
│   ├── repositories/
│   │   ├── member_repo.go                  # Member DB queries
│   │   ├── subscription_repo.go            # Subscription queries
│   │   ├── payment_repo.go                 # Payment queries
│   │   ├── attendance_repo.go              # Attendance queries
│   │   ├── class_repo.go                   # Class queries
│   │   ├── pt_repo.go                      # PT queries
│   │   ├── user_repo.go                    # User queries
│   │   ├── notification_repo.go            # Notification queries
│   │   └── [...other repos...]
│   │
│   ├── models/
│   │   ├── member.go                       # Member model
│   │   ├── subscription.go                 # Subscription model
│   │   ├── payment.go                      # Payment model
│   │   ├── user.go                         # User model
│   │   ├── class.go                        # Class model
│   │   └── [...other models...]
│   │
│   ├── dto/
│   │   ├── member_dto.go                   # Request/response DTOs
│   │   ├── subscription_dto.go
│   │   └── [...other DTOs...]
│   │
│   ├── validators/
│   │   ├── email_validator.go              # Email validation
│   │   ├── phone_validator.go              # Phone validation
│   │   ├── membership_validator.go         # Business rule validation
│   │   └── [...other validators...]
│   │
│   ├── errors/
│   │   ├── custom_errors.go                # Custom error types
│   │   └── error_handler.go                # Error handling
│   │
│   ├── utils/
│   │   ├── jwt_util.go                     # JWT generation/validation
│   │   ├── password_util.go                # Password hashing
│   │   ├── pagination_util.go              # Pagination helpers
│   │   ├── file_util.go                    # File handling
│   │   ├── math_util.go                    # Math helpers (tax, proration)
│   │   └── date_util.go                    # Date/time helpers
│   │
│   ├── cache/
│   │   ├── redis.go                        # Redis client
│   │   ├── session_cache.go                # Session caching
│   │   ├── plan_cache.go                   # Plan caching
│   │   └── attendance_cache.go             # Attendance validation cache
│   │
│   ├── jobs/
│   │   ├── job_runner.go                   # Job scheduler
│   │   ├── payment_reminder_job.go         # Payment reminders
│   │   ├── membership_expiry_job.go        # Expiry checks
│   │   ├── notification_job.go             # Notification dispatch
│   │   ├── report_generation_job.go        # Report generation
│   │   ├── payment_reconciliation_job.go   # Reconciliation
│   │   └── attendance_sync_job.go          # Device sync check
│   │
│   └── constants/
│       ├── error_codes.go                  # Error code constants
│       ├── roles.go                        # Role constants
│       └── settings.go                     # App settings
│
├── pkg/
│   ├── jwt/
│   │   └── jwt.go                          # JWT utilities
│   ├── hash/
│   │   └── hash.go                         # Password hashing (bcrypt)
│   ├── pagination/
│   │   └── pagination.go                   # Pagination logic
│   ├── mailer/
│   │   └── mailer.go                       # Email sending abstraction
│   ├── sms/
│   │   └── sms.go                          # SMS sending abstraction
│   ├── payment/
│   │   ├── razorpay.go                     # Razorpay client
│   │   └── gateway.go                      # Payment gateway abstraction
│   ├── storage/
│   │   └── file_storage.go                 # File storage abstraction
│   └── logger/
│       └── logger.go                       # Structured logging
│
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_soft_delete.sql
│   ├── 003_add_audit_logs.sql
│   ├── [...other migrations...]
│   └── manifest.sql                        # Migration manifest
│
├── scripts/
│   ├── db_init.sql                         # DB initialization
│   ├── seed_data.sql                       # Sample data
│   └── db_backup.sh                        # Backup script
│
├── tests/
│   ├── unit/
│   │   ├── service_test.go
│   │   ├── validator_test.go
│   │   └── [...service tests...]
│   ├── integration/
│   │   ├── api_test.go
│   │   ├── repository_test.go
│   │   └── [...integration tests...]
│   └── fixtures/
│       └── test_data.sql                   # Test data
│
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### 6.2 Middleware Pipeline

**Request Flow**

```
HTTP Request
    ↓
[1] Recovery          → Catch panics, return 500
    ↓
[2] CORS              → Validate origin, add headers
    ↓
[3] Request ID        → Generate unique request_id
    ↓
[4] Logging           → Log request (method, path, user)
    ↓
[5] Rate Limit        → Check rate limits (Redis)
    ↓
[6] Auth              → Extract and validate JWT
    ↓
[7] RBAC              → Check role has permission
    ↓
[8] Handler           → Route to appropriate handler
    ↓
Response
```

**Middleware Execution Order**

```go
// router.go
router := http.NewServeMux()
router = applyMiddleware(router,
    recovery.Middleware(),
    cors.Middleware(config),
    logging.Middleware(),
    requestID.Middleware(),
    rateLimit.Middleware(redisClient),
    auth.Middleware(jwtSecret),
    rbac.Middleware(),
)
```

### 6.3 Database Migration Strategy

**Tool**: golang-migrate (standalone CLI + library integration)

**Migration Files**
```
migrations/
├── 001_initial_schema.up.sql
├── 001_initial_schema.down.sql
├── 002_add_soft_delete.up.sql
├── 002_add_soft_delete.down.sql
├── [...]
└── manifest.sql
```

**Version Control**
- Each migration is versioned by timestamp
- Down migrations allow rollback
- Track applied migrations in `schema_migrations` table

**CI Integration**
- On deploy: run pending migrations
- On rollback: run down migrations
- Validation: ensure all migrations pass before deploy

**Example Migration**
```sql
-- 003_add_audit_logs.up.sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  action VARCHAR(100),
  resource_type VARCHAR(50),
  resource_id BIGINT,
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_created (user_id, created_at)
);
```

### 6.4 Caching Strategy

**Redis Use Cases**

| Data | TTL | Purpose |
|------|-----|---------|
| Session tokens | 7 days | Revocation list for logged-out users |
| Access tokens | 15 min | Blacklist for revoked tokens |
| User profiles | 1 hour | Frequently accessed member data |
| Plans | 24 hours | Rarely changing plan definitions |
| Attendance cache | 10 min | Anti-passback validation |
| Rate limit counters | 1 hour | Rate limit enforcement |
| Temporary OTP | 15 min | Password reset OTP storage |
| Turnstile auth | Session | Device API key caching |

**Cache Keys Format**
```
user:{user_id}:profile
plan:{plan_id}
attendance:{member_id}:last_checkin
ratelimit:{ip}:{endpoint}:count
session:{session_id}:revoked
otp:{email}:reset_password
```

**Cache Invalidation**
- Automatic expiry: TTL-based
- Manual invalidation: on data updates
- Event-driven: publish to Redis Pub/Sub on member/plan changes

### 6.5 Background Jobs

**Job Scheduler** (simple Go ticker-based, no external queue)

**Jobs Configured**

| Job | Frequency | Purpose |
|-----|-----------|---------|
| Payment Reminder | Daily 8 AM | Send renewal reminders 7/1 days before expiry |
| Membership Expiry Check | Hourly | Mark expired subscriptions, notify members |
| Notification Dispatch | Every 5 min | Send pending notifications (email, SMS, push) |
| Report Generation | On schedule | Generate and email scheduled reports |
| Payment Reconciliation | Daily 2 AM | Sync payments with Razorpay |
| Device Sync Check | Every 5 min | Verify all devices synced in last 10 min |
| Waitlist Promotion | Real-time | Auto-promote from waitlist on cancellation |
| Session Auto-Checkin | Every 1 min | Auto-check-in members 10 min before class |

**Implementation**
```go
type JobRunner struct {
    jobs []Job
    ticker *time.Ticker
}

func (jr *JobRunner) Start() {
    ticker := time.NewTicker(5 * time.Minute)
    for range ticker.C {
        for _, job := range jr.jobs {
            if job.ShouldRun() {
                go job.Execute()
            }
        }
    }
}
```

### 6.6 File Storage

**Directory Structure**
```
/storage/
├── profiles/
│   ├── 2024/04/
│   │   └── member_123_profile.jpg
│   └── [year]/[month]/[member_id]_profile.[ext]
├── exercises/
│   ├── images/
│   │   └── ex_001.jpg
│   └── videos/
│       └── ex_001.mp4
├── invoices/
│   ├── 2024/04/
│   │   └── INV-2024-001234.pdf
│   └── [year]/[month]/[invoice_id].pdf
├── session_photos/
│   └── [year]/[month]/session_[id]_[photo_num].jpg
└── reports/
    └── [year]/[month]/[report_id].pdf
```

**Upload Validation**
```
Profile Photos:
  - Max size: 2 MB
  - Formats: JPEG, PNG
  - Dimensions: resize to 400x400px

Exercise Videos:
  - Max size: 100 MB
  - Format: MP4
  - Codec: H.264
  - Resolution: 720p

Session Photos:
  - Max size: 5 MB
  - Formats: JPEG, PNG
  - Count: max 10 per session
```

**Storage Backend**
- Default: local filesystem with organized directories
- Future: S3 integration via abstraction layer
- Cleanup: delete orphaned files weekly (no references in DB)

### 6.7 Logging Strategy

**Logging Library**: Go's standard `slog` (1.21+)

**Log Levels**
- ERROR: exceptions, failed operations
- WARN: deprecated usage, potential issues
- INFO: significant events (login, payment, etc.)
- DEBUG: request details, intermediate steps (dev only)

**Structured Logging**
```go
slog.Info("member_created",
    slog.String("member_id", "mbr_123"),
    slog.String("email", "john@gym.com"),
    slog.String("plan", "premium"),
)

// Output:
// 2024-04-12T14:30:00Z INFO member_created member_id=mbr_123 email=john@gym.com plan=premium
```

**Log Format**: JSON (stdout)
```json
{
  "time": "2024-04-12T14:30:00Z",
  "level": "INFO",
  "msg": "member_created",
  "member_id": "mbr_123",
  "email": "john@gym.com",
  "request_id": "req_abc123"
}
```

**Log Destinations**
- stdout: all logs (containerized friendly)
- File: optional, `/var/log/gym-app/app.log` (rotated daily)
- Retention: 30 days

### 6.8 Testing Strategy

**Test Coverage Target**: 70% overall

**Test Types**

**1. Unit Tests** (50% of tests)
- Test individual functions in isolation
- Mock external dependencies
- Target: services, validators, utilities
- Example: `TestBcryptHashPassword()`, `TestPromoCodeValidation()`

**2. Integration Tests** (30% of tests)
- Test interactions between components
- Use test database (SQLite or test MySQL instance)
- Test repositories, services together
- Example: `TestSubscriptionCreationAndPayment()`, `TestAttendanceAntiPassback()`

**3. API Tests** (20% of tests)
- Test HTTP endpoints end-to-end
- Use test server and client
- Validate requests and responses
- Example: `TestMemberSignupFlow()`, `TestClassBooking()`

**Test Structure**
```
tests/
├── unit/
│   ├── auth_test.go
│   ├── payment_validator_test.go
│   └── [...service_test.go...]
├── integration/
│   ├── member_repo_test.go
│   ├── subscription_service_test.go
│   └── [...repo/service_test.go...]
├── api/
│   ├── auth_api_test.go
│   ├── member_api_test.go
│   └── [...api_test.go...]
└── fixtures/
    └── test_data.go
```

**Running Tests**
```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run specific test
go test ./internal/services -run TestMemberService

# Integration tests (with DB)
make test-integration
```

---

## 7. Development Phases & Timeline

### Phase 1: Foundation (Weeks 1-4) — 4 weeks

**Objective**: Establish project infrastructure, core authentication, and basic member management

**Deliverables**
1. Project setup: Go project structure, dependencies, config management
2. Database: MySQL setup, initial schema, migrations
3. Authentication: JWT + refresh token flow, signup/login, password reset
4. Member management: Create, read, update, soft delete
5. Plan management: Create plans, list plans
6. Basic middleware: auth, logging, CORS, error handling
7. Testing framework: unit tests, fixtures

**Milestones**
- Week 1: Project setup, DB ready, basic API scaffolding
- Week 2: Auth endpoints complete, tests passing
- Week 3: Member CRUD endpoints, plan endpoints
- Week 4: Middleware polish, documentation, code review

**Team Required**
- 1 Backend Lead (full-time)
- 1 Backend Developer (full-time)
- 1 DevOps/Database Engineer (part-time, 20%)

**Dependencies**: None (first phase)

---

### Phase 2: Core Operations (Weeks 5-8) — 4 weeks

**Objective**: Implement core gym operations: attendance, payments, subscriptions

**Deliverables**
1. Attendance system: check-in/check-out, anti-passback, geofencing validation
2. External device integration: turnstile API, device registration, offline sync
3. Subscription management: auto-renewal, pause, cancel, upgrade/downgrade
4. Payment processing: Razorpay integration, webhook handling, reconciliation
5. Invoice generation: PDF creation, email delivery
6. Basic notifications: email service, SMS service
7. Dashboard: member and manager views (basic)

**Milestones**
- Week 5: Attendance system core, device integration baseline
- Week 6: Payment processing, invoice generation
- Week 7: Subscription state machine, renewal logic
- Week 8: Notification system, dashboard MVP

**Team Required**
- 1 Backend Lead (full-time)
- 2 Backend Developers (full-time)
- 1 DevOps/Database Engineer (part-time, 20%)

**Dependencies**: Phase 1 complete

---

### Phase 3: Advanced Features (Weeks 9-13) — 5 weeks

**Objective**: Implement personal training, classes, templates, and analytics

**Deliverables**
1. Personal training: availability, booking, sessions, ratings, progress tracking
2. Classes & studio: scheduling, booking, waitlist, cancellations
3. Training templates: exercise library, template creation, progressive overload
4. Diet templates: meal prep, macro calculator, supplement tracking
5. Promo codes & discounts: code creation, validation, usage tracking
6. Analytics: member reports, revenue reports, churn prediction setup
7. Communication hub: announcements, targeted messaging

**Milestones**
- Week 9: PT module core functionality
- Week 10: Class module with waitlist
- Week 11: Templates (training & diet)
- Week 12: Analytics & reporting
- Week 13: Communication hub, integration testing

**Team Required**
- 1 Backend Lead (full-time)
- 2 Backend Developers (full-time)
- 1 QA Engineer (full-time)
- 1 DevOps/Database Engineer (part-time, 30%)

**Dependencies**: Phase 2 complete

---

### Phase 4: Admin Web Panel (Weeks 14-18) — 5 weeks

**Objective**: Build React admin portal covering all backend functionality

**Deliverables**
1. Project setup: React + Vite, Redux/Zustand, API integration
2. Authentication: login, JWT refresh, session management
3. Member management: CRUD, view profiles, bulk operations
4. Subscription management: view, upgrade/downgrade, cancel
5. Class management: create, schedule, view bookings, cancel
6. PT management: view sessions, assign templates, view ratings
7. Payment processing: view payments, generate invoices, refund processing
8. Analytics dashboard: charts, reports, KPI cards
9. Settings: facility settings, user management, system configuration

**Milestones**
- Week 14: Project setup, auth, basic layout
- Week 15: Member & subscription management UI
- Week 16: Class & PT management UI
- Week 17: Analytics & reporting UI
- Week 18: Settings, integration testing, performance optimization

**Team Required**
- 1 Frontend Lead (full-time)
- 2 Frontend Developers (full-time)
- 1 QA Engineer (full-time)
- Backend support (part-time, 20%)

**Dependencies**: Phase 3 complete

---

### Phase 5: Mobile Apps (Weeks 19-24) — 6 weeks

**Objective**: Build Flutter mobile apps for trainers and clients

**Deliverables**
1. **Trainer App**:
   - Session schedule, session management
   - Member profiles, session notes, photos, measurements
   - Availability management
   - Earnings & ratings view
   - Push notifications

2. **Client App**:
   - Authentication, profile
   - Class browsing & booking
   - PT session booking
   - Check-in (QR/geofence)
   - Training plan view, workout logging
   - Diet plan view, meal logging
   - Notifications, settings

3. **Shared**:
   - API client integration
   - Local caching, offline support
   - Push notifications setup
   - Error handling, retry logic

**Milestones**
- Week 19: Project setup, auth, common components
- Week 20: Trainer app core features
- Week 21: Client app core features
- Week 22: Check-in, notifications, offline support
- Week 23: Beta testing, bug fixes
- Week 24: App store submission, optimization

**Team Required**
- 1 Mobile Lead (full-time)
- 2 Mobile Developers (full-time, Flutter)
- 1 QA Engineer (full-time)
- Backend support (part-time, 20%)

**Dependencies**: Phase 3 complete (can start in Week 14 parallel with Phase 4)

---

### Phase 6: Polish & Launch (Weeks 25-28) — 4 weeks

**Objective**: Final integration, testing, optimization, and deployment

**Deliverables**
1. Integration testing: end-to-end workflows across web and mobile
2. Performance optimization: database queries, caching, API response times
3. Security audit: OWASP, data encryption, API key rotation
4. Documentation: API docs (Swagger), user manuals, deployment guide
5. Deployment: systemd setup, production database, monitoring
6. Beta testing: internal team, select users, feedback collection
7. Launch: public availability, marketing, user onboarding

**Milestones**
- Week 25: Integration testing, bug fixes
- Week 26: Performance optimization, security audit
- Week 27: Documentation, deployment setup, beta launch
- Week 28: Production launch, monitoring, post-launch support

**Team Required**
- Full team (all roles) for 1 week
- QA: 2 engineers (full-time, 2 weeks for testing)
- DevOps: 1 engineer (full-time for deployment)
- Backend: 1 lead (part-time for final integration)
- Frontend: 1 lead (part-time for final integration)

**Dependencies**: All previous phases complete

---

### Timeline & Workstream Visualization

```
Week  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28
────────────────────────────────────────────────────────────────────────────────────────
Ph 1  [Foundation - Auth, Members, Plans                                         ]
Ph 2        [Core Ops - Attendance, Payment, Subscription, Dashboard            ]
Ph 3                   [Advanced Features - PT, Classes, Templates, Analytics   ]
Ph 4                                        [Admin Web Panel                    ]
Ph 5                                                    [Mobile Apps - Flutter                 ]
Ph 6                                                                   [Polish & Launch     ]
────────────────────────────────────────────────────────────────────────────────────────
```

**Resource Allocation**

| Role | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Total |
|------|---------|---------|---------|---------|---------|---------|-------|
| Backend Lead | 4w | 4w | 5w | 1w | 1w | 1w | 16w |
| Backend Dev x2 | 4w | 4w | 5w | 2w (support) | 1w (support) | 2w | 18w each |
| Frontend Lead | — | — | — | 5w | 1w | 1w | 7w |
| Frontend Dev x2 | — | — | — | 5w | 2w | 1w | 8w each |
| Mobile Lead | — | — | — | — | 6w | 1w | 7w |
| Mobile Dev x2 | — | — | — | — | 6w | 1w | 7w each |
| QA Engineer | 1w | 2w | 3w | 5w | 3w | 4w | 18w |
| DevOps/DB | 1w | 2w | 2w | 1w | 1w | 2w | 9w |
| **Total Person-Weeks** | | | | | | | **140pw** |

**Recommended Team Composition**
- 1 Backend Lead / Architect
- 2-3 Backend Developers
- 1 Frontend Lead
- 2 Frontend Developers
- 1 Mobile Lead
- 2 Mobile Developers
- 1-2 QA Engineers
- 1 DevOps/Database Engineer
- **Total: 11-12 person team**

**Duration**: 28 weeks (~7 months) for full delivery with this team size

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation Strategy |
|------|-----------|--------|-------------------|
| **Database schema changes during development** | High | High | - Versioned migrations with rollback capability - Schema review process - Test migrations before production |
| **Razorpay API integration delays** | Medium | High | - Early sandbox testing - Maintain Stripe integration alternative - Buffer time in Phase 2 |
| **Payment reconciliation mismatches** | Medium | High | - Comprehensive webhook testing - Daily reconciliation job - Manual audit trail - Finance team review process |
| **Member data privacy/GDPR violations** | Medium | Critical | - Soft delete implementation early - Data retention policy enforcement - Privacy audit by legal - Regular compliance reviews |
| **Attendance anti-passback edge cases** | Low | Medium | - Extensive testing with turnstile vendor - Fallback to manual approval - Real-world device testing - Buffer for edge case fixes |
| **Performance degradation under load** | Medium | High | - Early caching implementation - Database query optimization - Load testing at Phase 4 - Auto-scaling planning |
| **API rate limiting bypasses** | Low | Medium | - Multiple rate limit strategies (IP, user, API key) - Monitoring for suspicious patterns - Progressive backoff - IP blocking for repeat offenders |
| **Team member turnover** | Medium | Medium | - Thorough documentation - Knowledge sharing sessions - Cross-training - Code review culture |
| **Scope creep** | High | Medium | - Strict requirements freezing - Feature flag system for future features - Regular scope reviews - Change control process |
| **Third-party service outages** (Razorpay, SendGrid, Twilio) | Low | Medium | - Fallback payment processing queues - Email retry mechanism - SMS fallback to email - Service health monitoring |
| **Mobile app store approval delays** | Low | Medium | - Early submission to beta testing - Comply with store guidelines from start - Budget extra 2 weeks |
| **Cross-platform compatibility issues** | Medium | Medium | - Early device testing (iOS/Android) - CI/CD for mobile builds - Device testing farm or BrowserStack |
| **Real-time websocket complexity** | Medium | Medium | - Prototype early if needed - Consider polling alternative - Vendor solutions (Firebase) |
| **Complex reporting queries** | Low | Medium | - Analytics database (read replica) for future - Query optimization during Phase 3 - Caching for reports |
| **Security vulnerabilities discovered** | Low | High | - Regular security audits - OWASP Top 10 compliance - Dependency scanning - Bug bounty consideration |
| **Facility timezone management** | Low | Medium | - UTC storage, local display - Comprehensive timezone testing - Configuration per facility |
| **Inventory/equipment tracking complexity** | Low | Medium | - Clear MVP scope - Defer advanced features - Iterative enhancement post-launch |
| **Multi-facility operation conflicts** | Medium | Medium | - Early design review with stakeholders - Comprehensive test scenarios - Facility isolation testing |
| **Session timeout handling** | Low | Medium | - Extensive mobile testing - Graceful re-auth UX - Offline queue for actions |
| **Device offline sync conflicts** | Medium | Medium | - Conflict resolution strategy (last-write-wins) - Full audit trail - Reconciliation tool |

---

## 9. Non-Functional Requirements

### 9.1 Performance

**API Response Times**
- Target: < 200ms at p95 for 90% of endpoints
- Acceptable: 200-500ms for report generation, PDF export
- Unacceptable: > 1 second for any endpoint except exports

**Optimization Strategies**
- Database indexing on frequently queried fields
- Query optimization (JOIN, subquery reduction)
- Caching: Redis for plans, users, attendance validation
- Connection pooling: max 100 connections to MySQL
- Pagination: max 100 items per page (prevent memory overload)

**Dashboard Load Times**
- Member dashboard: < 2 seconds (cached data)
- Manager dashboard: < 3 seconds
- Analytics dashboard: < 4 seconds

**Concurrent User Capacity**
- Target: 500+ concurrent users
- Expected: 50-100 concurrent during peak hours
- Load testing at 1000+ concurrent users

### 9.2 Security

**OWASP Top 10 Compliance**

| Risk | Mitigation |
|------|-----------|
| A01:2021 – Broken Access Control | RBAC middleware, permission checks per endpoint |
| A02:2021 – Cryptographic Failures | HTTPS only, JWT signing, password hashing (bcrypt) |
| A03:2021 – Injection | Parameterized queries (GORM), input validation |
| A04:2021 – Insecure Design | Threat modeling, security by design |
| A05:2021 – Security Misconfiguration | Config validation, secrets in env vars, minimal dependencies |
| A06:2021 – Vulnerable Components | Dependency scanning (dependabot), regular updates |
| A07:2021 – Authentication Failures | Rate limiting, account lockout, 2FA option |
| A08:2021 – Software & Data Integrity | Code review, signed releases, integrity checks |
| A09:2021 – Logging & Monitoring | Structured logging, audit trail, alerting |
| A10:2021 – SSRF | URL validation, domain whitelisting for webhooks |

**Data Security**
- Encryption in transit: HTTPS (TLS 1.3)
- Encryption at rest: database encryption (MySQL encryption), sensitive fields (SSN if stored)
- PCI DSS: no card details stored (tokenization via Razorpay)
- PII protection: PII not logged, secure deletion on request

**API Security**
- Rate limiting: 1000 req/hour per authenticated user
- API key rotation: 90-day rotation policy
- CORS: explicit origin whitelist
- CSRF: token validation for state-changing operations
- Input validation: all inputs validated against schema

**Regular Security Reviews**
- Monthly: dependency updates, security patches
- Quarterly: penetration testing, code audit
- Annually: third-party security audit

### 9.3 Scalability

**Vertical Scaling** (single instance optimization)
- Database: optimize queries, add indexes
- Cache: Redis instance for session/plan data
- Connection pooling: reduce connection overhead
- Asynchronous jobs: off-load heavy operations

**Horizontal Scaling** (for future)
- Stateless API: no in-memory user sessions
- Load balancer: Nginx round-robin
- Database: connection pooling, read replicas
- Cache: centralized Redis

**Database Optimization**
- Key indexes: member_id, facility_id, created_at, status
- Query analysis: slow query log monitoring
- Partitioning: attendance_logs by date (monthly)
- Archival: older data moved to archive DB

**Future Read Replica**
- Read-heavy workloads (reporting) → read replica
- Write → primary, read → replica
- Eventual consistency acceptable for reports

### 9.4 Reliability

**Uptime Target**: 99.5% (4 hours downtime/year)

**Availability Measures**
- Automated backups: daily, retained 30 days
- Backup testing: monthly restore drill
- Health checks: `/health` endpoint (checks DB, cache, services)
- Monitoring: response times, error rates, service availability
- Alerting: email/SMS on critical errors, downtime

**Graceful Degradation**
- Payment failures: queue for retry (not lost)
- Notification delivery: queue for async sending
- External device sync: continue locally, sync when available
- Non-critical services down: core operations continue

**Disaster Recovery Plan**
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 1 hour (data loss acceptable)
- Backup location: separate from primary
- Restore procedure: documented, tested monthly
- Communication: status page, email notification

### 9.5 Usability

**Mobile-First Design**
- React admin: responsive (desktop, tablet, mobile)
- Flutter apps: native Android/iOS UX
- Touch-friendly: buttons > 44x44px
- Accessibility: WCAG 2.1 AA compliance

**Accessibility (WCAG 2.1 AA)**
- Color contrast: 4.5:1 for text
- Keyboard navigation: all functions accessible
- Screen reader support: proper labels, ARIA
- Alt text: all images
- Focus management: visible focus indicators

**Multi-Language Support** (future enhancement)
- UI labels/messages externalizable
- Facility can set default language
- User can select language preference
- Initial: English only

**Offline Capability** (mobile apps)
- Offline-first architecture
- Sync on reconnection
- Queue user actions offline
- Conflict resolution (last-write-wins)

---

## 10. Recommended Development Tools & Practices

### 10.1 Git Branching Strategy (GitFlow)

**Branch Types**
```
main/               → Production releases
  ├─ release/*      → Release candidates
develop/            → Development integration
  ├─ feature/*      → New features
  ├─ bugfix/*       → Bug fixes
  ├─ hotfix/*       → Production critical fixes
```

**Workflow**
1. Feature branch: `feature/member-freeze` off `develop`
2. Development: push commits, open PR
3. Code review: approval required
4. Merge: squash commits, delete branch
5. Release: release branch off `develop`, tag version
6. Hotfix: off `main`, merge to both `main` and `develop`

### 10.2 CI/CD Pipeline (GitHub Actions)

**Triggers**
- On push to feature/develop/main
- On PR to develop/main
- Scheduled: daily at 2 AM

**Pipeline Steps**
```yaml
1. Checkout code
2. Setup Go 1.26
3. Run go fmt (style check)
4. Run go vet (static analysis)
5. Run go test (unit + integration tests)
6. Generate coverage report
7. Build binary (develop/main branches)
8. Docker build + push (main branch)
9. Deploy to staging (main branch)
10. E2E tests against staging
11. Approval gate before production deploy
12. Deploy to production
```

**Quality Gates**
- Tests: all passing
- Coverage: >= 70%
- Style: go fmt compliant
- Lint: no critical issues

### 10.3 Code Review Process

**PR Requirements**
- Minimum 1 approval (lead reviewer)
- All CI checks passing
- No conflicts with develop
- Updated tests for new code

**Review Criteria**
- Code style & readability
- Correctness & edge cases
- Performance impact
- Security implications
- Test coverage

**Approval Flow**
1. Developer: PR with clear description
2. Reviewer: requested changes or approval
3. Developer: address feedback, push updates
4. Reviewer: approve after updates
5. Developer or reviewer: merge and delete branch

### 10.4 API Documentation (Swagger/OpenAPI)

**Tool**: Swagger/OpenAPI 3.0 with swaggo/swag

**Generation**
```go
// Annotated handler
// @Summary Create new member
// @Description Register new gym member
// @Tags Members
// @Accept json
// @Produce json
// @Param request body MemberCreateRequest true "Member data"
// @Success 201 {object} MemberResponse
// @Failure 400 {object} ErrorResponse
// @Router /members [post]
func CreateMember(w http.ResponseWriter, r *http.Request) { ... }
```

**Generated**
- Swagger UI: `/swagger/index.html`
- OpenAPI JSON: `/swagger.json`
- Auto-updated on each commit

### 10.5 Environment Management

**Environments**

| Env | Purpose | Data | Uptime |
|-----|---------|------|--------|
| local | Developer machine | Test data | N/A |
| dev | Shared development | Test data | Relaxed |
| staging | Pre-production | Copy of prod (sanitized) | 99% |
| prod | Live system | Real data | 99.5% |

**Configuration**
```
.env.local      → gitignored, developer settings
.env.dev        → dev server settings
.env.staging    → staging server settings
.env.prod       → production settings (secrets in manager)
```

**Secrets Management**
- GitHub Secrets for CI/CD
- Environment variables at runtime
- Rotation policy: 90 days for API keys
- Audit: log all secrets access

### 10.6 Monitoring & Alerting

**Monitoring Stack**

**Option 1: Prometheus + Grafana**
- Prometheus: scrape metrics from `/metrics` endpoint
- Grafana: dashboards and visualization
- Alerting: alert rules based on metrics

**Option 2: Simple Health Checks** (MVP)
- `/health` endpoint: returns status
- Monitor via cron: check every 5 minutes
- Alert: if 3 consecutive failures

**Key Metrics**
- API latency: p50, p95, p99
- Error rate: 5xx errors per minute
- Database connection pool usage
- Cache hit rate
- Background job execution time
- Payment webhook latency

**Alerts**
- API error rate > 1%: notify ops
- API latency p95 > 500ms: notify backend
- Database connection pool > 90%: notify ops
- Health check fails 3x: page on-call

---

## 11. Conclusion

### Summary of Enhancements

The Gym Management System development plan enhances the original specification with:

1. **Production-Ready Security**: JWT + refresh tokens, 2FA, rate limiting, audit logging, GDPR compliance
2. **Scalable Architecture**: GORM for DB abstraction, Redis caching, background jobs, async notifications
3. **Advanced Features**: promo codes, membership freeze, trainer availability, waitlist system, analytics
4. **Payment Integration**: Razorpay webhooks, reconciliation, partial payments, refund workflow
5. **Communication**: announcements, WhatsApp Business API, email campaigns, notification preferences
6. **Operations**: equipment tracking, maintenance scheduling, device sync, health monitoring
7. **Comprehensive API**: 80+ endpoints with standardized responses, pagination, error codes
8. **Data Governance**: soft delete, data retention policies, audit trails, privacy by design
9. **Testing & Deployment**: CI/CD pipeline, 70% test coverage, zero-downtime deployments
10. **Team Guidance**: realistic timeline (28 weeks), resource allocation, risk mitigation

### Total Estimated Effort

- **Duration**: 28 weeks (~7 months) with 11-12 person team
- **Person-Weeks**: ~140 person-weeks
- **Cost Estimate** (rough): ₹80-120 lakhs (assuming ₹60k/person-week)

### Next Steps

1. **Stakeholder Review**: Present plan to gym owner, validate timeline and budget
2. **Team Assembly**: Hire backend, frontend, mobile, QA, and DevOps roles
3. **Phase 1 Kickoff**: Start project setup, database design, auth implementation
4. **Tool Setup**: GitHub, CI/CD pipeline, monitoring, code review process
5. **Documentation**: Create API specifications, database design docs, user manuals
6. **Risk Management**: Set up risk tracking, regular team standups, demo cycles

### Success Criteria

- [ ] 99.5% uptime post-launch
- [ ] < 200ms API response times (p95)
- [ ] 70%+ test coverage
- [ ] Zero critical security vulnerabilities
- [ ] 500+ concurrent users supported
- [ ] < 2 second dashboard load times
- [ ] 95%+ member adoption of mobile app within 3 months
- [ ] < 5% monthly churn rate

---

**Document Version**: 1.0  
**Last Updated**: April 12, 2024  
**Status**: Ready for Development
