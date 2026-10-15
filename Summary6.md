# CamotesDrive — Mobile navigation and authentication updates

## Latest update

Mobile navigation now uses a short 180 ms fade instead of instant transitions. Android and iOS use the navigator fade; narrow browser layouts fade content without sideways movement. Reduced-motion settings still disable the transition.

The selected mobile navigation item now has one rounded mint background around both its icon and label. The selected icon is green and its label is bold green. Other items have neutral icons and no background highlight. The 180 ms fade, accessible selected state, desktop styling and existing navigation destinations remain unchanged.

Validation: Expo lint and TypeScript checks passed, along with all three navigation-motion regression checks. Reload Expo Go to apply. The visual result still needs checking on a phone.

## Previous instant-navigation update (superseded)

- Disabled screen transition animations on Android and iOS, and in browser layouts narrower than 1000 px. Navigation, detail pages, forms, login and logout now switch without a slide or fade.
- Disabled interactive swipe transitions on mobile. In-app Back and the device Back button continue to use the existing routes.
- Kept extra content entrance movement disabled on mobile and removed the app-controlled iOS date-picker slide. Android's system date picker follows the device's own presentation behavior.
- Removed the earlier left/right icon-direction parameters and calculation. Mobile main-section navigation keeps the existing replacement behavior, and tapping the currently selected item does nothing.
- Made the selected mobile navigation item easier to recognize: mint background, white icon inside a green pill, and bold green label. Selection follows the actual current route and is exposed through the accessible selected state.
- Preserved the CamotesDrive color palette, desktop behavior, authentication, logout confirmation, API calls and loading indicators. Instant navigation removes transition time; network requests may still take time to load.

### Files changed for this update

- `src/app/_layout.tsx` — enables instant navigation for native platforms and narrow browser layouts.
- `src/lib/motion.ts` — supports zero-duration transitions and disables mobile swipe animations.
- `src/components/camotes/ui.tsx` — updates selected icon/label styling and removes direction-based navigation.
- `src/components/camotes/motion.tsx` — documents the instant mobile behavior; content movement remains desktop-only.
- `src/components/camotes/date-field.tsx` — opens the custom date modal without animation.
- `scripts/navigation-motion.test.mjs` — replaces the previous direction checks with checks for instant navigation.

### Validation for this update

- `npx.cmd expo lint` — passed with no warnings.
- `npx.cmd tsc --noEmit` — passed.
- `node --experimental-strip-types --test scripts/navigation-motion.test.mjs` — all 3 checks passed.

Reload Expo Go or the mobile browser to receive the update. Physical-device visual checks remain: switch between navigation items, confirm the icon and label highlight, open a detail page, use Back, and confirm sign-out still requires confirmation.

## Earlier authentication work (historical notes)

The remaining sections describe the earlier authentication update. Their references to entrance, shake or fade animations are historical and have been superseded by the current mobile behavior above.

## Overview

Improved the login, registration, password reset, dashboard transition, and logout experience while preserving the existing CamotesDrive color palette and real Supabase authentication.

## Success and error messages

Added shared Auth error handling in `src/lib/auth-feedback.ts` and visible feedback throughout the authentication flow.

| Situation | Feedback |
| --- | --- |
| Successful login | “Successful login. Welcome back!” |
| Empty email | “Enter your email address.” |
| Empty password | “Enter your password.” |
| Invalid email format | Explains the expected email format before sending a request |
| Generic incorrect credentials | “Incorrect email or password, or the account does not exist.” |
| Specific `user_not_found` response | “Account does not exist. Check your email or sign up.” |
| Email not confirmed | Prompts the user to verify their email and check spam |
| Too many attempts | Asks the user to wait before retrying |
| Connection failure or timeout | Provides connection/retry guidance |
| Confirmed sign-out | “Signed out successfully.” |

Supabase normally returns the same `invalid_credentials` code for an unknown email and an incorrect password. The app explains both possibilities instead of claiming it knows which occurred. No account-enumeration endpoint was added.

Known registration, suspended-account, expired-session, and service-outage errors also receive appropriate messages. Unknown errors use a readable fallback instead of displaying arbitrary server details.

## Validation and UI improvements

