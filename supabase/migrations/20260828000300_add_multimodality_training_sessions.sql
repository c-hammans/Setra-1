begin;

alter table public.profiles
  add column if not exists training_preference text not null default 'strength';

alter table public.profiles
  drop constraint if exists profiles_training_preference_check;

alter table public.profiles
  add constraint profiles_training_preference_check
  check (training_preference in ('strength','endurance','hybrid'));

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  modality text not null check (modality in ('strength','endurance')),
  activity_type text not null check (char_length(activity_type) between 1 and 80),
  status text not null default 'planned' check (status in ('planned','in_progress','completed','cancelled')),
  title text not null check (char_length(title) between 1 and 120),
  session_date date not null,
  planned_start_time time,
  planned_duration_minutes integer check (planned_duration_minutes is null or planned_duration_minutes between 1 and 10080),
  planned_distance_metres numeric(12,3) check (planned_distance_metres is null or planned_distance_metres >= 0),
  target_rpe numeric(3,1) check (target_rpe is null or (target_rpe >= 0 and target_rpe <= 10)),
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_metres numeric(12,3) check (distance_metres is null or distance_metres >= 0),
  average_pace_seconds_per_km numeric(10,3) check (average_pace_seconds_per_km is null or average_pace_seconds_per_km >= 0),
  average_speed_kph numeric(8,3) check (average_speed_kph is null or average_speed_kph >= 0),
  average_split_seconds_per_500m numeric(10,3) check (average_split_seconds_per_500m is null or average_split_seconds_per_500m >= 0),
  completed_rpe numeric(3,1) check (completed_rpe is null or (completed_rpe >= 0 and completed_rpe <= 10)),
  average_heart_rate integer check (average_heart_rate is null or average_heart_rate between 20 and 260),
  elevation_gain_metres numeric(10,2) check (elevation_gain_metres is null or elevation_gain_metres >= 0),
  notes text not null default '',
  timezone text not null default 'Australia/Melbourne',
  skipped boolean not null default false,
  source text not null default 'manual' check (char_length(source) between 1 and 80),
  external_provider text,
  external_activity_id text,
  external_metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_id),
  check ((external_provider is null and external_activity_id is null) or (external_provider is not null and external_activity_id is not null)),
  check (status <> 'completed' or completed_at is not null)
);

create table if not exists public.training_session_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  client_id text,
  block_type text not null default 'custom' check (block_type in ('warmup','main','interval','recovery','cooldown','custom')),
  position integer not null check (position >= 0),
  title text not null default '' check (char_length(title) <= 120),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  repetitions integer check (repetitions is null or repetitions between 1 and 1000),
  planned_duration_seconds integer check (planned_duration_seconds is null or planned_duration_seconds >= 0),
  planned_distance_metres numeric(12,3) check (planned_distance_metres is null or planned_distance_metres >= 0),
  recovery_duration_seconds integer check (recovery_duration_seconds is null or recovery_duration_seconds >= 0),
  recovery_distance_metres numeric(12,3) check (recovery_distance_metres is null or recovery_distance_metres >= 0),
  intensity_target text not null default '' check (char_length(intensity_target) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  unique (session_id, client_id),
  foreign key (session_id, user_id) references public.training_sessions(id, user_id) on delete cascade
);

alter table public.workouts
  add column if not exists training_session_id uuid;

alter table public.scheduled_workouts
  add column if not exists training_session_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workouts_training_session_user_fk') then
    alter table public.workouts
      add constraint workouts_training_session_user_fk
      foreign key (training_session_id, user_id)
      references public.training_sessions(id, user_id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'scheduled_workouts_training_session_user_fk') then
    alter table public.scheduled_workouts
      add constraint scheduled_workouts_training_session_user_fk
      foreign key (training_session_id, user_id)
      references public.training_sessions(id, user_id)
      on delete restrict;
  end if;
end;
$$;

create unique index if not exists workouts_training_session_id_uidx
  on public.workouts(training_session_id)
  where training_session_id is not null;

create unique index if not exists scheduled_workouts_training_session_id_uidx
  on public.scheduled_workouts(training_session_id)
  where training_session_id is not null;

create index if not exists training_sessions_user_date_idx
  on public.training_sessions(user_id, session_date desc);

create index if not exists training_sessions_user_status_date_idx
  on public.training_sessions(user_id, status, session_date desc);

create index if not exists training_sessions_user_activity_date_idx
  on public.training_sessions(user_id, activity_type, session_date desc);

