create table if not exists public.product_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id uuid not null,
  event_name text not null check (event_name in ('onboarding_completed','first_session_planned','first_session_completed','template_reused','import_started','import_reviewed','import_saved','import_failed','workout_abandoned','save_failed','draft_recovered','weekly_return','training_mode_used','weekly_review_used')),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id,client_event_id)
);
create index if not exists product_analytics_events_user_time_idx on public.product_analytics_events(user_id,occurred_at desc);
create index if not exists product_analytics_events_name_time_idx on public.product_analytics_events(event_name,occurred_at desc);
alter table public.product_analytics_events enable row level security;
grant select, insert on table public.product_analytics_events to authenticated;
drop policy if exists "analytics select own" on public.product_analytics_events;
create policy "analytics select own" on public.product_analytics_events for select to authenticated using (auth.uid()=user_id);
drop policy if exists "analytics insert own" on public.product_analytics_events;
create policy "analytics insert own" on public.product_analytics_events for insert to authenticated with check (auth.uid()=user_id);
