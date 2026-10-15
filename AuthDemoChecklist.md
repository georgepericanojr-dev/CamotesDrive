# Authentication demonstration checklist

Use this checklist with an existing confirmed test account and a second account with an active `admin` role. Keep the current CamotesDrive palette. Do not use a real customer's account for a demonstration.

## Automated browser regression checks

Local checks completed for this update: **32 validation/Auth SDK tests** and **14 HTTP API tests** passed, along with lint, app typecheck, and Edge Function typecheck. SDK tests use the real installed client with isolated storage and HTTP fixtures. Run them with `npm.cmd run test:auth` and `npm.cmd run test:api`.

Android, iOS, and web exports also passed using `npx.cmd expo export --platform all --output-dir .expo/auth-demo-build`.

The browser suite below is prepared but was not executed successfully in this update because browser-launch approval was declined. Its scenarios describe expected results, not completed browser checks.

The implemented UX includes field-specific errors (including empty submissions), friendly Auth error codes, a global success notice that survives navigation, password visibility, loading/duplicate-submit protection, keyboard focus handling, and entrance/error animations that respect reduced-motion settings. Normal login opens the home dashboard; admin sign-in preserves `/admin`. Both profile and admin sign-out require an explicit confirmation. The existing palette is unchanged.

Start the web development server in one terminal:

```powershell
npx.cmd expo start --web --port 8091
```

Run the checks in another terminal:

```powershell
node scripts/test-auth-browser.cjs
```

The script opens an isolated headless Edge or Chromium profile and exercises the actual app and Supabase client. It intercepts all remote browser requests with HTTP fixtures and blocks unmatched remote requests. It does not create accounts, send emails, sign into a hosted account, or change the hosted database. These checks verify application behavior; use the live checklist below to verify your deployed Auth and API configuration.

Optional PowerShell configuration:

```powershell
$env:AUTH_APP_URL = 'http://localhost:8083'
$env:AUTH_BROWSER_PATH = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
node scripts/test-auth-browser.cjs
```

Only set `AUTH_BROWSER_PATH` if the script cannot find your installed browser. `AUTH_DEBUG_PORT` can select another Chrome DevTools port if `9339` is occupied.

The checks cover the web root redirect to `/admin`, renter login at `/auth`, hidden navigation, required fields, email validation, password visibility, Auth error messages, network failure, loading feedback, duplicate submission protection, successful login to `/explore`, persisted sessions, administrator access checks, and logout confirmation/cancellation. They also cover a remote logout failure using the real SDK behavior: the SDK can clear the current device's session even when the server request fails, so the app returns to login with an explicit warning instead of restoring cleared credentials.

## Live demonstration

1. Start signed out. On web, opening `/` automatically lands on `/admin`; choose **Sign in** to use the admin login, or open `/auth` directly for the renter checks below. On Android/iOS, startup opens login directly. Confirm that the login form has no app navigation or role switch.
2. Press **LOGIN** with both fields empty. Confirm that the email and password requirements are explained and the app stays on the form.
3. Enter an invalid email address. Confirm that the form asks for a valid email before sending a login request.
4. Enter an email and leave the password empty. Confirm that the password requirement is explained.
5. Enter a password and use **Show password**, then **Hide password**. Confirm that the text and button label change, and that changing visibility preserves the entered value.
6. Enter the wrong password for your test account. Confirm that the app explains the incorrect credentials and permits another attempt.
7. Try a clearly nonexistent email. Supabase normally returns the same `invalid_credentials` code for an unknown email and a wrong password. The app must explain both possibilities without claiming it has confirmed whether the account exists. A specific `user_not_found` response can show the specific account-not-found message.
8. Where email confirmation is enabled, try an unconfirmed test account. Confirm that the app asks the user to verify the email address.
9. Disable the device's connection and submit. Confirm that a connection error appears and the form becomes usable again. Restore the connection before continuing.
10. Sign in with the confirmed test account. Confirm the loading indicator, disabled controls during submission, **Successful login** notice, loaded account identity, app navigation, role switch, and dashboard.
11. Reload `/explore` on web or restart the mobile app. Confirm that the existing session restores and the renter dashboard remains accessible. Opening the web root `/` always leads to the admin entry.
12. Open the profile and press **Sign out**. Choose **Cancel**. Confirm that the session, profile, and current screen remain available.
13. Press **Sign out** again and choose **Yes, sign out**. Confirm the loading indicator, return to the login screen, and **Signed out successfully** notice. Reload a protected URL such as `/trips` and confirm that login is required.
14. On web, open `/admin`, choose **Sign in**, and use the admin test account. Confirm that sign-in returns to the admin dashboard and loads data. Check that an ordinary renter account receives the admin-access-required message instead.
15. Repeat logout cancellation and confirmation from the administrator dashboard. Confirm that the administrator also returns to login only after successful confirmation.
16. On Android/iOS, check that the keyboard does not cover the fields or submit button, that the screen scrolls on small displays, and that the system back/dismiss action cancels an idle logout confirmation. During an active logout request, keep the dialog in place until the outcome is known.

## Admin dashboard design checks

