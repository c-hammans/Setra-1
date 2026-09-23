-- First-account milestones are semantic one-offs, even when separate devices
-- submit them with different client event identifiers at the same time.
with ranked as (
  select id,
         row_number() over (partition by user_id, event_name order by occurred_at, created_at, id) as occurrence
  from public.product_analytics_events
  where event_name in ('first_session_planned', 'first_session_completed')
)
delete from public.product_analytics_events
where id in (select id from ranked where occurrence > 1);

create unique index if not exists product_analytics_events_one_off_milestone_idx
  on public.product_analytics_events (user_id, event_name)
  where event_name in ('first_session_planned', 'first_session_completed');
