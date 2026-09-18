begin;

alter table public.profiles
  add column if not exists weekly_session_goal smallint;

alter table public.profiles
  drop constraint if exists profiles_weekly_session_goal_check;

alter table public.profiles
  add constraint profiles_weekly_session_goal_check
    check (weekly_session_goal is null or weekly_session_goal between 1 and 14);

comment on column public.profiles.weekly_session_goal is
  'Optional number of completed sessions required for a successful configured training week.';
comment on column public.profiles.timezone is
  'IANA timezone used for local-day sessions, streaks and usage-day recording.';

create table if not exists public.user_usage_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null check (char_length(timezone) between 1 and 80),
  first_seen_at timestamptz not null default now(),
  primary key (user_id,local_date)
);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null check (char_length(achievement_id) between 1 and 100),
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id,achievement_id)
);

create table if not exists public.training_plan_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_key text not null check (char_length(occurrence_key) between 1 and 220),
  modality text not null check (modality in ('strength','endurance')),
  source_client_id text,
  planned_date date not null,
  status text not null default 'planned' check (status in ('planned','completed','skipped','cancelled','rescheduled')),
  linked_completion_client_id text,
  became_due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,occurrence_key)
);

create index if not exists user_achievements_user_earned_idx
  on public.user_achievements(user_id,earned_at desc);
create index if not exists user_usage_days_user_date_idx
  on public.user_usage_days(user_id,local_date desc);
create index if not exists training_plan_occurrences_user_date_idx
  on public.training_plan_occurrences(user_id,planned_date);
create index if not exists training_plan_occurrences_user_status_idx
  on public.training_plan_occurrences(user_id,status,planned_date);

drop trigger if exists training_plan_occurrences_set_updated_at on public.training_plan_occurrences;
create trigger training_plan_occurrences_set_updated_at
  before update on public.training_plan_occurrences
  for each row execute function public.set_updated_at();

alter table public.user_usage_days enable row level security;
alter table public.user_achievements enable row level security;
alter table public.training_plan_occurrences enable row level security;

drop policy if exists user_usage_days_select_own on public.user_usage_days;
create policy user_usage_days_select_own on public.user_usage_days
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists user_achievements_select_own on public.user_achievements;
create policy user_achievements_select_own on public.user_achievements
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists training_plan_occurrences_select_own on public.training_plan_occurrences;
create policy training_plan_occurrences_select_own on public.training_plan_occurrences
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists training_plan_occurrences_insert_own on public.training_plan_occurrences;
create policy training_plan_occurrences_insert_own on public.training_plan_occurrences
  for insert to authenticated with check ((select auth.uid()) = user_id and status in ('planned','skipped'));
drop policy if exists training_plan_occurrences_update_own on public.training_plan_occurrences;
create policy training_plan_occurrences_update_own on public.training_plan_occurrences
  for update to authenticated
  using ((select auth.uid()) = user_id and status <> 'completed')
  with check ((select auth.uid()) = user_id and status in ('planned','skipped','cancelled','rescheduled'));

revoke all on public.user_usage_days,public.user_achievements,public.training_plan_occurrences from anon;
revoke all on public.user_usage_days,public.user_achievements from authenticated;
grant select on public.user_usage_days,public.user_achievements to authenticated;
grant select,insert,update on public.training_plan_occurrences to authenticated;
grant update (weekly_session_goal,timezone) on public.profiles to authenticated;

-- Existing evidence is backfilled conservatively. Completed planned endurance
-- sessions are reliable because the prescription is retained and linked. Current
-- schedules are also reliable. Historical deleted/missed strength schedules are
-- intentionally not invented.
insert into public.training_plan_occurrences (
  user_id,occurrence_key,modality,source_client_id,planned_date,status,linked_completion_client_id,completed_at
)
select
  planned.user_id,
  'endurance:' || coalesce(planned.client_id,planned.id::text),
  'endurance',
  coalesce(planned.client_id,planned.id::text),
  planned.session_date,
  case
    when completed.id is not null then 'completed'
    when planned.skipped then 'skipped'
    when planned.status = 'cancelled' then 'cancelled'
    else 'planned'
  end,
  coalesce(completed.client_id,completed.id::text),
  completed.completed_at
from public.training_sessions planned
left join lateral (
  select actual.id,actual.client_id,actual.completed_at
  from public.training_sessions actual
  where actual.user_id = planned.user_id
    and actual.planned_session_id = planned.id
    and actual.status = 'completed'
  order by actual.completed_at asc nulls last
  limit 1
) completed on true
where planned.modality = 'endurance'
  and planned.status in ('planned','cancelled')
on conflict (user_id,occurrence_key) do nothing;

insert into public.training_plan_occurrences (
  user_id,occurrence_key,modality,source_client_id,planned_date,status
)
select
  scheduled.user_id,
  'strength:' || coalesce(template.client_id,template.id::text) || ':' || scheduled.scheduled_date::text,
  'strength',
  coalesce(template.client_id,template.id::text),
  scheduled.scheduled_date,
  case when scheduled.skipped then 'skipped' else 'planned' end
from public.scheduled_workouts scheduled
join public.workout_templates template on template.id = scheduled.template_id
on conflict (user_id,occurrence_key) do nothing;

commit;