create unique index if not exists training_sessions_external_activity_uidx
  on public.training_sessions(user_id, external_provider, external_activity_id)
  where external_provider is not null and external_activity_id is not null;

create index if not exists training_session_blocks_user_id_idx
  on public.training_session_blocks(user_id);

create index if not exists training_session_blocks_session_id_idx
  on public.training_session_blocks(session_id);

drop trigger if exists training_sessions_set_updated_at on public.training_sessions;
create trigger training_sessions_set_updated_at
  before update on public.training_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists training_session_blocks_set_updated_at on public.training_session_blocks;
create trigger training_session_blocks_set_updated_at
  before update on public.training_session_blocks
  for each row execute function public.set_updated_at();

alter table public.training_sessions enable row level security;
alter table public.training_session_blocks enable row level security;

drop policy if exists training_sessions_select_own on public.training_sessions;
create policy training_sessions_select_own on public.training_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists training_sessions_insert_own on public.training_sessions;
create policy training_sessions_insert_own on public.training_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists training_sessions_update_own on public.training_sessions;
create policy training_sessions_update_own on public.training_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists training_sessions_delete_own on public.training_sessions;
create policy training_sessions_delete_own on public.training_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists training_session_blocks_select_own on public.training_session_blocks;
create policy training_session_blocks_select_own on public.training_session_blocks
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists training_session_blocks_insert_own on public.training_session_blocks;
create policy training_session_blocks_insert_own on public.training_session_blocks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.training_sessions session
      where session.id = session_id and session.user_id = (select auth.uid())
    )
  );

drop policy if exists training_session_blocks_update_own on public.training_session_blocks;
create policy training_session_blocks_update_own on public.training_session_blocks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.training_sessions session
      where session.id = session_id and session.user_id = (select auth.uid())
    )
  );

drop policy if exists training_session_blocks_delete_own on public.training_session_blocks;
create policy training_session_blocks_delete_own on public.training_session_blocks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.training_sessions, public.training_session_blocks from anon;
revoke all on public.training_sessions, public.training_session_blocks from authenticated;
grant select,insert,update,delete on public.training_sessions, public.training_session_blocks to authenticated;
grant update (training_preference) on public.profiles to authenticated;

create or replace function public.sync_workout_training_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  synced_session_id uuid;
  session_started_at timestamptz;
  session_ended_at timestamptz;
  session_duration_seconds integer;
begin
  if new.started_at is not null then
    session_started_at := (new.workout_date + new.started_at) at time zone new.timezone;
  end if;

  if new.ended_at is not null then
    session_ended_at := (new.workout_date + new.ended_at) at time zone new.timezone;
    if new.started_at is not null and new.ended_at < new.started_at then
      session_ended_at := session_ended_at + interval '1 day';
    end if;
  end if;

  if session_started_at is not null and session_ended_at is not null then
    session_duration_seconds := greatest(0,extract(epoch from (session_ended_at - session_started_at))::integer);
  end if;

  if new.training_session_id is not null then
    update public.training_sessions
    set activity_type = 'strength',
        modality = 'strength',
        status = new.status::text,
        title = new.name,
        session_date = new.workout_date,
        started_at = session_started_at,
        ended_at = session_ended_at,
        duration_seconds = session_duration_seconds,
        notes = new.notes,
        timezone = new.timezone,
        completed_at = new.completed_at,
        skipped = false
    where id = new.training_session_id and user_id = new.user_id
    returning id into synced_session_id;
  end if;

  if synced_session_id is null then
    insert into public.training_sessions (
      user_id,client_id,modality,activity_type,status,title,session_date,
      started_at,ended_at,duration_seconds,notes,timezone,completed_at
    ) values (
      new.user_id,'strength-workout:' || new.id::text,'strength','strength',new.status::text,new.name,new.workout_date,
      session_started_at,session_ended_at,session_duration_seconds,new.notes,new.timezone,new.completed_at
    )
    on conflict (user_id,client_id) do update
      set status = excluded.status,
          title = excluded.title,
          session_date = excluded.session_date,
          started_at = excluded.started_at,
          ended_at = excluded.ended_at,
          duration_seconds = excluded.duration_seconds,
          notes = excluded.notes,
          timezone = excluded.timezone,
          completed_at = excluded.completed_at,
          skipped = false
    returning id into synced_session_id;
  end if;

  new.training_session_id := synced_session_id;
  return new;
end;
$$;

create or replace function public.sync_scheduled_workout_training_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  synced_session_id uuid;
  template_name text;
