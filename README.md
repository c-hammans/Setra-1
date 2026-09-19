# Setra

Setra is a mobile-first training diary for strength, endurance and hybrid athletes. It supports reusable workout templates, scheduling, live strength logging, structured endurance sessions, History, PBs, awards, weekly planning and share cards.

## Architecture

- Next.js App Router and React
- Supabase Authentication and Postgres with Row Level Security
- Cookie-based authenticated sessions through `@supabase/ssr`
- A data-service layer under `lib/data` keeps UI components independent of database column names
- Account-scoped browser storage protects active drafts and queues changes while cloud sync is unavailable
- Kilograms are the canonical strength-load storage unit; pounds are converted only at the UI boundary

Authenticated accounts use Supabase as the source of truth. Browser storage remains a recovery layer for active work and the one-time legacy local-data importer. When Supabase is not configured, the repository can still run as a local prototype with sample data; sample history is never shown as an authenticated user's history.

## Local setup

Requirements: Node.js 22 and pnpm 11.

1. Run `pnpm install`.
2. Copy `.env.example` to `.env.local` and provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`.
3. Apply every migration in `supabase/migrations` to the matching Supabase project, in filename order. Test migrations in a non-production project first.
4. Run `pnpm dev` and open [http://localhost:3000](http://localhost:3000).

Never add a Supabase service-role/secret key to browser environment variables or commit secrets.

## Verification

```bash
pnpm lint
node --experimental-strip-types --test lib/awards/*.test.ts lib/import/*.test.ts lib/security/*.test.ts lib/setra/*.test.ts
pnpm build
pnpm start
```

Before release, verify signup, confirmation, login/logout, password reset, draft recovery, offline retry, strength/endurance saves, schedules, imports and two-account RLS isolation against an isolated Supabase project. Browser emulation does not replace a final iPhone test.

## Vercel and iPhone

Add the same three public variables to each relevant Vercel environment. Set `NEXT_PUBLIC_SITE_URL` to the deployed HTTPS origin for Production. Apply database migrations before deploying code that calls new database functions.

On iPhone, open the deployed URL in Safari and choose **Share → Add to Home Screen**. Setra uses local draft recovery and syncs authenticated data through Supabase when connectivity returns.

## Current limitations and owner actions

- Premium, AI coaching and device/provider integrations are previews only; billing and AI are not connected.
- Image/PDF workout extraction is unavailable. Import accepts reviewed pasted text or text-based files only.
- Account deletion is a confirmed request workflow, not immediate automatic erasure. The owner must define and operate the deletion process.
- `/legal` and `/support` identify where owner-approved privacy, terms and support details are required. Placeholder copy is not a published legal policy.
- Analytics uses an internal privacy-safe event interface only. No external provider is connected.
- Migrations are never applied automatically by the web application.

See [the remediation checklist](docs/remediation-audit.md) for the current reliability audit and evidence boundaries.
