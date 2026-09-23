# Reliability remediation checklist

The current A01–A24 assessment for the 23 September 2026 audit is maintained in [`AUDIT_REMEDIATION_2026-09-23.md`](./AUDIT_REMEDIATION_2026-09-23.md). The historical notes below are retained as evidence of earlier remediation passes.

This checklist records the hands-on audit requested on 19 September 2026. It distinguishes implemented fixes from work that needs a connected test project or physical-device verification. It is not a production deployment record.

## 21 September complete-pass follow-up

The follow-up pass was assessed against `635c6b5`. The status below deliberately separates code changes, local verification and configured-backend verification.

| Requested area | Implementation status | Local verification | Backend / device boundary |
| --- | --- | --- | --- |
| 1. Persistence, retry and conflict handling | Improved. Supabase/PostgREST errors are normalised at the service boundary; retryable, validation, duplicate/stale and conflict results are separated; queued saves compact by entity with completion/delete barriers; exact acknowledgements cannot remove a newer operation; cross-tab storage events and reconnect replay trigger queue processing; legacy authenticated write entry points are revoked by the new migration. | Plain-object PostgREST error tests, duplicate/stale retry tests, queue compaction, completion barrier, delete overlay, reload recovery, lint and production build pass. | Apply `20260921000100_reconcile_training_lifecycle.sql`. Multi-device conflicts still use the existing numeric revision head, whose seed is client-generated. The new conflict UI preserves work instead of silently discarding it, but a fully clock-independent expected-server-version protocol remains a release follow-up. Test two devices with deliberately different clocks before calling that portion complete. |
| 2. Planned/completed lifecycle | Implemented in an additive migration for strength and endurance completion edits, association/date changes and deletion. Dangling links are repaired only when the completion is provably absent. Ambiguous history is not altered. | Strength partial/full definitions share the existing canonical completion utility; regression suites and build pass. | Requires migration plus reload checks for partial→complete, complete→partial, delete, date change and association change. |
| 3. Validation and logging inputs | Strength previous values are explicitly labelled `PREV` and copied only through a `Use previous` action. Blank completed numeric load displays `Not recorded`; completion controls expose pressed state. Endurance zero values no longer bypass minimal-entry confirmation and the flag is persisted by the migration. | Validation tests include zero duration/distance, future dates, negative values, nested targets and deliberate minimal entries. Live strength UI was rendered locally. | Physical iPhone keyboard/focus and server validation need testing after migration. |
| 4. Onboarding and public access | Support, legal, auth callback/error and password-reset routes bypass account/onboarding gates. Onboarding has a bounded load timeout, retry, safe browser-storage access, accessible selections, 1–14 weekly goal and direct Log/Plan/Import destinations. | Public Support and the feedback deep-link were exercised in the running app; lint/build pass. | Sign-up confirmation and email reset delivery require the configured Supabase email environment. |
| 5. Today, calendar and Weekly Preview | Partial sessions count as recorded training. Recent History is limited to three entries and strength/endurance use consistent dates. A date-ranged current/previous-week actual-training summary separates strength/endurance counts from plan adherence. Weekly Review usage is measured once per opening action. | The Today page, Weekly Preview, Support and feedback modal were exercised in the running mobile-sized app. | Historical/future selected-week edge cases still need a seeded test account and physical-width matrix. |
| 6. Planning/template management | Existing status and template/occurrence separation are preserved; lifecycle migration prevents historical completions being left attached to the wrong occurrence. | Existing reliability/import/award suites and build pass. | A broader interaction redesign for one occurrence versus future occurrences was not introduced during this reliability pass. Real recurring-schedule testing remains required. |
| 7. History and Progress | Recent rows now use consistent dates/labels; summaries disclose their date range; unrecorded loads are not presented as zero. Existing PB eligibility continues to exclude incomplete, band and bodyweight data. | Completion and award regression tests pass. | The requested richer Progress trends and a complete historical investigation of every ambiguous kilogram PB were not safely inferable from local fixtures and remain a separately testable product increment. No historical value was guessed or converted. |
| 8. Awards and retention | Existing central award definitions/evaluator and canonical week utility are retained. Invalid zero/minimal data no longer silently becomes an ordinary measured completion. | Seven award regression cases pass, including week boundaries, rest days, planned-week eligibility, distances, time and volume. | Recalculation following migrated lifecycle edits/deletes needs connected-backend verification. |
| 9. Import Session | Existing source preservation/review flow remains; `import_failed` is now measured alongside started/reviewed/saved. Invalid input remains visible after failure. | Six parser tests pass for strength, unknown exercises, guidance, malformed input, nested intervals and activity-specific targets; production build passes. | Authenticated image/file analysis and duplicate-save protection require the configured analysis backend and synthetic fixtures. |
| 10. Profile/account operations | Feedback deep-link is reliable. Export now paginates every owned top-level dataset and identifies its cloud-only scope; failures return an actionable no-change response. Public signed-out Support works. | Routes compile; public Support and feedback were exercised. | Deletion fulfilment/cancellation and operator procedure remain owner/backend responsibilities. A request is still accurately described as a request, not completed deletion. |
| 11. Premium | Existing coming-soon states, free/premium abstraction and no-payment/no-fake-AI treatment are preserved. | Production build includes the Premium route. | No billing or AI was added. Copy/spacing was not materially redesigned in this reliability pass. |
| 12. Sharing/dialog accessibility | Share Studio now supports Escape, initial close-button focus, return focus and programmatic selected states. | The component compiles and build passes. | A single reusable focus-trapping dialog primitive has not yet replaced every older modal. VoiceOver, native share cancellation and exported-image parity require physical-device testing. |
| 13. Responsive/visual consistency | The compact Today hierarchy was visually checked in the running in-app mobile viewport; the new weekly summary respects the existing accent/theme system. | Mobile rendering inspected after a clean dev-server restart. | The full 320/390/430/768/1280 matrix, installed iPhone PWA, keyboard and large-text combinations remain manual gates. |
| 14. Product measurement | Existing privacy-safe adapter now covers import failure and weekly review usage in addition to onboarding, first plan/completion, weekly return, template reuse and save failure/recovery signals. No notes, raw import text or personal data are included. | Analytics unit test and full build pass. | There is intentionally no third-party destination until one is approved/configured. Browser custom events alone are not durable reporting. |