begin
  select name into template_name
  from public.workout_templates
  where id = new.template_id and user_id = new.user_id;

  if new.training_session_id is not null then
    update public.training_sessions
    set activity_type = 'strength',
        modality = 'strength',
        status = 'planned',
        title = coalesce(template_name,'Strength workout'),
        session_date = new.scheduled_date,
        skipped = new.skipped,
        completed_at = null
    where id = new.training_session_id and user_id = new.user_id
    returning id into synced_session_id;
  end if;

  if synced_session_id is null then
    insert into public.training_sessions (
      user_id,client_id,modality,activity_type,status,title,session_date,skipped
    ) values (
      new.user_id,'strength-scheduled:' || new.id::text,'strength','strength','planned',coalesce(template_name,'Strength workout'),new.scheduled_date,new.skipped
    )
    on conflict (user_id,client_id) do update
      set status = 'planned',
          title = excluded.title,
          session_date = excluded.session_date,
          skipped = excluded.skipped,
          completed_at = null
    returning id into synced_session_id;
  end if;

  new.training_session_id := synced_session_id;
  return new;
end;
$$;

create or replace function public.delete_linked_training_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.training_session_id is not null then
    delete from public.training_sessions
    where id = old.training_session_id and user_id = old.user_id;
  end if;
  return old;
end;
$$;

revoke all on function public.sync_workout_training_session() from public;
revoke all on function public.sync_scheduled_workout_training_session() from public;
revoke all on function public.delete_linked_training_session() from public;

drop trigger if exists workouts_sync_training_session on public.workouts;
create trigger workouts_sync_training_session
  before insert or update of status,name,workout_date,started_at,ended_at,notes,timezone,completed_at,training_session_id
  on public.workouts
  for each row execute function public.sync_workout_training_session();

drop trigger if exists scheduled_workouts_sync_training_session on public.scheduled_workouts;
create trigger scheduled_workouts_sync_training_session
  before insert or update of template_id,scheduled_date,skipped,training_session_id
  on public.scheduled_workouts
  for each row execute function public.sync_scheduled_workout_training_session();

drop trigger if exists workouts_delete_training_session on public.workouts;
create trigger workouts_delete_training_session
  after delete on public.workouts
  for each row execute function public.delete_linked_training_session();

drop trigger if exists scheduled_workouts_delete_training_session on public.scheduled_workouts;
create trigger scheduled_workouts_delete_training_session
  after delete on public.scheduled_workouts
  for each row execute function public.delete_linked_training_session();

insert into public.training_sessions (
  user_id,client_id,modality,activity_type,status,title,session_date,
  started_at,ended_at,duration_seconds,notes,timezone,completed_at
)
select
  workout.user_id,
  'strength-workout:' || workout.id::text,
  'strength',
  'strength',
  workout.status::text,
  workout.name,
  workout.workout_date,
  case when workout.started_at is null then null else (workout.workout_date + workout.started_at) at time zone workout.timezone end,
  case
    when workout.ended_at is null then null
    when workout.started_at is not null and workout.ended_at < workout.started_at then ((workout.workout_date + workout.ended_at) at time zone workout.timezone) + interval '1 day'
    else (workout.workout_date + workout.ended_at) at time zone workout.timezone
  end,
  case
    when workout.started_at is null or workout.ended_at is null then null
    when workout.ended_at >= workout.started_at then extract(epoch from (workout.ended_at - workout.started_at))::integer
    else 86400 + extract(epoch from (workout.ended_at - workout.started_at))::integer
  end,
  workout.notes,
  workout.timezone,
  workout.completed_at
from public.workouts workout
where workout.training_session_id is null
on conflict (user_id,client_id) do nothing;

update public.workouts workout
set training_session_id = session.id
from public.training_sessions session
where workout.training_session_id is null
  and session.user_id = workout.user_id
  and session.client_id = 'strength-workout:' || workout.id::text;

insert into public.training_sessions (
  user_id,client_id,modality,activity_type,status,title,session_date,skipped
)
select
  scheduled.user_id,
  'strength-scheduled:' || scheduled.id::text,
  'strength',
  'strength',
  'planned',
  template.name,
  scheduled.scheduled_date,
  scheduled.skipped
from public.scheduled_workouts scheduled
join public.workout_templates template
  on template.id = scheduled.template_id and template.user_id = scheduled.user_id
where scheduled.training_session_id is null
on conflict (user_id,client_id) do nothing;

update public.scheduled_workouts scheduled
set training_session_id = session.id
from public.training_sessions session
where scheduled.training_session_id is null
  and session.user_id = scheduled.user_id
  and session.client_id = 'strength-scheduled:' || scheduled.id::text;

commit;
