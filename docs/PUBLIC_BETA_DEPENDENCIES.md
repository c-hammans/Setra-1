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
