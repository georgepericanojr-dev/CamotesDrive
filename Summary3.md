# CamotesDrive — API and database integration

## What changed

Replaced the demo data provider and hardcoded application records with real Supabase Auth, database, and Storage connections. The React Native/NativeWind screens now call a Supabase Edge Function REST API. No service-role key is included in the app or required by the function.

The implementation is local code. **No migration, function deployment, account creation, or production data changes were performed against your hosted Supabase project.** Complete the setup below before expecting database-backed screens to work.

## Enable it in Supabase

1. If you have not installed the initial schema, run the SQL from `supabase_dbschema.md` in your project's SQL Editor first. Do not rerun that initial installation on an existing database.
2. Run the entire file `supabase/migrations/202610150001_api.sql` in the SQL Editor. This is an incremental migration; it preserves existing application data and can be reapplied. It adds the API RPC functions and supporting columns/indexes.
3. From this project directory, deploy the function using the Supabase CLI:

   ```powershell
   npx supabase login
   npx supabase functions deploy camotes-api --project-ref YOUR_PROJECT_REF --no-verify-jwt
   ```

   `supabase/config.toml` also sets `verify_jwt = false`. This allows public catalog routes and current signing-key configurations. Every private endpoint still explicitly validates its bearer token through Supabase Auth `getUser()` and checks database permissions. Do not remove those checks.

4. Keep your public project configuration in `.env`, using `.env.example` as the template:

   ```dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
   EXPO_PUBLIC_AUTH_REDIRECT_URL=camotesdrive://auth/callback
   ```

   The API URL defaults to `<SUPABASE_URL>/functions/v1/camotes-api`. `EXPO_PUBLIC_API_URL` is an optional override. Never put a service-role or secret key in an `EXPO_PUBLIC_` variable. The existing `.env` was not modified; `.gitignore` now excludes environment files except the example.

5. In Supabase Auth URL Configuration, allow the exact callback URL used by your app. Use the development build's `camotesdrive://auth/callback` callback for native, or your actual web `/auth/callback` URL for web. Set the environment variable to the matching URL for each build. Restart Expo after changing environment variables. The callback screen handles email verification and password recovery.
6. For web deployments, optionally restrict browser origins:

   ```powershell
   npx supabase secrets set ALLOWED_ORIGINS=https://YOUR_WEB_ORIGIN --project-ref YOUR_PROJECT_REF
   ```

   Multiple origins can be comma-separated. Include development web origins when needed. Native requests do not require a browser Origin header. CORS does not replace authentication.
7. Create real accounts through registration. Bootstrap an administrator using the trusted SQL instructions in the initial schema, then enroll and verify TOTP in the web admin panel. Admin APIs require both an active database admin role and an `aal2` session. Demo admin credentials no longer work.
8. Add real listings and complete document/role reviews. An empty catalog is expected until an owner has an approved listing. No fake vehicles, balances, bookings, or messages are seeded.

The Edge Function reads Supabase's injected `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEYS.default`, with a legacy `SUPABASE_ANON_KEY` fallback. You do not need a service-role secret for this design.

## Connected frontend flows

- **Authentication and account:** register, sign in/out, email callback, password recovery, secure native session persistence, profile updates, notification preferences, provider role requests, and account deletion requests.
- **Explore and listings:** server-side search/filtering and pagination, listing details, real photos, favorites, owned listing drafts/editing/submission/deactivation, and real file uploads.
- **Bookings:** database pickup locations, driver selection, server-calculated quotes in centavos, price-change checks, rental terms acceptance, idempotent booking creation, role/status-filtered trip pagination, and detail screens using actual booking IDs.
- **Trip operations:** owner/driver acceptance, decline/cancel reasons, driver en-route state, pickup/return evidence uploads, handover records, start/completion, eligible reviews, and participant contacts.
- **Payments:** manual payment references/proofs, owner/admin receipt confirmation, refunds, deposit returns/withholding, and administrator payout records. These operations record money movements; they do not transfer funds.
- **Provider tools:** dashboard, vehicle and driver availability, driver preferences, completed gross earnings, and payout history.
- **Messages and notifications:** persisted booking conversations, idempotent messages, focused chat polling, reports/blocks, notifications, and saved read states.
- **Administration:** real paged database resources, document and role verification, listing approval, account status, payment/refund records, payouts, disputes, review moderation, settings, and audit history. Private document access uses short-lived signed URLs.

The old `src/state/demo.tsx` and `src/data/mock.ts` were removed. Static branding, explanatory copy, and presentation fallback imagery remain. Loading, empty, retry, and error states now reflect actual API results; connection failures do not fall back to fake records.

## API reference

