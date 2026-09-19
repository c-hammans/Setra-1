# Reliability remediation checklist

This checklist records the hands-on audit requested on 19 September 2026. It distinguishes implemented fixes from work that needs a connected test project or physical-device verification. It is not a production deployment record.

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

- [ ] Apply the unapplied migrations to a disposable/staging Supabase project in order.
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