- Empty submissions now show field-specific messages instead of leaving the user with a disabled button and no explanation.
- Email format/length, required passwords, registration name, minimum registration password length, and terms/privacy consent are validated.
- Existing login passwords are not forced to meet the newer registration minimum. Password spaces are preserved when sent to Supabase.
- Invalid fields receive highlighted borders and accessible error text. Submission focuses the first invalid input; the email keyboard action can move to the password field.
- Show/hide password remains available, preserves the entered value, and has accessible labels.
- Added a subtle entrance animation and error shake, respecting the device's reduced-motion preference.
- Loading indicators, disabled editing while submitting, and duplicate-submit guards prevent repeated requests.
- Registration and password reset retain inline success/error feedback. If account creation succeeds but profile completion fails, the app directs the user to complete their profile rather than reporting that account creation failed.

## Feedback across navigation

Created `src/components/camotes/app-notice.tsx` and mounted it above the navigator in the root layout. Notifications now remain visible through redirects and work on the standalone login screen, normal app screens, and admin dashboard.

Notices can be dismissed and automatically clear after six seconds. Removed the old screen-local notification renderer to avoid duplicate messages.

Normal successful login now opens the home dashboard at `/`. Admin sign-in preserves the restricted `/admin` destination. Existing session-based route protection and backend role checks remain in place.

## Logout confirmation

Created a reusable `SignOutButton` for the profile and web admin dashboard.

1. Pressing **Sign out** opens a confirmation dialog.
2. **Cancel**, or dismissing an idle dialog, keeps the user signed in without making a logout request.
3. **Yes, sign out** starts the request, shows a loading indicator, and prevents repeated confirmations or dismissal while processing.
4. Once the device is signed out, the app clears its private state and returns to login with feedback.

The dialog includes accessible labels, a fade transition, initial focus on Cancel, and inline error handling when sign-out cannot complete.

### Current-device session handling

Added `src/lib/auth-session.ts` and integrated it into application state. Sign-out uses Supabase's `local` scope, targeting the current device's session.

The installed SDK removes local credentials even if its remote sign-out request fails. The helper checks whether a local session remains before deciding the outcome:

- If local credentials were cleared, the user returns to login and sees “Signed out on this device. Server sign-out could not be confirmed.” The app does not restore those credentials.
- If sign-out fails while the session remains, the error is shown and the dialog allows retry or cancellation.

## Files added or updated

| File | Purpose |
| --- | --- |
| `src/screens/auth.tsx` | Form validation, animations, loading, messages, focus handling, and dashboard redirect |
| `src/lib/auth-feedback.ts` | Shared validation and friendly Auth error mapping |
| `src/lib/auth-session.ts` | Current-device logout outcome handling |
| `src/components/camotes/app-notice.tsx` | Global feedback across route changes |
| `src/components/camotes/sign-out-button.tsx` | Reusable confirmation dialog |
| `src/screens/account.tsx`, `src/screens/admin.tsx` | Profile/admin logout integration |
| `src/state/app.tsx`, `src/app/_layout.tsx`, `src/components/camotes/ui.tsx` | Session cleanup and global notification integration |
| `scripts/auth-feedback.test.mjs` | Validation and message tests |
| `scripts/auth-session.test.mjs` | Installed Supabase SDK session/login/logout tests |
| `scripts/test-auth-browser.cjs` | Prepared isolated browser regression suite |
| `package.json` | `test:auth` and `test:auth:browser` commands |
| `AuthDemoChecklist.md` | Automated check instructions and live demonstration checklist |
| `Summary6.md` | This summary |

No new dependencies, database migrations, or hosted configuration changes were needed for this update.

## Validation completed

- `npx.cmd expo lint` — passed.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run check:edge` — passed.
- `npm.cmd run test:auth` — **32 tests passed**: 20 validation/message tests and 12 integration tests using the actual installed Supabase SDK with isolated storage and HTTP fixtures.
- `npm.cmd run test:api` — **14 HTTP API checks passed**.
- `npx.cmd expo export --platform all --output-dir .expo/auth-demo-build` — Android, iOS, and web exports passed.
- `node --check scripts/test-auth-browser.cjs` — browser script syntax passed.

The SDK tests cover successful login, session persistence/restoration, incorrect credentials, password preservation, logout events, storage cleanup, and remote/storage failure handling. They use no real credentials and make no external requests.

## Demonstration checks still needed

The browser automation suite was prepared but did not complete because browser-launch approval was declined. Its scenarios are not recorded as passing browser tests. Live renter/admin sign-in, email delivery, and physical-device interactions still need a manual walkthrough using [AuthDemoChecklist.md](./AuthDemoChecklist.md).

The checklist includes login validation, password visibility, success/error feedback, dashboard loading, restored sessions, role restrictions, logout cancellation/confirmation, and network failure behavior.
