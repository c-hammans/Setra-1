begin;

-- One small write head per logical client entity prevents a late response from
-- overwriting a newer edit. Deleted entities retain a tombstone so an old
-- offline save cannot resurrect them later.
create table if not exists public.client_write_heads (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_key text not null,
  revision bigint not null check (revision > 0),
  terminal boolean not null default false,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, entity_key)
);

alter table public.client_write_heads enable row level security;
drop policy if exists client_write_heads_select_own on public.client_write_heads;
create policy client_write_heads_select_own on public.client_write_heads
  for select using (auth.uid() = user_id);
revoke all on public.client_write_heads from public, anon;
grant select on public.client_write_heads to authenticated;

alter table public.training_plan_occurrences drop constraint if exists training_plan_occurrences_status_check;
alter table public.training_plan_occurrences add constraint training_plan_occurrences_status_check
  check (status in ('planned','partial','completed','skipped','cancelled','rescheduled'));

-- Seed heads from authoritative rows so a genuinely older offline request
-- cannot overwrite data that existed before this migration was installed.
insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted,updated_at)
select user_id,'workout:'||client_id,(extract(epoch from updated_at)*1000000)::bigint,status='completed',false,updated_at
from public.workouts where client_id is not null
on conflict(user_id,entity_key) do nothing;
insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted,updated_at)
select user_id,'strength-template:'||client_id,(extract(epoch from updated_at)*1000000)::bigint,false,false,updated_at
from public.workout_templates where client_id is not null
on conflict(user_id,entity_key) do nothing;
insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted,updated_at)
select user_id,'endurance-session:'||client_id,(extract(epoch from updated_at)*1000000)::bigint,status='completed',false,updated_at
from public.training_sessions where client_id is not null
on conflict(user_id,entity_key) do nothing;
insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted,updated_at)
select user_id,'endurance-template:'||client_id,(extract(epoch from updated_at)*1000000)::bigint,false,false,updated_at
from public.endurance_templates where client_id is not null
on conflict(user_id,entity_key) do nothing;

create or replace function public.claim_client_write(
  p_entity_key text,
  p_revision bigint,
  p_terminal boolean default false,
  p_deleted boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  accepted boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_entity_key),'') is null then raise exception 'Entity key is required'; end if;
  if p_revision is null or p_revision <= 0 then raise exception 'A positive revision is required'; end if;

  insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted)
  values(uid,p_entity_key,p_revision,p_terminal,p_deleted)
  on conflict(user_id,entity_key) do update set
    revision=excluded.revision,
    terminal=public.client_write_heads.terminal or excluded.terminal,
    deleted=public.client_write_heads.deleted or excluded.deleted,
    updated_at=now()
  -- Equal revisions are idempotent retries of an already committed operation.
  -- They are reported as stale; the client can safely acknowledge that exact
  -- queued operation without running the nested write a second time.
  where excluded.revision > public.client_write_heads.revision
    and (not public.client_write_heads.deleted or excluded.deleted)
    and (not public.client_write_heads.terminal or excluded.terminal or excluded.deleted)
  returning true into accepted;

  if not coalesce(accepted,false) then
    raise exception 'STALE_WRITE: a newer or terminal version is already stored';
  end if;
end;
$$;

create or replace function public.save_strength_workout_revisioned(p_workout jsonb,p_status text,p_revision bigint)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare saved_at timestamptz;
begin
  if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,
    jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item
    where nullif(set_item->>'rpe','') is not null and ((set_item->>'rpe')::numeric<0 or (set_item->>'rpe')::numeric>10))
  then raise exception 'VALIDATION: set RPE must be between 0 and 10'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,
    jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item
    where coalesce(exercise->>'loadMode','kg')='kg' and nullif(set_item->>'weight','') is not null
      and (coalesce(set_item->>'weight','') !~ '^[0-9]+([.][0-9]+)?$' or (set_item->>'weight')::numeric<0))
  then raise exception 'VALIDATION: kilogram loads must be non-negative numbers'; end if;
  perform public.claim_client_write('workout:'||(p_workout->>'id'),p_revision,p_status='completed',false);
  saved_at:=public.save_strength_workout(p_workout,p_status);
  if p_status='completed' and nullif(p_workout->>'templateId','') is not null and (
    exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise where coalesce((exercise->>'skipped')::boolean,false))
    or exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,
      jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item
      where not coalesce((exercise->>'skipped')::boolean,false) and not coalesce((set_item->>'done')::boolean,false))
  ) then
    update public.training_plan_occurrences set status='partial'
    where user_id=auth.uid() and occurrence_key='strength:'||(p_workout->>'templateId')||':'||(p_workout->>'date') and linked_completion_client_id=p_workout->>'id';
  end if;
  return saved_at;
