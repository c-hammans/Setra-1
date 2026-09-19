# Setra analytics event interface

Setra currently sends no analytics to an external provider. `lib/analytics/events.ts`
defines the small, privacy-safe event contract that a consented adapter can use later.

Allowed properties describe modality, source, outcome and aggregate counts only.
Workout notes, dates of birth, email addresses, exact workout dates, exercise loads,
health metrics and other sensitive training details must not be attached to events.
