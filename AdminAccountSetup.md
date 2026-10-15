# Create a CamotesDrive admin account

CamotesDrive admins use the **web app** at `/admin`. Access requires a real Supabase Auth session, an active `admin` database role, and an active profile. Sign in with email and password; MFA is no longer required.

The MFA-removal migration was applied to the connected CamotesDrive Supabase project on October 15, 2026. A live database check confirmed admin access with an `aal1` session. The migration instructions below also cover other or fresh projects.

## 1. Complete the database and API setup

Follow [Summary3.md](./Summary3.md) first:

- Install the initial schema from `supabase_dbschema.md` if it has not already been installed.
- Apply `supabase/migrations/202610150001_api.sql`.
- Apply `supabase/migrations/202610150002_remove_admin_mfa.sql` to remove the old database MFA requirement. Existing projects should run this incremental file in SQL Editor; do not reinstall the initial schema.
- Apply [202610150003_admin_role_names.sql](supabase/migrations/202610150003_admin_role_names.sql) in SQL Editor to show account full names in Roles. This updates the existing admin read function; role decisions still use account UUIDs internally. Refresh the admin panel afterward. If you reapply migration `001`, reapply `002` and `003` afterward.
- Deploy the `camotes-api` Edge Function.
- Configure `.env` with the same project's public Supabase URL and key.

For browser access, the deployed function's `ALLOWED_ORIGINS` setting must allow the exact origin you open. For example, `http://localhost:8083/profile` has the origin `http://localhost:8083`. Set it through Supabase Edge Function secrets, or run:

```powershell
npx supabase secrets set ALLOWED_ORIGINS=http://localhost:8083 --project-ref YOUR_PROJECT_REF
```

Use your actual browser port and project reference. Do not include `/profile` or `/admin`. If you also use a hosted web app, include its origin in the comma-separated list. Do not leave `https://YOUR_WEB_ORIGIN` as the value. This setting belongs to the deployed function; putting it only in Expo's `.env` does not change the API's CORS policy.

Do not rerun the initial schema on an existing database. Admin setup does not require putting a service-role key in the frontend.

## 2. Register your account

1. Start the web app from the project directory:

   ```powershell
   npm run web
   ```

2. Open the URL printed in the terminal and visit `/auth`.
3. Register using your name, email address, and a strong password.
4. Confirm your email using the verification link if email confirmation is enabled. Complete the callback screen if prompted. The exact web callback URL must be allowed in Supabase Auth URL Configuration; see Summary3.
5. Sign in with that account.

Registration creates the account's profile and default renter role. It does not grant admin permissions.

## 3. Find the correct account UUID

Open your Supabase project's **SQL Editor** and run this query, replacing the email address:

```sql
select
  u.id as auth_user_id,
  u.email,
  u.email_confirmed_at,
  p.id as profile_id,
  p.account_status
from auth.users u
left join public.profiles p on p.auth_user_id = u.id
where lower(u.email) = lower('your-admin@example.com');
```

Verify that the email belongs to the intended administrator, `email_confirmed_at` is populated, `profile_id` exists, and `account_status` is `active`. Copy `profile_id` for the next step. In this schema, newly registered users have the same Auth and profile UUID.

If the query returns no row, register the account in this same Supabase project first. If the profile is missing, check that the initial schema and signup trigger were installed successfully before proceeding.

## 4. Grant the admin role

Run this in the SQL Editor as the project's trusted database administrator. Replace **both occurrences** of `REPLACE_WITH_PROFILE_UUID` with the UUID from step 3.

```sql
begin;

insert into public.user_roles (
  user_id,
  role,
  status,
  verified_at
)
values (
  'REPLACE_WITH_PROFILE_UUID'::uuid,
  'admin',
  'active',
  now()
)
on conflict (user_id, role)
do update set
  status = 'active',
  verified_at = now(),
  rejection_reason = null;

select user_id, role, status, verified_at
from public.user_roles
where user_id = 'REPLACE_WITH_PROFILE_UUID'::uuid
  and role = 'admin';

commit;
```

The result should show `role = admin` and `status = active`. This preserves the account's renter/owner/driver roles. An admin role must be assigned through trusted database administration; changing signup metadata or frontend code cannot grant access.

## 5. Open the admin dashboard

1. Sign out of the web app and sign in again so it reloads your roles.
2. Open `/admin` on the same web app origin. For example, if Expo prints `http://localhost:8083`, open `http://localhost:8083/admin`. You can also select **Admin dashboard** from your web profile.
3. The dashboard loads after the app checks your account and active admin role. No authenticator enrollment or code is required.

Opening `/admin` while signed out takes you through sign-in and returns you to the dashboard. Existing Supabase MFA factors are not deleted by this change; the application simply no longer requires them for administrator access.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Admin sign-in | Sign in with the account you granted the role to. |
| Admin access required | Verify `public.user_roles` has the exact account UUID with `role = 'admin'` and `status = 'active'`; sign out/in after granting it. Also check any API error banner. |
| Old MFA screen still appears | Reload the updated app or restart Expo. The current admin screen no longer contains an MFA step. |
| Admin API rejects access despite an active admin role | Apply `202610150002_remove_admin_mfa.sql` to remove the previous database `aal2` gate, then reload. |
| API unavailable or missing migration | Apply the incremental migration and deploy `camotes-api` following Summary3. |
| Cannot reach the API after successful sign-in | Check the Edge Function's `ALLOWED_ORIGINS` secret. It must contain the current browser origin including its port, not an example placeholder. Reload after updating it. |
| Account inactive | Inspect `public.profiles.account_status` and resolve the account restriction through trusted administration. |
| Administration is available on the web only | Open the browser version of the app, rather than its native Android/iOS screen. |

There are no demo admin credentials. Use the real account's email and password.

## Revoke admin access

To remove administrative privileges while preserving the user account, run:

```sql
update public.user_roles
set status = 'suspended'
where user_id = 'REPLACE_WITH_PROFILE_UUID'::uuid
  and role = 'admin';
```

Admin API authorization checks the database role on each request, so a suspended admin role cannot continue making admin requests even with an existing signed-in session.

This guide creates no account and grants no permissions by itself. The SQL changes take effect only when you run them in your Supabase project.