### Follow-up migration and repair policy

- The migration is additive and does not rewrite any applied migration.
- It repairs only a linked occurrence whose referenced completion no longer exists. It does not guess which completion belongs to an ambiguous historical plan.
- Editing a completed workout can move its linked occurrence or change partial/full status; deleting it returns the provably linked occurrence to planned.
- An intentional minimal endurance entry keeps its explicit confirmation through reload/edit.
- Before production rollout, export a backup and run the migration in the Supabase SQL editor, then execute the connected lifecycle checklist above with synthetic records.

## 19 September follow-up remediation matrix

| Finding | Status | Priority | Change / evidence | Remaining limitation |
| --- | --- | --- | --- | --- |
| Old acknowledgement removes newer queued edit | Fixed in code | Critical | Queue entries now have operation IDs and monotonic revisions; exact-ack regression test passes. | Staging multi-device test still required. |
| Delayed or out-of-order saves overwrite newer/completed data | Fixed in code, migration required | Critical | Per-entity ordered client writes plus revisioned RPC write heads, terminal completion protection and server stale-write rejection. | Apply `20260919000500_revisioned_persistence.sql`; test with real latency in staging. |
| Failed delete can be resurrected | Fixed in code, migration required | Critical | Durable delete queue entries, server tombstones, and cloud-overlay regression test. | Apply migration and force a failed delete in staging. |
| Cloud refresh overwrites pending local work | Fixed in code | Critical | Cloud results are overlaid with every unacknowledged revision before reaching UI state. | Browser quota/private-mode behaviour needs physical-device review. |
| Online temporary failures never retry | Fixed in code | High | Queue replay retries every 15 seconds and on reconnect. | Backoff is intentionally simple during beta. |
| Endurance −5 minutes accepted from another tab | Fixed in code, migration required | Critical | Whole-object validation is independent of the mounted tab; field-specific issues navigate to Details/Structure; server wrappers validate again. | Apply migration; physical iPhone input test required. |
| Untouched/name-only endurance completion | Fixed in code | High | Explicit minimal-entry confirmation is required and is revalidated server-side. | Product may later add a dedicated minimal-entry mode. |
| Future completed endurance activity | Fixed in code | High | Rejected against the user’s local date; planning remains available. | International midnight boundary needs staging/device coverage. |
| Partial strength session implies full plan completion | Fixed in code, migration required | High | Canonical derived completion marks partial work; partial counts as a training session but not full-plan adherence; Today, History, workout details, Weekly Preview and share cards retain the distinction. | Apply the migration and verify historic edge cases in staging. |
| All Training shows endurance-only zero totals | Fixed in code | High | All Training now shows combined session/time totals and explicitly labelled endurance distance. | Broader filter-state polish remains. |
| Bayesian Curl, Concentration Curl, Seated Leg Curl metadata | Fixed in code, migration required | Medium | Reviewed explicit inference map and stable-ID correction migration. | Full catalogue review remains ongoing; no historical IDs are merged. |
| Authentication busy state can stick on thrown/hanging request | Fixed in code | High | Auth requests use timeout, catch and finally; support/legal are reachable before sign-in. | Email delivery and expired links require staging configuration. |
| Onboarding silently bypasses profile-load error | Fixed in code | High | Recoverable retry screen; unfinished choices are account-scoped locally until successful save. | Cross-device unfinished onboarding cannot sync until a save succeeds. |
| Calendar dates and dots are inaccessible/ambiguous | Fixed in code | High | Week and month dates now expose full date, selected state, and planned/completed/skipped counts; skipped uses a distinct outlined diamond marker. | VoiceOver pronunciation still needs physical-device review. |
| Today copy contradicts partial completion | Fixed in code | High | A partially completed day is now stated explicitly instead of being described as a rest/open day. | Product wording can be refined after beta feedback. |
| Internal owner/support placeholder language | Fixed in code | Medium | Replaced internal implementation wording with honest beta-facing copy. | Owner must still supply approved legal text and a public support contact. |
| Import instruction attribution | Already partly resolved / deferred | Medium | Original input and retained guidance already exist; no destructive parser rewrite in this increment. | Per-exercise attribution and ambiguity UX need dedicated fixture work. |
| Modal focus containment and full responsive matrix | Deferred | Medium | Existing dialog semantics, Escape handling and background scroll lock retained. | VoiceOver, physical keyboard, 320/390/430/768/1280 render matrix still required. |
| Hybrid weekly review and durable retention analytics | Deferred | Medium | Existing weekly preview and privacy-limited analytics retained; no unsupported load score added. | Needs a separately scoped review UI and authorised analytics destination. |

