# Proactive Training Recommendations

Recommendations are gated by `ai_recommendations` and use the shared Adaptive AI provider. No cron schedule is required.

## Setup

1. Apply the Weekly Review and Ask Setra migrations first.
2. Apply `supabase/migrations/20261127000100_add_proactive_recommendations.sql`.
3. Keep `AI_PROVIDER` and `OPENAI_API_KEY` configured on the server.
4. Optionally set `OPENAI_RECOMMENDATIONS_MODEL`. It defaults to `gpt-6-luna`.

## Generation

Deterministic rules evaluate a compact combination of the last completed week, the preceding four-week average, recent exercise history, upcoming planned sessions, active goals and recent athlete check-ins. If no rule has meaningful evidence, no AI request is made.

Eligible candidates are generated after a Weekly Review, after the existing cloud-synced training-change event, or by an explicit user refresh. The database source hash prevents duplicate generation for unchanged evidence. Active recommendations become outdated when their evidence hash changes.

AI is used only to select up to three eligible candidates and phrase the forward-looking recommendation. Evidence displayed to the user comes directly from the deterministic rule and cannot be replaced by model output.
