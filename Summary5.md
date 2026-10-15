# CamotesDrive — Login redesign and admin access update

## Overview

Removed the admin MFA requirement and redesigned the login screen around the third screen in the supplied reference image. The existing green, cream, mint, and coral palette was preserved. App navigation and role switching now appear only after sign-in.

## Login design

Created `src/screens/auth.tsx` as a dedicated authentication screen and updated `src/app/auth.tsx` to use it. Removed the old authentication form from `src/screens/account.tsx`, which still contains the profile, email callback, and other account screens.

The new layout includes:

- A centered, narrow form that adapts to mobile and desktop widths.
- A circular island image with the CamotesDrive brand mark and name, using an existing local image.
- Mint email/password fields with icons, focus borders, and accessible labels.
- A password visibility toggle and a prominent green login button.
- **Forgot Password?** and **Sign Up** links, with matching registration and reset forms.
- Loading indicators, disabled submission while processing, duplicate-submit protection, and inline success/error messages.
- A scrollable layout with iOS keyboard avoidance and email/password autofill settings.

The design follows the reference's arrangement while retaining the existing app colors. No changes were made to the Tailwind palette and no dependencies were added.

## Navigation and role switching

Updated the shared `Screen` component in `src/components/camotes/ui.tsx`:

- Desktop sidebar, top navigation/header controls, notifications, and mobile bottom tabs are hidden when signed out.
- Navigation stays hidden on `/auth` routes, including the email callback, even if a session becomes available during authentication.
- Navigation and the role switcher appear on normal app screens after sign-in.
- Role cycling now uses the number of verified modes instead of assuming every account has three modes. Accounts with two available modes no longer cycle to an undefined mode.

The dedicated login page does not use the app navigation shell. This change controls visibility; private data and actions continue to rely on backend authorization.

## Authentication behavior preserved

The redesigned forms still use real Supabase Auth for email/password sign-in, registration, and password-reset emails. Signup retains name collection and terms/privacy consent. Email confirmation continues through the existing callback screen.

Sign-in from the admin page preserves the destination through `/auth?next=/admin`. The destination is restricted to `/admin` or the normal `/profile` fallback.

## Admin MFA removal

Removed the authenticator enrollment, QR code, code input, verification step, and MFA SDK calls from `src/screens/admin.tsx`. Admin access still requires a signed-in user with an active account and active database admin role. Account loading, permission errors, and retry handling remain available.

Added [202610150002_remove_admin_mfa.sql](./supabase/migrations/202610150002_remove_admin_mfa.sql), which:

- Replaces `camotes_private.is_admin()` with an authenticated-session and active-admin-role check.
- Removes the previous `aal2` requirement from the central admin authorization rule used by RLS and API functions.
- Updates existing database API error messages to describe active-role requirements.
- Can be reapplied without deleting application data or changing role assignments.
- Preserves existing Supabase MFA factors; it removes the application's requirement to use them.

The migration was applied to the connected Supabase project on **October 15, 2026**. A live database verification using temporary `aal1` session claims confirmed both the admin permission check and admin API read succeeded. That verification rolled back its temporary session settings; it did not sign in through the browser as the administrator.

Updated the initial schema, API migration messages, PRD, and [AdminAccountSetup.md](./AdminAccountSetup.md) to reflect the current role-based access. Older summaries include notes identifying their MFA descriptions as historical.

## Main files

| File | Change |
| --- | --- |
| `src/screens/auth.tsx` | New login, registration, and password-reset layout |
| `src/app/auth.tsx` | Routes to the dedicated authentication screen |
| `src/screens/account.tsx` | Removes the old form; retains other account flows |
| `src/components/camotes/ui.tsx` | Session-based navigation visibility and corrected mode cycling |
| `src/screens/admin.tsx` | Removes the admin MFA step |
| `supabase/migrations/202610150002_remove_admin_mfa.sql` | Incremental database upgrade for admin authorization |
| `supabase_dbschema.md` | Current admin rule for fresh installations |
| `supabase/migrations/202610150001_api.sql` | Updated authorization error messages |
| `scripts/test-database.mjs`, `scripts/api-routes.test.mjs` | Updated authorization and upgrade coverage |
| `AdminAccountSetup.md`, `PRD.md`, earlier summaries | Current setup requirements and historical notes |
| `Summary5.md` | This summary |

## Validation

- `npx.cmd expo lint` — passed.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run check:edge` — passed during the admin update.
- `npm.cmd run test:db` — **98 checks passed**, including admin access without MFA, legacy migration upgrades, mutation permissions, migration reapplication, and rejection of unauthorized/inactive users.
- `npm.cmd run test:api` — **14 HTTP checks passed**.
- `npx.cmd expo export --platform all --output-dir .expo/login-build` — Android, iOS, and web bundles exported successfully, including 25 static web routes.
- Checked the exported login HTML: login, email/password fields, signup, and reset links were present; navigation tabs and role-switch controls were absent.

The SDK emitted its existing nonblocking Auth lock deprecation warning during export. No physical-device interaction or browser end-to-end sign-in test was performed for the redesign.

## Using the update

Reload `/auth` to view the new login screen. Navigation returns on normal app screens after sign-in. Admins can sign in with email/password and open `/admin` without an authenticator step.

The MFA-removal migration is already applied to the connected project. Other existing projects should apply that incremental migration after the initial API migration. The login redesign itself needs no additional database migration or Edge Function deployment.

## Follow-up: login at app startup

The first navigation update hid guest navigation but left `/` opening Explore. Added session-aware protected routes in `src/app/_layout.tsx`: the app waits for saved-session restoration, shows login when signed out, and removes signed-in screen history when the session ends. Auth callbacks, legal/support pages, and the admin sign-in fallback remain accessible. Fixed the login badge image's explicit dimensions so it stays circular on web and native.

Eight checks in an isolated mobile-sized browser confirmed signed-out startup and Explore/trip URLs reach login, login has no navigation or role switch, legal and recovery pages remain accessible, admin sign-in preserves its destination, and signup opens correctly. No account credentials were used.
