# PRD.md — CamotesDrive (Mobile App + Admin Web)

## Project Overview

**CamotesDrive** is a vehicle rental and driver-hiring platform for the Camotes Islands, Philippines. It has two surfaces:

- **Mobile app (iOS and Android):** used by renters, vehicle owners, and drivers.
- **Admin web panel:** used by platform administrators only.

Both surfaces share one Supabase backend.

## 1. Problem

Finding available rental vehicles and reliable drivers in the Camotes Islands is difficult for travelers. Booking coordination, pricing, availability, and communication are mostly handled manually (calls, chat apps, word of mouth).

CamotesDrive provides one app where renters browse vehicles, book, optionally hire a driver, and manage trips from their phone, while providers manage vehicles, driving jobs, and earnings on the go. Administrators manage trust, payments, and disputes from a web dashboard.

## 2. Target Users and Platforms

| User | Platform | Purpose |
|------|----------|---------|
| **Renter** | Mobile app | Travelers and locals who need a vehicle for self-drive or chauffeur-assisted trips |
| **Vehicle Owner** | Mobile app | Lists vehicles, manages availability, accepts bookings, earns income |
| **Driver** | Mobile app | Provides driving services, manages assigned trips |
| **Administrator** | Web panel | Verification, listing approval, payments, disputes, reports, settings |

**One app, role-based experience.** All three mobile roles use the same app. Every account is a renter by default. Owners and Drivers share one account and can switch between **Owner Mode** and **Driver Mode** inside the app. Mode switching is a UI convenience only; every permission check is based on the roles a user holds, never on the selected mode.

**Admins do not use the mobile app.** Admin accounts are blocked from the admin panel unless they are signed in with an active account and active admin role. Admin access uses email/password sign-in without an MFA requirement.

## 3. Assumptions and Open Questions

Items marked ⚠️ may block launch.

| # | Item | Default assumption for MVP |
|---|------|----------------------------|
| 1 | ⚠️ **Legal/regulatory:** CamotesDrive **must be accredited as a Transport Network Company (TNC)** by LTFRB before offering pre-booked chauffeured rentals. Obtaining and maintaining that accreditation is a launch gate for chauffeured service. | Decision made: pre-booked chauffeured rentals require TNC accreditation (see Section 3A). Chauffeured service stays behind a feature flag that cannot be enabled until the accreditation details are recorded in platform settings. Self-drive can launch first. Confirm accreditation requirements and process with LTFRB Region 7 and counsel. All compliance rules live in configurable settings |
| 2 | **Payments:** which methods locals and tourists will use | MVP uses manual payments (cash on pickup, GCash/Maya/bank transfer with reference number). A gateway (e.g., PayMongo, Xendit) is chosen for Phase 2 |
| 3 | **Vehicle mix:** motorcycles/scooters, cars, vans | Support all via a `vehicle_type` field; validate with early owners. Tricycles receive no special handling in the MVP |
| 4 | **Platform revenue:** commission or flat fee | Configurable percentage service fee in platform settings |
| 5 | **Rental day definition** | 24 hours from pickup time; configurable later |
| 6 | **Self-drive eligibility** | Renter 18+ (owner may require higher) with a verified driver's license |
| 7 | **Language** | English at launch; structure strings for later Cebuano/Filipino translation |
| 8 | **Currency and timezone** | PHP only; stored in UTC, displayed in Asia/Manila |
| 9 | **Launch platform order** | Android is the priority for the pilot (widest local reach); iOS ships from the same codebase, with App Store review time budgeted |
| 10 | **Sign-in method** | Email and password at launch; phone number OTP and Google sign-in evaluated for Phase 2 (SMS cost and local deliverability to be tested) |
| 11 | **Connectivity** | Many users will have weak or intermittent signal on the islands; the app must degrade gracefully (see Section 9) |
| 12 | **Store accounts** | Google Play Console and Apple Developer accounts registered under the business entity before development finishes |

## 3A. Regulatory Compliance Model (Modeled on Grab/inDrive)

Ride-hailing apps in the Philippines operate as Transport Network Companies (TNCs). They activate a driver only when the vehicle is covered by an LTFRB authority and the driver holds a professional driver's license. CamotesDrive operates the same way wherever a driver is provided: **CamotesDrive is accredited as a TNC for its chauffeured service**, and applies the same driver and vehicle gate.