end; $$;

create or replace function public.save_strength_template_revisioned(p_template jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) item
    where coalesce(item->>'sets','') !~ '^[0-9]+$' or (item->>'sets')::integer not between 1 and 100
      or nullif(trim(item->>'reps'),'') is null or char_length(item->>'reps')>30)
  then raise exception 'VALIDATION: strength template sets or reps are invalid'; end if;
  perform public.claim_client_write('strength-template:'||(p_template->>'id'),p_revision,false,false);
  perform public.save_strength_template(p_template);
end; $$;

create or replace function public.save_endurance_session_revisioned(p_session jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(p_session->>'title'),'') is null then raise exception 'VALIDATION: workout name is required'; end if;
  if coalesce(p_session->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'VALIDATION: a valid date is required'; end if;
  if p_session->>'status'='completed' and nullif(p_session->>'localToday','') is not null and (p_session->>'date')::date>(p_session->>'localToday')::date then raise exception 'VALIDATION: completed activities cannot be future dated'; end if;
  if nullif(p_session->>'plannedDurationMinutes','') is not null and (p_session->>'plannedDurationMinutes')::numeric<0 then raise exception 'VALIDATION: planned duration cannot be negative'; end if;
  if nullif(p_session->>'plannedDistanceMetres','') is not null and (p_session->>'plannedDistanceMetres')::numeric<0 then raise exception 'VALIDATION: planned distance cannot be negative'; end if;
  if nullif(p_session->>'durationSeconds','') is not null and (p_session->>'durationSeconds')::numeric<0 then raise exception 'VALIDATION: duration cannot be negative'; end if;
  if nullif(p_session->>'distanceMetres','') is not null and (p_session->>'distanceMetres')::numeric<0 then raise exception 'VALIDATION: distance cannot be negative'; end if;
  if nullif(p_session->>'rpe','') is not null and ((p_session->>'rpe')::numeric<0 or (p_session->>'rpe')::numeric>10) then raise exception 'VALIDATION: RPE must be between 0 and 10'; end if;
  if nullif(p_session->>'averageHeartRate','') is not null and ((p_session->>'averageHeartRate')::integer<20 or (p_session->>'averageHeartRate')::integer>260) then raise exception 'VALIDATION: heart rate must be between 20 and 260'; end if;
  if p_session->>'status'='completed' and nullif(p_session->>'durationSeconds','') is null and nullif(p_session->>'distanceMetres','') is null
    and jsonb_array_length(coalesce(p_session->'blocks','[]'::jsonb))=0 and nullif(trim(p_session->>'notes'),'') is null
    and nullif(p_session->>'startedAt','') is null and not coalesce((p_session->>'minimalEntryConfirmed')::boolean,false)
  then raise exception 'VALIDATION: confirm an intentional minimal activity'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_session->'blocks','[]'::jsonb)) item
    where (nullif(item->>'repetitions','') is not null and ((item->>'repetitions')::integer<1 or (item->>'repetitions')::integer>1000))
      or (item->>'completionType'='time' and coalesce(nullif(item->>'durationSeconds','')::numeric,0)<=0)
      or (item->>'completionType'='distance' and coalesce(nullif(item->>'distanceMetres','')::numeric,0)<=0)
      or (nullif(item->>'targetMinValue','') is not null and (item->>'targetMinValue')::numeric<0)
      or (nullif(item->>'targetMaxValue','') is not null and (item->>'targetMaxValue')::numeric<0)
      or (nullif(item->>'targetMinValue','') is not null and nullif(item->>'targetMaxValue','') is not null and (item->>'targetMinValue')::numeric>(item->>'targetMaxValue')::numeric))
  then raise exception 'VALIDATION: one or more structured steps are invalid'; end if;
  perform public.claim_client_write('endurance-session:'||(p_session->>'id'),p_revision,p_session->>'status'='completed',false);
  perform public.save_endurance_session(p_session);
end; $$;