- On `/admin`, confirm that the grouped sidebar opens all 12 existing sections and that the top-bar **Sign out** still opens the confirmation dialog. On a narrow browser, use **Open admin navigation** to access the same sections.
- Check the overview metrics, recent users, attention queue, and latest audit entries against the database. Vehicle totals count approved listings; recent users display preferred mode and account ID. The overview refreshes every 30 seconds while the app is active.
- Use the search field to find a real user, booking, or vehicle. Search covers the latest 100 records per category, as stated in the UI. Open a match, clear the search, and check **Previous** / **Next** when a list has more than 25 records.
- Open records from each section. Confirm that the review drawer provides the existing actions, closes before opening a booking or reported chat, and remains open when a save fails. Renter and admin roles are read-only; provider review controls apply to Owner and Driver requests.
- Verify that reviewing an eligible vehicle preserves the driver eligibility toggle, and that opening a historical payout leaves the new manual payout draft intact. Perform any payment, refund, account, or approval changes only with designated test records.
- Use **Refresh admin data** from the top bar. Confirm loading, empty, and error states, and retry failed requests. The bell opens the document review section.
- Open **Users**, then **Roles**. Confirm each role shows the same account name and initials as Users, including on later pages and in its review drawer. If the deployed roles API does not include names yet, the app looks up only the current page's account IDs using the signed-in administrator's profile read permissions. Migration `202610150003_admin_role_names.sql` can still supply names directly from the API. Only profiles with genuinely empty names display **Unnamed account**; failed lookups show a retryable error. Role decisions must still affect the selected account. Run `npm run test:roles` for lookup regression checks.

## Android file upload checks

- Open **Profile → Verification documents → See checklist** on a phone. Switch between self-drive, booking with a driver, listing a vehicle, and working as a driver. Confirm the required document names and instructions are clear for each purpose.
- For an owner, select different vehicles and confirm each checklist uses only that vehicle's documents. Vehicles offering a driver show LTFRB authority and passenger insurance; business-owned vehicles also show the business documents.
- Verify missing, in-review, rejected, expired, and approved checklist states using designated test records. A still-valid approved document must remain approved while a replacement is in review. Annual review due dates must not appear as current approval.
- Choose a document type, read its file guidance, accept consent, upload a file, and submit for review. Switching types or vehicles clears the previous file and document details. A license or other document requiring expiry cannot be submitted without its expiry date. Confirm submitted records appear below the form with rejection reasons when applicable.
- `npm run test:verification` checks checklist progress calculations locally; the mobile layout and actual file selection still need the device checks below.

These are physical-device checks; the local upload regression suite uses picker/file-reader adapters and does not certify Expo Go behavior.

1. Restart Expo and reload the app in Android Expo Go to receive the upload changes.
2. Sign in with an ordinary test account. Open **Verification**, choose a document type, and accept document-processing consent.
3. Choose a small PDF from Android Files or Downloads. Confirm the upload succeeds, then press **Submit for review** and verify that the document appears. Repeat with a JPEG or PNG, and open the submitted private evidence from the authorized account/admin.
4. Cancel file selection and confirm that no upload or document record is created.
5. Choose an oversized or empty file. Confirm an actionable error and no upload. Verification files allow up to 10 MB; vehicle photos, handover photos, and payment proofs allow up to 5 MB.
6. Check a cloud document provider if available. If the file cannot be read, confirm that the app asks you to reselect it or download it locally before retrying.
7. Check vehicle photos, payment proofs, and handover photos with designated test records. Repeat basic file selection on iOS and web after the Android-specific fix.

Android reads the system picker's selected file directly using its temporary access grant. iOS keeps cache copying, and web uses the browser File. The original Android error originated in the local file reader before the Supabase upload request. The change does not request broad device storage access.

Run isolated local regressions with `npm.cmd run test:uploads`.

## Date picker and branding checks

- On Android, open a date field and confirm the native picker appears. Choose a date, cancel a second selection, and verify cancellation preserves the previous value. On iOS, use the picker sheet's **Done** / **Cancel** controls. On web, check the browser calendar and keyboard access.
- Pick dates in Explore, open a vehicle, then reserve it. Confirm both dates carry into Booking. Pickup and return remain at 9 AM Philippine time. Catalog results do not imply availability for those dates; reservation checks still run on the server.
- Check that booking return dates respect the listing's minimum and maximum rental days, and that changing pickup repairs an out-of-range return date.
- Try profile birth dates, document issue/expiry dates, vehicle authority validity, admin-verified dates, and TNC settings. Check optional clearing, future birth-date prevention, and issue/expiry ordering.
- In Availability, choose another month, select blocked dates, switch months, and return. Confirm unsaved selections remain and that **Save unavailable dates** saves the month currently displayed.
- Verify the supplied logos on login, the app header, and the admin sidebar, and the uploaded icons in navigation/admin controls. Check white icons on the green sidebar and saved/unsaved heart states.
- Check launcher and splash artwork in a fresh native preview/production build. The app uses `assets/branding`; `assets/expo.icon` is retained as the original Expo template and is not selected by the current app configuration.

Run date boundary and timezone checks with `npm.cmd run test:dates`. Physical-device picker behavior and native artwork still require the manual checks above.

## Configuration if live checks fail

- Confirm `.env` has the project's public Supabase URL and publishable/anon key, then restart Expo after changing environment variables.
- Confirm that `camotes-api` is deployed and that `ALLOWED_ORIGINS` contains the browser's exact origin, including its port.
- Apply the migrations listed in [Summary3.md](Summary3.md), plus `202610150002_remove_admin_mfa.sql` if applicable to your setup.
- Follow [AdminAccountSetup.md](AdminAccountSetup.md) to grant an active admin role through trusted database administration.
- Configure the app's exact email redirect URL in Supabase Auth before demonstrating email verification or password reset. Sending the message and opening the callback need a live manual check.

The automated suite simulates failure responses and slow requests. A passing local suite does not certify hosted project configuration, real email delivery, or physical-device behavior; record those live checks separately. The checklist describes expected behavior; verify the script's final output before recording the automated checks as passed.
