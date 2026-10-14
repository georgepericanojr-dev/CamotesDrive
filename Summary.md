# CamotesDrive UI implementation

Implemented a React Native / Expo Router UI with NativeWind after reading the full PRD. All application data and actions are mocked; the UI makes no API or database calls.

## Design and navigation

- Coastal green, cream, and warm sand palette, reusable cards, buttons, fields, badges, and vehicle cards.
- Mobile bottom navigation changes for Renter, Owner, and Driver modes. Wider previews use a sidebar and additional discovery content.
- Safe-area handling, scrollable screens, accessible control labels, empty states, and local feedback messages.
- Four bundled sample photographs; images load from local assets rather than remote services at runtime. Vehicle photography is illustrative, not a representation of the listed model. The photo gallery currently repeats a sample image.

## Renter screens

- Explore: search by vehicle/model/town; filter by category, daily budget, pickup area, transmission, and seats; favorite vehicles.
- Vehicle details: photos, daily rate, deposit, specifications, owner information, reviews, and rental rules.
- Booking: editable mock pickup/return dates, predefined or custom locations, additional authorized driver, manual payment selection, service fee and deposit breakdown, terms acceptance, and request submission.
- My Trips: upcoming, ongoing, past, and cancelled/declined requests; trip details; owner contact visibility after confirmation; cancellation policy feedback; one-time review submission.
- Manual payments: reference number and simulated proof attachment; pending verification and provider/admin confirmation.
- Booking-scoped message UI: locally composed messages, reporting, and blocking.
- Saved vehicles, notifications with read state, profile editing, mode switching, sign-in/register/password-reset previews, verification renewals, preferences, support/disputes, legal copy, and account-deletion confirmation.

## Provider screens

- Owner and Driver dashboards with sample earnings, ratings, requests, next trips, and verification reminders.
- Owner listings: edit prefilled information, deactivate/reactivate, delete from the current view, and submit a five-step listing flow.
- New listing drafts can be reopened during the session. Submitted listings appear with pending-approval status.
- October availability calendar with date blocking and maintenance notes; driver fee, areas, languages, and availability toggle.
- Booking acceptance/decline, driver acceptance, en-route/start/completion actions, simulated handover/return photos and notes, and payment confirmation.
- Earnings, transactions, and manual payout history.

## Separate admin web preview

Open `/admin` directly in the web preview. It is not linked from mobile navigation and renders an unavailable message on native platforms.

- Mock admin email: `admin@camotesdrive.demo`; mock MFA code: `123456`.
- Overview metrics/chart, users, verification checklist, listing moderation, bookings, payments, compliance, disputes, reviews, settings, and an in-memory audit log.
- Chauffeured service defaults to disabled. The admin preview can enable its fictional demo flag after entering an accreditation number and a future validity date. Booking displays sample professional driver, plate, and LTFRB case details.
- The admin UI uses React Native Web within this Expo project. A separate Next.js admin application, as proposed in the PRD, has not been created.

## Project fixes

- Fixed Tailwind content scanning to include `src/`.
- Fixed Metro's NativeWind stylesheet path to `src/global.css`.
- Replaced the starter home screen's Supabase query with the mock Explore screen. Existing Supabase configuration remains unused by the new UI.
- Added shared in-memory demo state and kept non-route implementation outside `src/app/`.
- Added Expo-compatible ESLint tooling/configuration. Updated the starter web color-scheme hook to use a hydration-safe external-store snapshot and pass the current React lint rules.

## Validation

- `npx expo lint` — passed.
- `npx tsc --noEmit` — passed.
- `npx expo export --platform web --output-dir .expo/web-build` — passed; 24 static routes generated.
- `npx expo export --platform android --platform ios --output-dir .expo/native-build` — passed; both native bundles generated.
- Local web server returned HTTP 200; reviewed a desktop screenshot to verify the NativeWind styling and layout.
- No Android or iOS device/simulator runtime testing was performed. Bundle export is not a signed native build or a device test.

## Mock scope and remaining production work

The demo opens as a verified renter with preview owner/driver roles. Mode switching, sign-in, MFA, verification, payments, approvals, prices, and booking transitions are UI simulations, not security or financial controls. Shared demo changes reset on app reload; some screen-specific changes reset when the screen is remounted. The listing draft stores basic form fields, not real photos or documents.

Dates use October 2026 fixtures and PHP values. Date fields are editable UI inputs rather than native date/time pickers. Photos/proofs/documents use simulated attachment controls; directions and support actions display local feedback. No camera, real uploads, actual calls/maps, email delivery, push notifications, biometric authentication, offline queue/cache, resumable uploads, or forced-version update service is connected.

Production still needs the backend, server-enforced permissions and eligibility, conflict prevention, persisted drafts/messages, real accreditation and document expiry checks, payment evidence storage, privacy/security review, final legal copy, and device QA. Chauffeur accreditation details shown in this prototype are fictional.

## Run

```sh
npx expo start
npx expo start --web
```

Use the header mode switch or Profile to preview the provider experiences. Start with Explore → vehicle details → reserve → submit → My Trips. Switch to Owner to accept a pending request, then return to Renter to view the updated trip.

Documentation checked before implementation: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo documentation index](https://docs.expo.dev/llms.txt), [Expo Router layouts](https://docs.expo.dev/router/basics/navigation-layouts/), and [safe areas](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/).
