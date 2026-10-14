# Supabase schema preparation

Created `supabase_dbschema.md` from the CamotesDrive PRD. Despite its `.md` extension, it contains **only executable SQL and SQL comments**. Copy the entire file into **Supabase Dashboard → SQL Editor → New query**, then run it as the SQL Editor's `postgres` role.

The script is a **one-time initial installation** for a fresh project/schema. It runs inside a transaction, stops if the main application tables already exist, and does not drop tables or delete existing data. Do not rerun it as an upgrade migration.

## What the schema includes

- 26 application tables covering profiles, verified roles, driver profiles, vehicles, listing photos/pickup points, availability, documents, bookings, additional authorized drivers, history, handovers, manual payments, conversations, messages, user blocking, notifications, device tokens, reviews, favorites, payouts, disputes, audit logs, and platform settings.
- UUID primary keys, foreign keys, controlled statuses, validation checks, lookup indexes, PHP centavo amounts, and timezone-aware timestamps.
- Supabase Auth signup trigger: creates a profile and active renter role. Existing Auth users are backfilled. User-supplied signup metadata cannot assign provider/admin privileges.
- Server-calculated booking prices, 24-hour rental days, immutable price/identity/date snapshots, provider acceptance and advance-payment checks, and booking transition validation.
- GiST exclusion constraints prevent overlapping confirmed/in-progress/disputed vehicle and driver reservations. Pending requests do not block the calendar.
- Calendar writes and confirmation lock the same vehicle/driver records to prevent maintenance-block races.
- Eligibility checks for email verification, active accounts, consent, renter age, document expiry, annual re-verification, license vehicle restrictions, verified providers, service areas, and authorized self-drive drivers.
- Chauffeured bookings require active platform accreditation, an approved vehicle authority, matching case/plate data, and a professional driver license. Motorcycle chauffeur service is blocked. Chauffeured service is disabled by default.
- Review eligibility, one review per booking/target, booking-scoped messaging, block checks, and duplicate-message protection.
- Automatic booking history/conversation creation, separate driver en-route/start/completion state, and sensitive-change audit metadata.

## Access and privacy

Every application table has RLS enabled and explicit grants. Public listing grants exclude vehicle plates; profiles and verification documents are private. The public provider directory exposes names/avatar paths, not contact details. `get_booking_contacts()` reveals contacts only to participants of accepted bookings.

Verified date of birth and reviewed license vehicle classes are server-controlled. Users can submit a birth date for review but cannot alter the verified value to bypass the age requirement. Expiry checks use the Asia/Manila calendar date.

Clients may update permitted personal fields, submit provider requests and draft listings/documents, save favorites, block users, send booking messages, mark notifications read, manage device tokens, submit eligible reviews, and file reports. They cannot approve roles/documents/listings, write booking/payment/payout states, or modify audit history.

Admin read policies require an active admin role plus an MFA `aal2` JWT. Admin chat access is limited to an open dispute assigned to that admin. Sensitive **writes** deliberately require trusted server code; the schema does not provide a complete admin mutation API.

## Storage and defaults

- Public buckets: `avatars`, `vehicle-photos`.
- Private buckets: `verification-documents`, `payment-proofs`, `handover-photos`.
- MIME/file-size restrictions and folder-based ownership policies.
- Private evidence can be read by its uploader and authorized reviewers/booking participants. No client overwrite/delete policies are added for evidence.
- Default service fee: 5%; free cancellation window: 48 hours; provider response window: 24 hours; review window: 30 days.
- Seeded pickup locations: Consuelo Port, Santiago Bay, Poro Port, and San Francisco/Tudela/Pilar town centers. No geographic coordinates are invented.

## Maintenance and setup after installation

`run_camotes_maintenance()` expires overdue requests/documents, disables expired accreditation, queues document/platform-expiry notifications, and flags confirmed trips needing compliance review. Schedule it through Supabase Cron after installation; the script does not automatically enable Cron or send email/push notifications.

Create your real admin through Supabase Auth, then use the commented SQL example at the bottom of the schema to grant that account an admin role from SQL Editor. Enroll and challenge MFA before accessing admin data. No default admin password/account is created.

Before connecting the UI, implement authenticated Edge Functions for booking requests/transitions, approvals, listing revisions, calendar changes, handovers, payment/deposit accounting, cancellations/refunds, payouts, signed URLs, moderation, and account deletion. Those functions must validate the acting user and admin MFA before using the service-role key. Service-role requests bypass RLS, so keep that key on the server.

The audit trigger records the JWT user when available. Pure service-role writes have no user identity and record a null actor; a future audited server RPC must propagate a verified actor for those operations. Do not trust an actor ID supplied by the client.

Payment/deposit aggregate status transitions and refunds are not automatically derived from payment rows. Perform these together in server-side transactions. Account deletion also needs a trusted anonymization/retention and private-file cleanup workflow; retained profiles and financial records are not cascade-deleted.

Owner/admin reads of private listing fields need a trusted projection/RPC because the direct listing column grants are intentionally restricted. Use explicit column selections when browsing listings/reviews rather than `select('*')`.

The app remains on mock data. No remote project was modified, no secrets were read, and no frontend API integration was added.

## Validation

Executed the complete installation in a temporary local PostgreSQL engine (PGlite with `btree_gist`) and stubbed Supabase Auth/Storage interfaces. **44 checks passed**, covering installation, signup/backfill, RLS on all 26 tables, permissions, protected DOB/prices/approvals, price calculation, valid and invalid booking transitions, vehicle and driver overlaps, calendar conflicts, self-drive/chauffeur eligibility, anonymous browsing, MFA, dispute-scoped admin chat, private uploads, reviews, notifications, and maintenance.

`npx expo lint` and `npx tsc --noEmit` also passed. Temporary validation dependencies were isolated under the ignored `.expo/schema-validation/` folder; application dependencies were not changed by this task.

This is not a test against your hosted Supabase project. Live Supabase integration, concurrent-client behavior, complete role-policy tests, and production security review remain required before launch.

## References

- [Supabase RLS and privileges](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Storage access policies](https://supabase.com/docs/guides/storage/security/access-control)
- [PostgreSQL btree_gist](https://www.postgresql.org/docs/current/btree-gist.html)
