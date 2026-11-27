# Adaptive plan adjustments

From Progress, select **Propose change** on a current Recommendation, a suitable Ask Setra answer, or the latest completed Weekly Training Review. The preview does not change the plan. Select the sessions to include, edit the offered values within their bounds, then approve or decline. **Plan adjustment history** lists approvals and supports undo while every affected occurrence is still eligible and unchanged.

## Setup

Apply the Weekly Review, Ask Setra and Proactive Recommendations migrations first, then `20261127000200_add_adaptive_plan_adjustments.sql`. Retain the existing server-only Supabase credentials and Adaptive AI settings. Optionally use the existing `OPENAI_RECOMMENDATIONS_MODEL` override. No new jobs, dependencies, secrets or billing changes.

## Scope and safety

- Existing personal sessions from tomorrow through 28 days ahead only. Cloud-known active/completed work and all coach assignments are excluded. Browser approval also blocks local drafts and pending writes on the current device; an offline draft on another device is not visible to the server until it syncs.
- One bounded edit per session and up to three sessions per approval. Strength supports existing numeric kg prescriptions, set counts and integer rep targets. Strength rest, band/bodyweight load changes and strength add/replace/remove are not included. A strength override belongs to its scheduled occurrence and is invalidated by a later template edit. The existing manual remove/recreate flow for strength schedules does not transfer an override.
- Endurance supports existing distance, duration, RPE and supported pace targets, plus in-place repeat/step reductions. Nested block identities and parent links are retained. Simple endurance sessions can be cancelled or replaced with a short easy session where evidence supports a reduction. Added sessions are limited to short low-effort walks or rides on appropriately spaced dates.
- Preview selection is grounded in existing recommendation rules. The shared provider receives bounded options and may select only their identifiers or return none. Recent check-ins mentioning health concerns suppress generation. The provider cannot invent new values or write to the plan.
- Source fingerprints deduplicate previews per insight and support two new evaluations per five minutes and six per day. Proposals expire after 48 hours at approval. The service retains usage metadata from the shared provider.
- Approval and undo run transactionally. The database rechecks owner, Adaptive plan, current prescription, plan date, coach assignment and completion/draft state. The operation writes through the versioned endurance writer and targeted canonical strength schedule/occurrence writes. Audit snapshots are server-owned. Undo is all-or-nothing and never overwrites a later edit.

## Verification

Run `pnpm test:reliability` and `pnpm test:browser tests/browser/plan-adjustments.spec.ts`. The SQL fixture in `tests/adaptive-plan-adjustments.sql` is for an isolated, fully migrated test database and rolls its own data back.