create or replace function public.save_endurance_template_revisioned(p_template jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if nullif(trim(p_template->>'title'),'') is null then raise exception 'VALIDATION: template name is required'; end if;
  if nullif(p_template->>'plannedDurationMinutes','') is not null and (p_template->>'plannedDurationMinutes')::numeric<0 then raise exception 'VALIDATION: planned duration cannot be negative'; end if;
  if nullif(p_template->>'plannedDistanceMetres','') is not null and (p_template->>'plannedDistanceMetres')::numeric<0 then raise exception 'VALIDATION: planned distance cannot be negative'; end if;
  if nullif(p_template->>'targetRpe','') is not null and ((p_template->>'targetRpe')::numeric<0 or (p_template->>'targetRpe')::numeric>10) then raise exception 'VALIDATION: RPE must be between 0 and 10'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_template->'blocks','[]'::jsonb)) item
    where (nullif(item->>'repetitions','') is not null and ((item->>'repetitions')::integer<1 or (item->>'repetitions')::integer>1000))
      or (item->>'completionType'='time' and coalesce(nullif(item->>'durationSeconds','')::numeric,0)<=0)
      or (item->>'completionType'='distance' and coalesce(nullif(item->>'distanceMetres','')::numeric,0)<=0)
      or (nullif(item->>'targetMinValue','') is not null and nullif(item->>'targetMaxValue','') is not null and (item->>'targetMinValue')::numeric>(item->>'targetMaxValue')::numeric))
  then raise exception 'VALIDATION: one or more structured steps are invalid'; end if;
  perform public.claim_client_write('endurance-template:'||(p_template->>'id'),p_revision,false,false);
  perform public.save_endurance_template(p_template);
end; $$;

create or replace function public.replace_strength_schedule_revisioned(p_items jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.claim_client_write('schedule:current',p_revision,false,false);
  perform public.replace_strength_schedule(p_items);
end; $$;

create or replace function public.delete_strength_workout_revisioned(p_client_id text,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  perform public.claim_client_write('workout:'||p_client_id,p_revision,true,true);
  delete from public.workouts where user_id=uid and client_id=p_client_id;
end; $$;

create or replace function public.delete_strength_template_revisioned(p_client_id text,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  perform public.claim_client_write('strength-template:'||p_client_id,p_revision,true,true);
  delete from public.workout_templates where user_id=uid and client_id=p_client_id;
end; $$;

create or replace function public.delete_endurance_session_revisioned(p_client_id text,p_revision bigint,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  perform public.claim_client_write('endurance-session:'||p_client_id,p_revision,true,true);
  update public.training_plan_occurrences
    set status='cancelled',updated_at=now()
    where user_id=uid and modality='endurance' and source_client_id=p_client_id
      and status in ('planned','skipped') and planned_date>=p_today;
  delete from public.training_sessions where user_id=uid and client_id=p_client_id;
end; $$;

create or replace function public.delete_endurance_template_revisioned(p_client_id text,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  perform public.claim_client_write('endurance-template:'||p_client_id,p_revision,true,true);
  delete from public.endurance_templates where user_id=uid and client_id=p_client_id;
end; $$;

revoke all on function public.claim_client_write(text,bigint,boolean,boolean) from public,anon,authenticated;
revoke all on function public.save_strength_workout_revisioned(jsonb,text,bigint) from public,anon;
revoke all on function public.save_strength_template_revisioned(jsonb,bigint) from public,anon;
revoke all on function public.save_endurance_session_revisioned(jsonb,bigint) from public,anon;
revoke all on function public.save_endurance_template_revisioned(jsonb,bigint) from public,anon;
revoke all on function public.replace_strength_schedule_revisioned(jsonb,bigint) from public,anon;
revoke all on function public.delete_strength_workout_revisioned(text,bigint) from public,anon;
revoke all on function public.delete_strength_template_revisioned(text,bigint) from public,anon;
revoke all on function public.delete_endurance_session_revisioned(text,bigint,date) from public,anon;
revoke all on function public.delete_endurance_template_revisioned(text,bigint) from public,anon;
grant execute on function public.save_strength_workout_revisioned(jsonb,text,bigint) to authenticated;
grant execute on function public.save_strength_template_revisioned(jsonb,bigint) to authenticated;
grant execute on function public.save_endurance_session_revisioned(jsonb,bigint) to authenticated;
grant execute on function public.save_endurance_template_revisioned(jsonb,bigint) to authenticated;
grant execute on function public.replace_strength_schedule_revisioned(jsonb,bigint) to authenticated;
grant execute on function public.delete_strength_workout_revisioned(text,bigint) to authenticated;
grant execute on function public.delete_strength_template_revisioned(text,bigint) to authenticated;
grant execute on function public.delete_endurance_session_revisioned(text,bigint,date) to authenticated;
grant execute on function public.delete_endurance_template_revisioned(text,bigint) to authenticated;

commit;
