# Completed activity imports

Open **Profile → Integrations** or **Import completed activity** from Training history or Today’s endurance quick actions. File import is available to all signed-in users, including Free accounts. Review the sport, activity date, original metrics and any recorded laps before saving. A planned match is never selected automatically.

## Deployment

Apply `supabase/migrations/20261127000300_add_activity_file_imports.sql` through the normal Supabase migration workflow before deploying this feature. It adds an owner-readable import provenance table, a server-only transactional import function and a linked-completion guard. The existing server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` signs short-lived previews and authorizes the import. No new environment variable, OAuth app, storage bucket, or scheduled job is required. Each upload is capped at 3 MiB with one file per review.

## What the formats support

- **FIT:** one completed endurance activity, parsed with the official Garmin FIT JavaScript SDK. Session and lap summaries can contain active and elapsed time, distance, average speed, elevation gain, heart rate, power, cadence, swim lengths and pool length, depending on the file. The upload checks the checksum. Multisport activities, workout definitions, courses and unsupported FIT sports are rejected.
- **TCX:** one completed activity with laps. Reported lap duration and distance are summed only when present across the entire activity. Tracked timestamps can establish elapsed time. Sensor averages are included only when a supported measured aggregate is available.
- **GPX:** one ordered timestamped track. Distance is estimated from coordinates within each segment; no segment-to-segment jumps are added. Active time and sensor aggregates are not inferred. Select a sport when the file does not identify it.

The original archive, route geometry, device serial number and raw sensor streams are not saved. The receipt stores normalized metrics and up to 500 actual laps. Active time is used for the canonical duration when known; otherwise elapsed time is used. The original timers are labelled separately in the receipt. Unrelated lap indices are not treated as prescribed intervals. Canonical planned prescriptions remain separate from completed results. A future adapter may supply a verified step mapping instead of attempting to infer one from lap order.

## Identity, matching and reconciliation

- Exact retries are deduplicated per user by SHA-256 fingerprint. Re-exports that carry the same start second also deduplicate across supported file formats. A conflict in this identity is conservative: it does not replace the existing activity. History keeps a receipt if a linked completed activity is later removed.
- Related planned sessions are ranked by activity date, sport, duration and distance where available. A server check confirms ownership, active plan state, sport, date proximity and absence of a linked completion or active session. A planned match records the canonical completion and marks the occurrence complete in one transaction.
- A nearby completed entry can be selected explicitly for reconciliation. This attaches original file metrics to the existing entry without changing its manually logged results, notes or planned-session relationship. The review flags likely duplicates; distinct activities can be confirmed separately.
- New eligible file activities use the existing completed-session writer, so their core metrics feed the existing History, PB, Awards, Weekly Progress, analytics, goal tracking, coaching and Adaptive reads. Rich lap/device-only metrics are displayed in original results; they aren’t flattened into unrelated analytics fields. Reconciliation does not recalculate historical results.

## Provider policy boundary

User-uploaded files are separate from partner API data. Before saving, the user confirms that they are allowed to bring the data into Setra’s normal training experience. That acknowledgement is not an override of provider terms.

The integration contract normalizes provider data into an activity result with explicit permissions for AI, coaching, social, sharing/export and analytics. The canonical model is shared by many consumers, including derived metrics. As a result, **all connector sources are fail-closed today**: the server admission policy rejects them, and the database forbids linking connector receipts to canonical sessions. Restricted connector receipts cannot be returned by the user-facing history or export. No connector data can contribute indirectly to PBs, awards, comparisons or prompts. A future adapter with selective permissions will need independent, policy-aware read and aggregation paths before it can expose any allowed use.

## Official Garmin connectivity next

1. Apply for the [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/overview/) and request Activity API access for Setra. Use Garmin-provided developer tooling and approved sample data from the [Activity API](https://developer.garmin.com/gc-developer-program/enterprise/activity-api/).
2. Confirm the licensed terms for each downstream use separately, including coach visibility, social comparisons, sharing, exports, AI, retention and deletion. Do not promote data into the general training model unless these uses are approved or a selective read path exists.
3. After approval, implement official [OAuth 2.0 with PKCE](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE.pdf), with server-only token storage, consent and disconnect/revocation. Implement the approved delivery/backfill path using Garmin activity identifiers and idempotent handling. Device workout push is separate.

Strava is intentionally inactive. Do not implement it without reviewing the applicable [Strava API policy](https://www.strava.com/legal/api_policy) and obtaining any approvals needed for Setra’s intended uses.

## Checks

`pnpm test:reliability` includes the representative FIT run/ride/swim fixtures, TCX/GPX, matching, preview security and fail-closed policy. `pnpm test:browser tests/browser/activity-import.spec.ts` tests the review UI on narrow and desktop viewports with mocked endpoints. `tests/activity-file-imports.sql` exercises actual canonical writes and owner isolation on an isolated migrated database. On an installed iPhone app, try one file from Files, confirm a planned match, verify it in Training history, and select the same file again to confirm deduplication.
