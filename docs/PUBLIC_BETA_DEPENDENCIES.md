# Public beta owner inputs

Setra deliberately does not invent these details. Before a public beta, the owner must provide and approve:

- A public support destination for `NEXT_PUBLIC_SUPPORT_URL` (a support form URL or approved `mailto:` address).
- The legal entity or individual operating Setra and an approved contact address.
- Applicable jurisdiction and governing-law wording.
- A verified list of production data processors/vendors.
- Approved retention and deletion timelines, including backups.
- Approved privacy-policy and terms text covering account, training, analytics, export and deletion data.
- Effective dates and version/change-notification process for those documents.

Until those inputs are supplied, `/legal` remains clearly labelled as unfinished and is not presented as an approved policy.

The operational deletion-request process must also identify who receives a request, how identity is verified, how fulfilment/failure is communicated, how long completion takes, and how database/storage backups are handled. The current product records a request; it does not claim immediate erasure.

# 24 September audit rollout gates

- Back up the target database, then apply `20260924000100_analytics_milestone_deduplication.sql`. Verify the earliest existing first-plan/first-completion event remains and a later duplicate is rejected without failing the client request.
- Use two disposable accounts to verify RLS for every owned table and write RPC. Do not use production personal training data for destructive tests.
- With a disposable account, force an offline completion, reload, reconnect, then verify exactly one cloud completion and no remaining queue item.
- Use two separate browser profiles/devices to edit the same disposable record, resolve the conflict each way, reload, and restore a retained recovery backup.
- Verify sign-up confirmation, password reset, callback allow-listing and expired-session handling from the supported staging origin.
- On a physical iPhone and installed web app, verify 320/360/390/430-equivalent layouts, keyboard-open forms, pinch zoom, enlarged text, safe areas, VoiceOver dialog focus, native-share success/cancel/failure and exported-image parity.
- Run a large-account export with more than 1,000 records, inspect its JSON sections, and confirm partial/timeout copy under a controlled failure.

# First-party product analytics

`product_analytics_events` stores only the approved event name, event time and four optional non-sensitive dimensions: modality, source, outcome and count. It does not store workout notes, exercise details, profile fields or email addresses. `client_event_id` makes repeated delivery idempotent. The following definitions are used:

- `onboarding_completed`: the onboarding workflow reached its saved completion state.
- `first_session_planned`: the account created its first planned session.
- `first_session_completed`: the account completed its first genuine training session.
- `template_reused`: a saved template was used to create training.
- `import_started`, `import_reviewed`, `import_saved`, `import_failed`: major stages of the import funnel.
- `weekly_return`: one event per account and configured training-week start, after prior training exists.
- `weekly_review_used`: the Weekly Preview was opened.
- `save_failed`: a cloud save attempt ended in an actionable failure.
- `draft_recovered`, `workout_abandoned`, `training_mode_used`: recovery, abandonment and modality usage signals.
