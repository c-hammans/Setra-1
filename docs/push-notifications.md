# Setra push notification setup

Push delivery uses the existing `app_notifications` records. The database creates best-effort delivery jobs, and the scheduled server route delivers those jobs to every enabled device.

## 1. Apply the migrations

Run these in order through the Supabase SQL editor if they have not already been applied:

1. `20261124000300_add_unified_notification_centre.sql`
2. `20261124000400_add_push_notifications.sql`

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

## 4. Scheduled delivery

`vercel.json` calls `/api/push/dispatch` every minute. Vercel automatically sends `CRON_SECRET` in the request authorisation header.

Per-minute Vercel cron execution requires Pro or Enterprise. Hobby supports daily cron execution only, which is not suitable for precise planned-session reminders. If the project remains on Hobby, use another trusted scheduler to call the same endpoint every minute with `Authorization: Bearer <CRON_SECRET>`.

## 5. iPhone setup

On iPhone or iPad, add Setra to the Home Screen, open that installed app, then choose Notifications, enable a push category, and tap **Enable push**. iOS only offers standards-based web push to installed Home Screen web apps and only shows its permission prompt after that direct tap.
