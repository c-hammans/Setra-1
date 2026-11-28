# Setra push notification setup

Push registration and delivery require `NEXT_PUBLIC_SETRA_PUSH_ENABLED=true` at build time. Leave it unset or false for the initial beta. An authenticated scheduler can still create in-app session reminders while push is off.

Push delivery uses the existing `app_notifications` records. The database creates best-effort delivery jobs, and the scheduled server route delivers those jobs to every enabled device.

## 1. Apply the migrations

Run these in order through the Supabase SQL editor if they have not already been applied:

1. `20261124000300_add_unified_notification_centre.sql`
2. `20261124000400_add_push_notifications.sql`
3. `20261124000500_schedule_push_dispatch_on_supabase.sql`

The push migration preserves existing notification preferences, defaults every push category to off, enables RLS, and keeps subscription secrets inaccessible to browser queries.

## 2. Generate one VAPID key pair

Run this once:

```bash
pnpm exec web-push generate-vapid-keys
```

Keep the private key secret. Do not generate a new pair for each deployment because existing device subscriptions use the original public key.

## 3. Add deployment environment variables

Add these in Vercel for Production, Preview where required, and local development where required:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated public key>
VAPID_PRIVATE_KEY=<generated private key>
VAPID_SUBJECT=mailto:<real support email address>
CRON_SECRET=<long random secret>
SUPABASE_SECRET_KEY=<existing Supabase server secret>
```

`VAPID_SUBJECT` must be a real `mailto:` address or HTTPS URL. Do not use a localhost address.

## 4. Configure scheduled delivery on Supabase

The scheduler runs in Supabase rather than Vercel, so Setra can remain on Vercel Hobby. The migration enables Supabase Cron, `pg_net` and Vault, then schedules one secure dispatch request every minute.

After setting `CRON_SECRET` in Vercel, run this once in the Supabase SQL Editor using the same secret value:

```sql
select public.configure_push_dispatch(
  'https://setra-1.vercel.app/api/push/dispatch',
  'PASTE_THE_SAME_LONG_CRON_SECRET_HERE'
);
```

The URL and bearer secret are encrypted in Supabase Vault. They are not exposed to authenticated or anonymous app users. Redeploy Setra after adding the Vercel environment variables, then use Supabase Dashboard → Integrations → Cron to confirm `setra-push-dispatch-every-minute` is running successfully.

## 5. iPhone setup

On iPhone or iPad, add Setra to the Home Screen, open that installed app, then choose Notifications, enable a push category, and tap **Enable push**. iOS only offers standards-based web push to installed Home Screen web apps and only shows its permission prompt after that direct tap.
