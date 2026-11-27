# Ask Setra

Ask Setra uses the same server-side Adaptive AI provider as Weekly Training Review. It is gated by the `ask_setra_training` entitlement and does not require a schedule or background job.

## Configuration

1. Confirm the existing Weekly Training Review migration, `20261124000600_add_adaptive_weekly_reviews.sql`, has already been applied.
2. Apply `supabase/migrations/20261124000700_add_ask_setra.sql`.
3. Keep the existing `AI_PROVIDER` and `OPENAI_API_KEY` server variables.
4. Optionally set `OPENAI_ASK_SETRA_MODEL`. It defaults to `gpt-6-luna`.

## Context selection

Question routing is deterministic and does not consume a separate AI request. Ask Setra identifies strength, endurance, week comparison, feedback, goal, program, recommendation and medical-context questions. It always includes a compact weekly summary, then adds only relevant sections from the recent 84-day window.

Detailed context is bounded to:

- up to 12 recent completed sessions
- up to 12 upcoming planned sessions
- up to 10 strength exercise summaries
- aggregate endurance activity summaries
- current strength and standard-distance endurance personal bests
- up to 20 relevant check-ins, with comments limited to 240 characters
- active goals and program context
- up to four stored Weekly Reviews
- the previous six conversation turns

Friends, billing, account details, coaching records belonging to another person and private workout notes are not included.

## Usage controls

The database atomically claims each client request ID. Repeated delivery of the same request does not trigger a second model call. Each user is limited to four requests per rolling minute and 40 requests per rolling 24 hours. Model, provider, tokens and estimated cost are stored on the completed turn.