**Product scope rule.** The MVP offers only two services: **self-drive rentals** and **pre-booked chauffeured rentals** (a driver hired with a vehicle for a day, trip, or tour). It does **not** offer on-demand point-to-point ride-hailing or motorcycle-taxi rides; adding either later requires its own PRD and any additional accreditation. Chauffeured rentals require CamotesDrive's TNC accreditation; self-drive does not.

**Compliance positions (to be confirmed by LTFRB Region 7 and counsel)**

| Question | Position |
|---|---|
| **a) Does CamotesDrive need TNC accreditation?** | **Yes, for chauffeured service.** A platform providing drivers for compensation must be accredited as a TNC and may only dispatch drivers with vehicles covered by a valid LTFRB authority. Chauffeured service stays hidden platform-wide until CamotesDrive's TNC accreditation (number, issue date, validity) is recorded in `platform_settings` and the feature flag is enabled by an admin. The flag is automatically turned off if the accreditation expires or is marked revoked. A self-drive-only marketplace does not need TNC accreditation. |
| **b) Authority for chauffeured vehicles** | The vehicle must hold a valid LTFRB franchise or provisional authority (PA) that covers the trip dates. The app records case number, plate number, and validity dates. It does not model or validate franchise categories; any LTFRB-issued authority accepted by the reviewing admin satisfies the requirement. |
| **c) Self-drive** | LTFRB MC 2011-008 exempts private vehicles rented out when (1) covered by a long-term lease, or (2) exclusively used and driven by the lessee or their authorized representative. Other rent-a-car owners remain covered by MC 98-27. The app therefore **never allows a self-drive booking to include a driver supplied by the owner, the platform, or a hired driver**, and only the renter (and named, license-verified authorized drivers) may drive. Confirm the 2011 circular is still current. |
| **d) Motorcycles** | Self-drive motorcycle fleets need standard local business permits, business registration, and insurance. Motorcycle taxi service is out of scope. |

**Eligibility by service type**

| Service type | Vehicle must have | Driver must have | Renter must have |
|---|---|---|---|
| **Chauffeured (pre-booked)** | Approved LTFRB franchise or PA valid on the trip dates (case number, plate, validity recorded), OR/CR, passenger insurance policy | Valid **professional** driver's license, valid ID, NBI and PNP clearances (clearances configurable pending legal review) | Verified account and ID |
| **Self-drive** (cars, vans, motorcycles) | OR/CR and valid compulsory third-party liability insurance; fleet or business owners also upload business permit and DTI/SEC registration | Not applicable | Valid driver's license whose restrictions permit the vehicle class; every authorized driver named and verified |

**Platform rules**
1. **Driver Mode cannot be activated** until the professional license, ID, and required clearances are approved by an admin. A non-professional license is rejected.
2. **A vehicle can be offered "with driver" only after its LTFRB franchise or PA is approved.** The listing stores the case number, validity dates, and plate number; the plate must match the OR/CR. Vehicles without an approved authority are listed as self-drive only. Chauffeured service is hidden platform-wide while its feature flag is off or CamotesDrive's TNC accreditation is missing or expired.
3. **Trust display before the trip:** the renter sees the driver's name and photo, the vehicle plate number, and the LTFRB case number on the booking before the trip starts. This mirrors the TNC accreditation conditions.
4. **Continuous eligibility, not one-time:** the system tracks expiry of the license, PA/franchise, insurance, clearances, and CamotesDrive's own TNC accreditation. It sends reminders at 30 and 7 days (to the affected provider, and to admins for the platform accreditation), then **automatically blocks** the affected driver or vehicle from new chauffeur bookings on expiry. Every provider is re-verified at least once a year and on every renewal.
5. **Admin checklist:** the verification screen shows each required document, and an admin cannot approve a driver or a "with driver" vehicle until every required item passes. Every approval and rejection is audit-logged with the reviewer's identity.
6. **Configurable rules:** document requirements, validity warnings, TNC accreditation details, and the self-drive franchise requirement are stored in `platform_settings`, so rules can change without an app release.