## Confirmed and fixed in code

- [x] Active strength work is saved locally after meaningful changes and restored after refresh.
- [x] Local drafts and pending changes are scoped to the authenticated account.
- [x] Browser-storage failures surface an error instead of silently claiming success.
- [x] Pending strength drafts and schedule changes survive reload and retry after reconnection.
- [x] Strength schedules and nested strength/endurance saves have transactional database functions with per-user/item locks.
- [x] Streak sequence calculation reports correct current and historical longest streaks.
- [x] Unit preference is used at the strength UI boundary while canonical loads remain kilograms.
- [x] PB eligibility excludes incomplete, skipped, band and bodyweight work; labels identify highest-load records.
- [x] Overnight workout duration is retained and reconstructed after reload.
- [x] Partial completion preserves prescribed work and requires explicit confirmation.
- [x] Repeated Finish taps are blocked while completion is saving.
- [x] Text imports retain loads and standalone guidance or explicitly flag unparsed text.
- [x] Unsupported image/PDF import choices are hidden.
- [x] Known bodyweight exercise metadata errors are corrected by a reversible migration.
- [x] New authenticated accounts do not briefly inherit sample history.
- [x] Onboarding captures training mode, units and optional weekly target.
- [x] Home copy and Weekly Preview distinguish active, completed, overdue, upcoming and open days.
- [x] Browser zoom is restored; keyboard focus and reduced-motion defaults are present.
- [x] Authentication callback redirects are restricted to safe internal destinations.
- [x] Account export and deletion-request entry points exist without exposing service-role credentials.
- [x] Premium is removed from primary daily navigation and remains clearly a preview.
- [x] A privacy-restricted analytics adapter is documented without connecting a third party.

## Requires isolated Supabase verification before release

- [x] Apply the revisioned-persistence and reviewed-exercise-metadata migrations in order.
- [x] Apply `20260921000100_reconcile_training_lifecycle.sql` (user-confirmed 21 September 2026).
- [x] Update and reload an existing strength template through the reconciled RPC, then restore and reload its original value (connected verification 21 September 2026).
- [x] Create, reload, update, reload and delete a temporary template; confirm each revision persists and the deletion remains deleted after refresh (user-confirmed 20 September 2026).
- [x] Save and complete a temporary workout through the migrated cloud path (user-confirmed 20 September 2026).
- [ ] Force a child-row validation failure and verify the old nested workout/template remains unchanged.
- [ ] Complete/retry the same workout and verify one client record remains.
- [ ] Take a browser offline, edit a live workout, reload, reconnect and confirm the queued draft reaches Supabase.
- [ ] Sign in as two isolated users and attempt cross-account reads/writes for every owned table and RPC.
- [ ] Verify onboarding, account export and deletion request with a new staging account.
- [ ] Verify recurring schedules and one/future-occurrence rescheduling with real database data.

## Requires manual UI/device review