Base URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/camotes-api`

Requests use the public project key in the `apikey` header. Private routes additionally require `Authorization: Bearer <user access token>`. JSON POST bodies use `Content-Type: application/json`. Successful responses return `{ "data": ... }`; failures return an error and request identifier.

| Method | Routes | Purpose |
| --- | --- | --- |
| GET, public | `/vehicles`, `/vehicles/:id`, `/settings`, `/locations` | Approved catalog and public configuration |
| GET | `/me`, `/owned-vehicles`, `/saved` | Account, verified roles, owned/saved listings |
| GET | `/bookings`, `/bookings/:id`, `/bookings/:id/messages` | Authorized trips, detail, and conversation |
| GET | `/notifications`, `/documents`, `/availability`, `/drivers`, `/earnings` | User/provider resources |
| GET | `/admin/:section` | Whitelisted admin resources; admin role and MFA required |
| POST | `/me`, `/me/mode`, `/me/deletion-request`, `/roles`, `/driver-profile` | Profile, mode, requests, driver settings |
| POST | `/favorites`, `/vehicles`, `/documents`, `/availability` | Favorites, listing drafts, uploaded document records, calendar |
| POST | `/vehicles/:id/photo`, `/vehicles/:id/submit`, `/vehicles/:id/deactivate`, `/vehicles/:id/delete` | Listing lifecycle; deletion is a soft delete |
| POST | `/bookings/quote`, `/bookings` | Quote and booking request |
| POST | `/bookings/:id/accept`, `/decline`, `/cancel`, `/start`, `/complete`, `/en_route`, `/handovers` | Booking actions; each suffix follows `/bookings/:id` |
| POST | `/payments`, `/payments/:id/confirm`, `/payments/:id/reject`, `/settlements` | Manual receipts and settlements |
| POST | `/messages`, `/notifications/read`, `/reviews`, `/blocks`, `/reports` | Communication and safety records |
| POST | `/admin/documents/:id`, `/admin/roles/:user_id`, `/admin/vehicles/:id`, `/admin/users/:id`, `/admin/disputes/:id`, `/admin/reviews/:id` | Protected administrative actions |
| POST | `/admin/settings`, `/admin/payouts` | Settings and recorded payouts |

The executable route map is `supabase/functions/camotes-api/routes.ts`. The frontend call sites show each request payload. List endpoints cap a page at 50 rows; catalog/trips/admin views expose pagination. Chat polls while focused rather than requiring a Realtime publication.

## Security and database behavior

- The function validates the session and forwards the caller's JWT to `camotes_read` / `camotes_mutate`. Their pinned-search-path SQL functions explicitly check identity, active account, roles, booking participation, and MFA where required. Existing RLS and storage policies remain in force for direct access.
- Renter/owner/sender/reviewer identities come from the authenticated account. URL identifiers override conflicting body/query identifiers. Client fields cannot grant roles, approve documents, overwrite a verified birth date, or confirm the client's own payment.
- Prices and payment amounts come from the database. Booking/payment/message/payout request keys protect retries. Booking transitions, availability exclusions, document gates, and funds caps are checked transactionally.
- Approved listings reopen as drafts before edits. Pickup locations are validated and their town is derived from the location record. Conflicting committed vehicle/driver reservations are rejected.
- File records must refer to actual objects in the caller's upload folder. Private files are viewed using signed URLs. Real picker uploads support native/web ArrayBuffers.
- HTTP handling includes a 64 KiB streamed request-body limit, timeouts, structured status codes, configurable CORS, and no-store responses. A database counter limits committed mutation calls per user per minute; it is not a complete infrastructure abuse-control service.
- User-specific frontend caches are cleared on account changes and guarded against stale responses. Native Auth sessions use chunked SecureStore persistence, with Auth refresh tied to application activity.

## Main files

- `supabase/functions/camotes-api/`: HTTP router, authentication, CORS, route definitions, Deno configuration.
- `supabase/migrations/202610150001_api.sql`: incremental database API installation.
- `src/lib/api.ts`, `supabase.ts`, `auth-storage.ts`, `uploads.ts`: network, Auth, session storage, and Storage clients.
- `src/state/app.tsx`, `src/hooks/use-resource.ts`: authenticated application state and resource loading.
- `src/data/models.ts`: database-to-UI mappings, money and Manila date helpers.
- `src/components/camotes/api-ui.tsx`: asynchronous actions and request states.
- `src/screens/`, `src/app/auth/callback.tsx`: connected mobile/admin screens and Auth callback.
- `scripts/api-routes.test.mjs`, `scripts/test-database.mjs`: HTTP and database validation.

Installed Expo-compatible SecureStore, DocumentPicker, Crypto, and FileSystem modules. SecureStore's config plugin is configured in `app.json`. PGlite is a development dependency for local database checks. Native builds must be rebuilt to include newly added native modules.

## Validation

- `npx.cmd expo lint`
- `npx.cmd tsc --noEmit`
- `npm.cmd run check:edge`
- `npm.cmd run test:api`: **14 passing HTTP route checks**.
- `npm.cmd run test:db`: **75 passing checks**, installing the entire initial schema and incremental API migration in local PostgreSQL/PGlite with Supabase Auth/Storage stubs. Includes permissions, MFA, privacy, quote/request/accept/payment/handover/completion, retries, trip filters, reviews, calendar conflicts, refunds, and safe migration reapplication.
- `npx.cmd expo export --platform all --output-dir .expo/api-build`: successful Android, iOS, and web bundles, including 25 statically rendered web routes. The installed Auth SDK emits a nonblocking deprecation warning for its compatibility lock option.

The database checks do not replace a hosted Supabase integration test. Live Auth redirects, Storage uploads, actual TOTP, and physical-device persistence still need validation after deployment.

## Remaining infrastructure

Account deletion currently queues an auditable request; an administrative deletion/anonymization worker must process it. Push/email delivery workers, durable offline queues, upload cleanup/compression, and a payment gateway are not implemented. Notification preferences persist, but do not provision push delivery. Earnings show completed gross income and recorded payouts rather than claiming an available bank balance. Existing legal text still needs final business review.

## Documentation consulted

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo documentation index](https://docs.expo.dev/llms.txt)
- [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase React Native authentication](https://supabase.com/docs/guides/auth/quickstarts/react-native)