**Caveats**
- The driver and document gate is modeled on ride-hailing (TNVS) rules. The exact accreditation steps, fees, and conditions for CamotesDrive's TNC accreditation must be confirmed with LTFRB Region 7 and counsel, and accreditation must be in hand before chauffeured service is enabled.
- MC 2011-008 dates from 2011; confirm it has not been superseded.
- Motorcycle taxis are out of scope. The DOTr motorcycle-taxi pilot has been limited to specific areas (Metro Manila, Metro Cebu, Cagayan de Oro in the sources reviewed), which does not include the Camotes Islands.
- Requirements and validity periods change (for example, PA validity), so the system stores the actual dates from each document instead of assuming fixed durations.

## 4. Core MVP Features

### 4.1 Authentication and Profiles (Mobile)
- Register and log in with email and password; email verification required before booking or listing.
- Phone number collected on the profile (needed for pickup coordination).
- Password reset flow with deep link back into the app.
- Session tokens stored in secure device storage; automatic sign-in on return.
- Optional biometric unlock (Face ID/fingerprint) for returning users.
- Manage personal information and profile photo (camera or gallery).
- Roles: renter (default), owner, driver. Admin is web-only and cannot be assigned from the app.
- Users request the Owner and/or Driver role; the role is **activated only after admin verification** (see 4.7).
- **In-app account deletion** (required by app stores) with a clear explanation of what is deleted and what is retained for legal and dispute purposes.
- Role-based access enforced on the server and in RLS.

### 4.2 Renter Features (Mobile)
- Browse, search, and filter vehicles by type, price, dates/availability, pickup area, transmission, seats, and driver availability.
- Vehicle details with swipeable photo gallery, daily rate, security deposit, rules (fuel policy, area limits), and ratings. Owner contact details are hidden until a booking is confirmed.
- Select rental dates and times with native date/time pickers; choose pickup and return location from predefined pickup points (ports, towns, resorts) or a custom address.
- Choose self-drive or add a driver.
  - Self-drive requires a verified driver's license whose restrictions permit the vehicle class; the app guides the renter to scan and upload it if missing. A self-drive booking can never include a driver supplied by the owner, the platform, or a hired driver; any additional authorized drivers are named and license-verified.
  - Chauffeur-assisted trips are available only while CamotesDrive's TNC accreditation is active, and list only drivers who are verified, available, and cover the pickup area, and only vehicles with an approved LTFRB authority. The booking shows the driver's name and photo, vehicle plate, and LTFRB case number (see Section 3A).
- Price breakdown screen before submitting.
- Submit booking requests; track booking and payment status in a "My Trips" tab (Upcoming, Ongoing, Past, Cancelled).
- Submit payment reference and optional proof photo (manual payment flow, see 4.6); view payment information and rental history.
- In-app chat with the owner and assigned driver within the booking.
- After confirmation, tap-to-call or tap-to-message the owner and driver; tap to open the pickup point in the device's map app.
- Cancel eligible bookings under the cancellation policy.
- Rate and review the vehicle and driver after a completed trip.
- Save favorite vehicles.

### 4.3 Vehicle Owner Features (Mobile, Owner Mode)
- Create, edit, deactivate, and delete vehicle listings through a step-by-step flow (details → photos → pricing → rules → submit). New and edited listings go through admin approval. Drafts are saved so an owner can finish later.
- Upload multiple photos using the camera or gallery, with automatic compression, plus registration (OR/CR) documents (private).
- Choose the service type per vehicle: **self-drive only** or **self-drive and with driver**. Offering a vehicle with a driver requires uploading its LTFRB franchise or PA (case number, validity dates, plate) and the passenger insurance policy for admin approval (see Section 3A). The app shows expiry dates and reminders, and renewals are uploaded in-app.
- Set daily rate, security deposit, minimum/maximum rental length, pickup points, and rules.
- Block unavailable dates and maintenance windows using a calendar view.
- Receive push notifications for booking requests; accept or decline within the response window (default 24 hours; requests auto-expire).
- Manage upcoming, ongoing, completed, and cancelled rentals.
- **Handover and return check-in:** capture condition photos and notes with the camera at pickup and return to support deposit and damage disputes.
- In-app chat with renters and drivers.
- View earnings, transactions, and payout history.