- [ ] iPhone Safari and installed-web-app keyboard behaviour during long live workouts.
- [ ] Small/typical phone, tablet and desktop layouts at default and enlarged text sizes.
- [ ] Dialog focus trapping/restoration with VoiceOver and a hardware keyboard.
- [ ] Share preview/export parity, transparent backgrounds, native-share cancellation and Photos behaviour.
- [ ] Long names, nested endurance repeats, Import review, History, Awards and Profile scrolling.

## Known remaining product/owner decisions

- Owner-approved privacy policy, terms, support contact and deletion operating procedure are still required.
- Immediate automated account erasure is intentionally not enabled; requests need an owner process.
- External analytics, billing, AI and watch/provider connections remain unconnected.
- A richer all-in-one completion summary can further combine awards, sharing and optional template creation; current completion is safe but some optional follow-up surfaces remain separate.
- Historical schedule evidence that was never stored cannot be reconstructed reliably and is not invented.

## Original remediation area status

| Area | Status | Evidence / next boundary |
| --- | --- | --- |
| 1. Baseline and checklist | Fixed | Repository, migrations and existing checks were inspected; this document records verified work and limitations. Destructive cloud tests remain staging-only. |
| 2. Saving and recovery | Fixed in code; migration and staging verification required | Exact acknowledgements, monotonic revisions, per-entity ordering, retries, tombstones, pending overlays and account-scoped storage are implemented. Multi-tab/device latency and transactional rollback still require a disposable Supabase project. |
| 3. Complete-record validation | Fixed in code; migration and device verification required | Endurance records and nested steps are validated as complete objects locally and in revisioned RPCs. Invalid drafts remain open. iPhone numeric-keyboard and international midnight cases remain manual checks. |
| 4. Status and completion | Fixed for strength primary/secondary surfaces; broader product model partly deferred | One canonical strength calculation drives partial/full eligibility across Today, calendar, History, details, Weekly Preview, sharing and awards adherence. A richer unified post-workout summary remains a future UX increment. |
| 5. Onboarding and authentication | Partly fixed | Unfinished choices persist per account, profile failure cannot bypass setup, auth busy states are bounded, and legal/support routes are public. Email delivery, expired links and full first-session routing require staging accounts. |
| 6. Today, calendar and Weekly Preview | Partly fixed | Partial/rest copy, date-labelled buttons, selected state, distinct partial/skipped markers and date-context logging are corrected. Overdue review/reschedule actions and Recent Work deduplication need a separate UI pass. |
| 7. Planning and templates | Partly resolved | Existing strength/endurance editors, scheduling, editing and deletion preserve history. Duplicate actions and clearer scheduled-versus-template consequences remain deferred. |
| 8. Import and exercise quality | Partly fixed | Original import text/guidance is preserved, unknown content is reviewable, unsupported file options remain hidden, and reviewed metadata is corrected without changing IDs. Per-exercise attribution for ambiguous rest instructions needs more fixtures and review UI. |
| 9. History and Progress | Partly fixed | All Training totals are genuinely combined, modality filters have correct scope, partial labels and grammar are corrected, and only completed sets feed exercise history/PBs. Endurance progress comparisons remain deferred. |
| 10. Awards, Profile and settings | Already substantially resolved; staging verification required | Award regression tests cover week boundaries, streaks, rest days and eligibility. Unit/theme/preferences persist; edit/delete recalculation and profile failure states need connected-account testing. |
| 11. Account support and data management | Partly implemented; owner-blocked | Export/deletion request endpoints and support navigation exist, and internal placeholder wording was removed. Approved policies, support contact and the operational deletion completion/failure process require owner decisions. |
| 12. Sharing, navigation and accessibility | Partly resolved | Partial context and grammar are retained, calendar controls are labelled, Escape/background locking exist, and Premium remains a preview. Full focus containment/restoration, native-share cancellation and exported-image parity require dedicated browser/device work. |
| 13. Responsiveness | Blocked on manual matrix / physical devices | Production build passes and the current phone-sized in-app rendering was inspected. The required 320/390/430/768/1280 matrix, physical iPhone keyboard, VoiceOver and native share must not be claimed from this environment. |
| 14. Hybrid review and measurement | Partly fixed / largely deferred | Weekly Preview uses trustworthy planned/completed/partial/skipped data. Weekly-return analytics now emits once per account/configured week only for returning trainees. Durable analytics collection and a comparative weekly-review screen remain unconfigured. |
| 15. Verification and delivery | Partly complete | Reliability, validation, import and award tests, lint, TypeScript and production build pass. Supabase migration, RLS, multi-device, offline reconnect and physical-device cases remain rollout gates. |
