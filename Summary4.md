# CamotesDrive — Admin setup and fixes

> Later update: admin MFA has been removed at the user's request. The MFA references below describe this earlier update. See `AdminAccountSetup.md` and `supabase/migrations/202610150002_remove_admin_mfa.sql` for the current role-based setup.

This update documents administrator account setup, fixes browser access to the API, improves the admin sign-in experience, and resolves the reported React Native text-node warning.

## Admin account guide

Created [AdminAccountSetup.md](./AdminAccountSetup.md) with:

- Registration and email confirmation steps.
- SQL to find the correct account/profile UUID and grant its active admin role.
- Instructions to enroll an authenticator and verify MFA.
- Troubleshooting for account permissions, connection failures, and MFA.
- SQL to suspend administrative access while preserving the user account.

Admin access still requires an active database admin role, an active account, and an MFA-verified session. The guide itself does not create accounts or grant permissions.

## Fixed browser API access

The user could sign in successfully, but the frontend displayed “Cannot reach CamotesDrive” and could not load the profile or roles.

Read-only requests identified the cause: the deployed Edge Function's `ALLOWED_ORIGINS` value was the literal example `https://YOUR_WEB_ORIGIN`. Requests from the actual app origin were rejected with HTTP 403 and “Origin not allowed.”

Updated the hosted Supabase secret to:

```text
ALLOWED_ORIGINS=http://localhost:8083
```

Verified immediately afterward with that browser origin:

| Request | Result |
| --- | --- |
| `GET /health` | HTTP 200, status `ok` |
| `GET /settings` | HTTP 200 with database settings |
| `OPTIONS /me` | HTTP 204 with the expected CORS headers |

The allowed-origin response matched `http://localhost:8083`. This was a hosted configuration change; no database rows, account roles, or schema were changed during these fixes.

Updated [Summary3.md](./Summary3.md) and the admin guide to explain that origins include the scheme, hostname, and port, exclude paths such as `/profile`, and must use actual values. The secret belongs to the deployed Edge Function, rather than Expo's frontend environment file.

If the development port changes or a hosted web app is added, update the comma-separated allowlist to include every origin still needed. The current value permits the reported localhost origin.

## Improved admin access and account loading

- Added a web-only **Admin dashboard** link on the profile for accounts whose loaded database roles include an active admin role.
- Preserved the admin destination through sign-in: the admin page opens `/auth?next=/admin`, and successful sign-in returns to `/admin`. The destination is restricted to `/admin` or the normal `/profile` fallback.
- Added explicit identity loading and error states. The admin page displays a connection error and retry action when account permissions cannot be loaded, instead of treating that failure as missing admin access.
- Changed application refresh to collect settings, identity, bookings, and owned vehicles independently with `Promise.allSettled`. A failed bookings or provider request no longer discards a successful profile/role response.
- Kept the existing guards against stale responses after account changes. Authorization failures clear the cached identity.
- Improved the API client's error messages to distinguish a timeout from a connection/CORS failure and explain where the web allowlist is configured.

Admin remains a separate web dashboard. Renter, Owner, and Driver modes continue to describe the mobile experience. Database authorization and MFA checks remain enforced by the backend.

## Fixed “Unexpected text node” warnings

The MFA card used this condition while the QR-code value was initially an empty string:

```tsx
{qr && <Image ... />}
```

That expression returned an empty string as a child of the card's `View`. Changed the condition to `!!qr` so an absent QR code produces a boolean rather than a text child.

Also corrected the same class of issue elsewhere:

- Boolean-coerced optional subtitle, action, and screen-title conditions in shared UI.
- Removed two explicit `{" "}` children inside trip-screen `View` containers.

## Files changed

| File | Purpose |
| --- | --- |
| `AdminAccountSetup.md` | Administrator creation, MFA, troubleshooting, and revocation guide |
| `Summary3.md` | Corrected browser-origin setup instructions |
| `src/state/app.tsx` | Independent refresh results and identity loading/error state |
| `src/lib/api.ts` | Clearer connection and timeout errors |
| `src/screens/account.tsx` | Admin dashboard link and safe sign-in destination |
| `src/screens/admin.tsx` | Access loading/error/retry UI and QR-code condition fix |
| `src/components/camotes/ui.tsx` | Safe optional text conditions |
| `src/screens/trip.tsx` | Removed stray text children |
| `Summary4.md` | This summary |

## Validation and limits

- Expo lint and TypeScript checks passed after the fixes.
- All 14 existing HTTP API route checks passed, including CORS handling and protected routes.
- The Edge Function TypeScript check passed.
- A local React Native Web render reproduced the warning with an empty-string `View` child and produced no warning with a boolean child.
- Live read-only checks confirmed public API access and browser preflight from `http://localhost:8083` after updating the hosted secret.

The live checks did not sign in as the administrator or verify that account's role/MFA setup. Complete those steps through the web app at `http://localhost:8083/admin`. No new API deployment or database migration is required for these frontend fixes; reload the local app to use them.