### 4.4 Driver Features (Mobile, Driver Mode)
- Create a driver profile and submit verification documents using document capture: **professional driver's license** (with expiry), valid ID, and NBI and PNP clearances (see Section 3A). A non-professional license cannot activate Driver Mode.
- See document expiry dates and reminders, and renew documents in-app.
- Set daily driver fee, service areas, languages, and availability calendar; quick on/off "available for hire" toggle.
- Receive push notifications for assignment requests; accept or decline within the response window.
- Trip list and trip detail with pickup time, pickup point, and renter details (renter contact visible only for accepted upcoming trips); tap to call or open directions in a map app.
- In-app chat with renters and owners.
- Update trip status (en route, started, completed) with one-tap actions.
- View earnings, ratings, and reviews.

### 4.5 Provider Mode Switching
- Owner/Driver toggle accessible from the main navigation and profile; the app remembers the last used mode.
- Owner Mode shows vehicle and rental management tabs; Driver Mode shows trip and availability tabs; Renter experience is always available.
- Toggle is available only to users holding the corresponding verified role.
- One notification inbox with a mode label on each item.
- **Conflict rules:** a user cannot be renter and provider on the same booking, and cannot be assigned as driver on overlapping trips.

### 4.6 Booking and Payment

**Booking flow**
1. Renter submits a request (vehicle, dates, locations, self-drive or driver).
2. Server validates availability and eligibility (including, for chauffeured bookings, that CamotesDrive's TNC accreditation is active) and calculates the price.
3. Owner accepts or declines. If a driver was requested, the driver must also accept.
4. Booking is confirmed once all required parties accept (and the deposit/advance condition is met if the owner requires one).
5. Handover, trip, return, completion.

**Booking statuses**
`pending_owner` → `pending_driver` (only if a driver was requested) → `confirmed` → `in_progress` → `completed`
Terminal alternatives: `declined`, `expired`, `cancelled_by_renter`, `cancelled_by_owner`, `cancelled_by_driver`, `disputed`, `no_show`.

If a driver declines, the renter may choose another driver, switch to self-drive (if eligible), or cancel without penalty. Status transitions are enforced server-side, never directly from the app.

**Payment statuses (tracked separately)**
`unpaid` → `pending_verification` → `paid` → `partially_refunded` / `refunded` / `failed`
The security deposit has its own status: `not_required`, `held`, `returned`, `partially_withheld`, `withheld`.

**MVP payment model**
- Payments happen outside the app (cash on pickup, GCash/Maya, or bank transfer). The renter submits a reference number and optional proof photo; the owner or admin confirms receipt.
- Every payment and deposit event is recorded in `payments`.
- Online gateway payments, automated refunds, and automated payouts are Phase 2. When added, they open in a secure hosted checkout (in-app browser/redirect) rather than collecting card details inside the app.

**Pricing rules**
- Total = (vehicle daily rate × rental days) + (driver fee × driver days, if selected) + service fee. The security deposit is shown separately.
- All calculations run on the server; amounts are snapshotted into the booking so later rate changes do not alter existing bookings.
- All amounts in PHP.

**Cancellation and refund policy (configurable defaults)**
- Free cancellation up to a set number of hours before pickup (default 48); partial or no refund after.
- Owner/driver cancellations after confirmation trigger a full refund and are recorded against the provider's reliability record.
- No-shows are marked by the owner and handled per policy.

**Integrity rules**
- Prevent overlapping confirmed bookings for the same vehicle **and** the same driver, enforced at the database level (e.g., PostgreSQL exclusion constraint on a time range).
- Pending requests do not block the calendar; confirmation re-checks availability atomically.
- Keep a history of every status change, price change, and cancellation (who, when, why).

### 4.7 Verification (Owners, Drivers, Renters, Vehicles)
- **Owners:** valid government ID, plus proof of ownership (OR/CR) per vehicle. For all vehicles: valid compulsory third-party liability insurance; fleet or business owners also upload business permit and DTI/SEC registration. For vehicles offered with a driver: LTFRB franchise or PA (case number, validity dates, plate matching the OR/CR) and passenger insurance policy.
- **Drivers:** **professional** driver's license (with expiry date), valid ID, and NBI and PNP clearances (clearances configurable pending legal review).
- **Renters:** driver's license and ID for self-drive; ID for chauffeur-assisted bookings.
- Documents are captured in-app using the camera with framing guidance, compressed, and uploaded to private storage.
- Document statuses: `pending`, `approved`, `rejected` (with reason shown in-app and by push), `expired`.
- Expired licenses, clearances, franchise/PA, or insurance automatically block the affected driver, vehicle, or renter from new bookings or assignments; already-confirmed trips are flagged for admin review. Reminders go out 30 and 7 days before expiry.
- Mandatory re-verification at least annually and on every renewal.
- Documents are visible only to the document owner and admins.

### 4.8 Notifications and Messaging (Mobile)
- **Push notifications** (primary channel) for: booking requests, accept/decline, driver assignments, payment updates, cancellations, upcoming-trip reminders, verification results, and expiring documents. Email is a backup channel for critical events.
- In-app notification center with read/unread status and badge counts; tapping a notification deep-links to the relevant booking, chat, or screen.
- Users can control notification categories in settings and must grant OS notification permission (with a clear explanation prompt, not an immediate system dialog on first launch).
- Messaging is **scoped to a booking**: participants are the renter, owner, and assigned driver only. Chat updates in near real time while the app is open; unread messages trigger push when the app is in the background.
- Messages can be sent while briefly offline and are delivered when the connection returns (with clear "sending/failed" states).
- Contact details are revealed only once a booking is confirmed.
- Admins can read a conversation only when handling a reported dispute.
- Users can report a message or user.

### 4.9 Reviews and Ratings
- Only the renter of a completed booking can review, once per vehicle and once per driver per booking, within a set window (e.g., 30 days). The app prompts for a review after trip completion.
- 1–5 stars with an optional comment.
- Average ratings, review counts, and history are shown on vehicle and driver profiles; providers may post one public reply.
- Admins can hide reviews that violate content rules.

### 4.10 Admin Web Panel (Web Only)
- Email/password sign-in with an active admin role; separate from the mobile experience, with a dashboard link for admins on the web profile.
- View and manage users; suspend or reactivate accounts.
- Verify owners, drivers, renter licenses, and vehicles; approve, reject (with reason), or suspend listings. Document viewer uses short-lived signed URLs.
- Compliance checklist per driver and "with driver" vehicle (required documents, plate match, expiry dates), with approval blocked until all items pass.
- Compliance dashboard: documents expiring soon, providers auto-blocked, affected confirmed trips needing review, and the status and expiry of CamotesDrive's own TNC accreditation.
- Record CamotesDrive's TNC accreditation details and enable or disable the chauffeured-service feature flag (enabling is blocked without a valid accreditation).
- Monitor bookings, payments, deposits, and platform activity; manually confirm payments and record payouts.
- Review reports, complaints, and disputes; record outcomes and deposit decisions.
- Moderate reviews.
- Basic analytics: signups, bookings by status, revenue, active listings, response rates, app version distribution.
- Manage platform settings: service fee, cancellation defaults, pickup points, response windows, minimum supported app version.
- Every admin action is written to an audit log.
- Desktop-optimized layout (tablet usable); no mobile app version required.

## 5. Technology Stack

**Mobile app**
- **Framework:** React Native with Expo (TypeScript), Expo Router for navigation, building for Android and iOS from one codebase.
- **Styling:** NativeWind (Tailwind for React Native) or a comparable styling approach.
- **Data layer:** Supabase JS client with a query/caching library (e.g., TanStack Query) for caching and offline-tolerant behavior.
- **Secure storage:** Expo SecureStore for session tokens.
- **Push notifications:** Expo Notifications (FCM for Android, APNs for iOS).
- **Camera and media:** Expo Camera/Image Picker with image compression.
- **Maps (MVP):** Predefined pickup points with "open in maps" deep links. An in-app map picker (react-native-maps) is a later enhancement.
- **Builds and updates:** EAS Build and EAS Submit for store releases; EAS Update for over-the-air JavaScript fixes where store policy allows.

**Backend (shared)**
- **Database:** Supabase PostgreSQL with Row Level Security on every table.
- **Authentication:** Supabase Auth.
- **Server logic:** Booking creation, status changes, price calculation, and payment confirmation run in Supabase Edge Functions or Postgres functions. The service-role key is never shipped in the app.
- **File storage:** Supabase Storage with public buckets (vehicle photos, profile photos) and private buckets (verification documents, handover photos, payment proofs) accessed via signed URLs.
- **Realtime:** Supabase Realtime for chat and notification updates while the app is open.
- **Scheduled jobs:** Supabase scheduled functions for booking expiry, trip reminders, and document-expiry checks (including the platform's TNC accreditation).
- **Email:** Transactional email provider (e.g., Resend) for backup notifications and account emails.

**Admin web**
- Next.js (App Router), TypeScript, Tailwind CSS, deployed on Vercel, using Supabase Auth with active admin-role authorization; MFA is not required.

**Operations**
- Separate development, staging, and production Supabase projects.
- Crash and error reporting (e.g., Sentry) in the mobile app and admin web.
- Daily automated backups with a tested restore.
- **Payments (Phase 2):** Gateway chosen before online payments are enabled.

## 6. Database Structure

**Core tables**

- `profiles` — user information linked to Supabase Auth (name, phone, photo, status).
- `user_roles` — roles per account with status (`pending`, `active`, `suspended`) and verifier/verified-at.
- `driver_profiles` — driver fee, service areas, languages, availability settings, verification status, license type (professional/non-professional), license expiry, clearance dates.
- `vehicles` — listings (type, make/model, seats, transmission, rate, deposit, rules, status, owner, plate number, `service_type` self-drive/with-driver, `with_driver_eligible` flag, franchise case number, franchise valid-until).
- `vehicle_photos` — ordered photos per vehicle.
- `vehicle_availability` — blocked dates and maintenance windows.
- `driver_availability` — driver unavailable periods.
- `locations` — predefined pickup/return points.
- `bookings` — renter, vehicle, optional driver, time range, locations, price snapshot, statuses.
- `booking_events` — history of status changes, price changes, and cancellations.
- `handovers` — pickup/return records with condition notes and photos.
- `payments` — amount, type (rental, deposit, refund), method, reference, proof, status, confirmed-by.
- `conversations` and `messages` — booking-scoped chat.
- `notifications` — in-app notifications with read state.
- `device_tokens` — push tokens per user device (platform, token, last seen, active flag).
- `reviews` — vehicle and driver ratings tied to a booking.
- `documents` — verification documents with type (ID, driver's license, professional license, NBI clearance, PNP clearance, OR/CR, LTFRB franchise/PA, insurance policy, business permit, DTI/SEC registration), reference number, issue and expiry dates, subject (user or vehicle), status, reviewer, rejection reason, next re-verification date.
- `payouts` — owner and driver payout records.
- `reports_disputes` — complaints, disputes, and resolutions.
- `favorites` — saved vehicles.
- `audit_logs` — admin and sensitive actions.
- `platform_settings` — service fee, cancellation policy, response windows, minimum supported app version, compliance flags (required documents per service and vehicle type, expiry reminder days, self-drive franchise requirement, clearance requirement), **CamotesDrive TNC accreditation record (accreditation number, issue date, valid-until, status)**, and feature flags (chauffeured service enabled; cannot be set to true without an active TNC accreditation).

**Database design rules**
- Money stored as integer centavos or `numeric(12,2)`, never floating point.
- Timestamps stored as `timestamptz`.
- Overlap protection via exclusion constraint (`btree_gist`) on confirmed bookings for vehicle and driver.
- Foreign keys, `NOT NULL`, and `CHECK` constraints on statuses and amounts.
- Indexes on search/filter columns and on user and booking ids.
- Paginated queries for lists (vehicles, trips, messages) to protect mobile data usage.

## 7. Security, Privacy, and Business Rules

**Access rules**
- Users can access only the data and actions permitted by their roles.
- Renters cannot view or modify other users' bookings.
- Owners manage only their own vehicles and related bookings.
- Drivers see only assigned trips and the information needed to perform them.
- Admin privileges cannot be self-assigned or reached by editing fields from the app.
- Sensitive fields (status, price, role, verification) are not writable by clients.
- Verification documents, payment proofs, and handover photos are never public.

**Mobile-specific security**
- Only the public Supabase anon key ships in the app; all privileged operations run server-side.
- Tokens stored in secure storage; sessions can be revoked; logout clears local cached data and unregisters the push token.
- HTTPS only; no sensitive data in logs, push payloads, or screenshots of notifications (push text avoids exposing IDs or document details).
- Server-side validation never trusts the app: the app can be modified, so prices, statuses, and eligibility are always re-validated.
- Uploads validated for type and size on the server.
- Rate limiting on auth, messaging, and booking endpoints.

**Server-side validation**
- Booking prices are calculated and validated on the server.
- Booking, payment, and deposit status changes follow an allowed-transitions table and are authorized per actor.
- Availability is re-checked at confirmation inside a transaction.
- Chauffeured bookings are rejected server-side unless the chauffeured-service flag is on and the TNC accreditation is active.

**Data privacy (Philippine Data Privacy Act of 2012)**
- Collect only necessary data; obtain explicit consent for ID and license processing.
- Privacy Policy and Terms of Service (liability, damage, and deposit terms) accepted at signup and linked in the app and store listings.
- Defined retention periods for documents; account deletion and data requests supported in-app.
- Designated data protection contact.
- Complete the Google Play Data Safety form and Apple App Privacy details accurately.

**App store compliance**
- Rentals are physical, real-world services paid outside the app in the MVP, so in-app purchase rules are not triggered; confirm again before adding online payments.
- Provide a demo/test account and review notes for store review (role-gated features need explanation).
- In-app account deletion, content reporting, and user blocking available as required for apps with user-generated content.

## 8. Mobile Experience Requirements

- **Navigation:** Bottom tabs per mode.
  - Renter: Explore, Trips, Messages, Profile (and a visible switch to provider modes if the user holds those roles).
  - Owner Mode: Dashboard, Vehicles, Bookings, Messages, Earnings.
  - Driver Mode: Dashboard (availability and next trip), Trips, Messages, Earnings.
- **Deep links:** Notifications, password reset, email verification, and shared vehicle links open the correct screen.
- **Permissions:** Camera, photo library, and notifications requested only when needed, with explanation screens.
- **Device support:** Android 8+ and iOS 15+ (to be confirmed against pilot-user devices); phones first, tablets not optimized in MVP.
- **Orientation:** Portrait only for MVP.
- **Accessibility:** Dynamic text sizes, sufficient contrast, screen-reader labels on interactive elements.
- **Forced update:** The app checks a minimum supported version on launch and prompts or blocks users on outdated versions when the backend changes in a breaking way.

## 9. Offline and Low-Connectivity Behavior

- Show cached data (My Trips, profile, last-viewed vehicles, conversations) with an "offline" indicator when there's no connection.
- Booking submission, payments, status changes, and document uploads require a connection and fail with clear retry messaging.
- Uploads are resumable or retry automatically for large photos and documents; images are compressed before upload.
- Messages composed offline are queued and sent when connectivity returns.
- Lists are paginated and images use thumbnails and caching to reduce data use.
- No critical information (booking confirmation, pickup point, contact details for a confirmed trip) should be unavailable offline once it has been loaded; confirmed trip details are cached for offline viewing.

## 10. Non-Functional Requirements

- **Performance:** Cold start under ~3 seconds on a mid-range Android phone; vehicle search results load within ~2 seconds on a typical 4G connection.
- **Reliability:** Daily database backups, tested restore, and crash-free sessions target of 99% or higher.
- **Testing:** Automated tests for RLS policies, pricing, booking state transitions, and overlap prevention are launch gates. Manual QA on real Android and iOS devices covering weak-network scenarios.
- **Release process:** Internal testing track → closed beta (pilot users) → production. Staged rollouts on Google Play.
- **Observability:** Crash reporting, analytics on key funnels (search → request → confirmation), and audit logs.
- **Localization readiness:** All user-facing strings externalized.

## 11. Out of Scope for the Initial MVP

- Owner, driver, or renter experiences on the web; the admin panel is the only web interface.
- Admin features inside the mobile app.
- Tablet-optimized layouts and landscape orientation.
- On-demand point-to-point ride-hailing (Grab/inDrive-style) and motorcycle-taxi rides; these require their own PRD and any additional accreditation or pilot-program approval.
- Franchise-category modeling and tricycle-specific (municipal) rules.
- Real-time GPS tracking, live location sharing, and route optimization.
- In-app turn-by-turn navigation (the app hands off to the device's map app).
- AI-powered recommendations and automated dynamic pricing.
- Loyalty points and referral rewards.
- Multi-country and multi-currency support.
- Insurance integrations (MVP shows owner-defined terms and a liability waiver only).
- Online payment processing, automated refunds, and automated payouts (manual in MVP).
- SMS notifications and in-app voice/video calls.
- Advanced business intelligence and predictive analytics.

## 12. Suggested Delivery Phases

1. **Foundation:** Expo project and CI (EAS), admin web shell, Supabase environments, auth, profiles, roles, RLS baseline, storage buckets, push token registration.
2. **Supply side:** Owner and driver onboarding, document capture/upload, admin verification in the web panel, vehicle listing flow with approval, availability calendars.
3. **Booking core:** Search and filters, booking request flow, state machine, server-side pricing, overlap constraints, owner/driver accept/decline.
4. **Money and trust:** Manual payment submission and confirmation, deposit tracking, cancellations, handover/return check-in, payout records.
5. **Communication:** Booking-scoped chat, push notifications, deep links, reviews.
6. **Admin and hardening:** Dashboards, disputes, audit logs, analytics, security and RLS testing, offline/low-bandwidth testing, performance and accessibility pass.
7. **TNC accreditation (runs in parallel from the start):** Apply for and obtain CamotesDrive's TNC accreditation from LTFRB; record it in platform settings. Chauffeured service cannot be enabled in production until this is complete.
8. **Store release and pilot:** Store listings, privacy forms, review submission, closed beta, then a limited pilot with a small group of verified owners and drivers (self-drive first; chauffeured once accreditation is active).

## 13. MVP Success Criteria

**Functional**
1. Users can register, verify email, sign in, and use only authorized features in the mobile app.
2. Owners and drivers can submit verification from the app and be approved or rejected by admins on the web panel.
3. Owners can list vehicles (after approval) and manage availability from their phones.
4. Renters can search, filter, and submit booking requests with correct server-calculated pricing.
5. Renters can optionally request a driver; drivers can accept or decline assignments from push notifications.
6. The system never confirms overlapping bookings for the same vehicle or driver.
7. Booking, payment, and deposit statuses and their history are recorded correctly.
8. Users receive relevant push notifications and can chat within a booking.
9. Completed rentals can be reviewed once.
10. Signed-in users with an active account and admin role can verify users and vehicles, confirm payments, resolve disputes, and view an audit trail on the web panel; MFA is not required.
11. All tables are protected by RLS with automated tests passing for every role and ownership rule.
12. The app passes Google Play and Apple App Store review.
13. No driver can be activated without an approved professional license, and no vehicle can be booked with a driver without an approved, unexpired LTFRB authority (verified by automated tests).
14. Expired documents automatically block affected drivers and vehicles from new chauffeur bookings, and renters see driver name/photo, plate, and case number before the trip.
15. Chauffeured service cannot be enabled, and chauffeured bookings are rejected, unless CamotesDrive's TNC accreditation is recorded and unexpired (verified by automated tests).

**Pilot metrics (first 60–90 days after launch, targets to be tuned)**
- A meaningful number of verified vehicles and drivers onboarded across the main towns.
- Median owner response time under 12 hours.
- Booking request acceptance rate above 60%.
- Fewer than 5% of confirmed bookings cancelled by providers.
- Average rating of 4.0 or higher.
- Crash-free sessions at 99% or higher; majority of active users on the latest app version.

## 14. Future Enhancements

- Online payments (GCash/Maya/cards) with automated refunds.
- Automated payouts and commission management.
- Real-time trip tracking and live location sharing.
- In-app map picker and navigation.
- Phone OTP and social sign-in.
- SMS notifications.
- Cebuano/Filipino localization.
- In-app support and structured dispute resolution.
- Insurance partnerships.
- Tricycle listings with municipal rules.
- Advanced analytics, improved verification, and fraud prevention.

---

**Product Goal:** Build a secure, easy-to-use mobile platform that connects renters, vehicle owners, and drivers in the Camotes Islands, while giving administrators a web dashboard to manage trust, payments, and disputes reliably.
