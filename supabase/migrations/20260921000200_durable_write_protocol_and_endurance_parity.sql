begin;

-- Operation identity and server version are deliberately independent from the
-- legacy device-clock revision. Old RPCs remain available during deployment;
-- new clients use the v2 entry points below.
alter table public.client_write_heads
  add column if not exists server_version bigint not null default 1,
  add column if not exists last_operation_id text,
  add column if not exists last_operation_hash text;

update public.client_write_heads set server_version=greatest(server_version,revision,1);

-- Keep the previous RPC surface safe during a rolling deployment. Legacy
-- clients still use their monotonic revision check, while every accepted old
-- write also advances the server-owned version observed by v2 clients.
create or replace function public.claim_client_write(
  p_entity_key text,p_revision bigint,p_terminal boolean default false,p_deleted boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_head public.client_write_heads%rowtype; inserted boolean:=false;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_entity_key),'') is null then raise exception 'Entity key is required'; end if;
  if p_revision is null or p_revision<=0 then raise exception 'A positive revision is required'; end if;
  insert into public.client_write_heads(user_id,entity_key,revision,server_version,terminal,deleted)
  values(uid,p_entity_key,p_revision,1,p_terminal,p_deleted)
  on conflict(user_id,entity_key) do nothing returning true into inserted;
  if inserted then return; end if;
  select * into current_head from public.client_write_heads where user_id=uid and entity_key=p_entity_key for update;
  if current_head.revision=p_revision then raise exception 'STALE_WRITE: operation is already stored'; end if;
  if current_head.revision>p_revision then raise exception 'WRITE_CONFLICT: a newer version is already stored'; end if;
  if current_head.deleted and not p_deleted then raise exception 'WRITE_CONFLICT: this item was deleted on another device'; end if;
  if current_head.terminal and not (p_terminal or p_deleted) then raise exception 'WRITE_CONFLICT: a completed item cannot be replaced by an older draft'; end if;
  update public.client_write_heads set revision=p_revision,server_version=server_version+1,
    terminal=terminal or p_terminal,deleted=deleted or p_deleted,updated_at=now()
  where user_id=uid and entity_key=p_entity_key;
end; $$;

-- Sessions and templates now use the same representation. Existing integer
-- values convert without loss; future values retain tenths of a minute.
alter table public.training_sessions
  alter column planned_duration_minutes type numeric(10,2)
  using planned_duration_minutes::numeric;

alter table public.template_exercises
  add column if not exists planned_load_mode text check (planned_load_mode is null or planned_load_mode in ('kg','band','bw')),
  add column if not exists planned_load_value numeric(12,3) check (planned_load_value is null or planned_load_value>=0),
  add column if not exists planned_load_text text check (planned_load_text is null or char_length(planned_load_text)<=40),
  add column if not exists planned_load_source_unit text check (planned_load_source_unit is null or planned_load_source_unit in ('kg','lb'));
alter table public.workout_exercises
  add column if not exists planned_load_mode text check (planned_load_mode is null or planned_load_mode in ('kg','band','bw')),
  add column if not exists planned_load_value numeric(12,3) check (planned_load_value is null or planned_load_value>=0),
  add column if not exists planned_load_text text check (planned_load_text is null or char_length(planned_load_text)<=40),
  add column if not exists planned_load_source_unit text check (planned_load_source_unit is null or planned_load_source_unit in ('kg','lb'));

create table if not exists public.client_write_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_id text not null,
  entity_key text not null,
  content_hash text not null,
  expected_version bigint not null,
  resulting_version bigint not null,
  created_at timestamptz not null default now(),
  primary key(user_id,operation_id)
);
alter table public.client_write_operations enable row level security;
drop policy if exists client_write_operations_select_own on public.client_write_operations;
create policy client_write_operations_select_own on public.client_write_operations for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.client_write_operations from public,anon;
grant select on public.client_write_operations to authenticated;

create or replace function public.claim_client_write_v2(
  p_entity_key text,
  p_operation_id text,
  p_operation_hash text,
  p_expected_version bigint,
  p_terminal boolean default false,
  p_deleted boolean default false
)
returns table(server_version bigint, apply_write boolean)
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); head public.client_write_heads%rowtype; prior public.client_write_operations%rowtype;
begin
  if uid is null then raise exception 'AUTHENTICATION REQUIRED'; end if;
  if nullif(trim(p_entity_key),'') is null then raise exception 'VALIDATION: entity key is required'; end if;
  if nullif(trim(p_operation_id),'') is null then raise exception 'VALIDATION: operation ID is required'; end if;
  if nullif(trim(p_operation_hash),'') is null then raise exception 'VALIDATION: operation hash is required'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'VALIDATION: expected version must be zero or greater'; end if;

  select * into prior from public.client_write_operations where user_id=uid and operation_id=p_operation_id;
  if found then
    if prior.entity_key is distinct from p_entity_key or prior.content_hash is distinct from p_operation_hash then raise exception 'DUPLICATE_OPERATION: operation ID was reused with different content'; end if;
    return query select prior.resulting_version,false;return;
  end if;
  insert into public.client_write_heads(user_id,entity_key,revision,server_version,terminal,deleted)
  values(uid,p_entity_key,1,0,false,false) on conflict(user_id,entity_key) do nothing;
  select * into head from public.client_write_heads
  where user_id=uid and entity_key=p_entity_key for update;

  select * into prior from public.client_write_operations where user_id=uid and operation_id=p_operation_id;
  if found then
    if prior.entity_key is distinct from p_entity_key or prior.content_hash is distinct from p_operation_hash then raise exception 'DUPLICATE_OPERATION: operation ID was reused with different content'; end if;
    return query select prior.resulting_version,false;return;
  end if;

  if head.last_operation_id=p_operation_id then
    if head.last_operation_hash is distinct from p_operation_hash then
      raise exception 'DUPLICATE_OPERATION: operation ID was reused with different content';
    end if;
    return query select head.server_version,false;
    return;
  end if;
  if head.server_version<>p_expected_version then
    raise exception 'WRITE_CONFLICT: expected server version %, found %',p_expected_version,head.server_version;
  end if;
  if head.deleted and not p_deleted then raise exception 'WRITE_CONFLICT: this item was deleted on another device'; end if;
  if head.terminal and not (p_terminal or p_deleted) then raise exception 'WRITE_CONFLICT: a completed item cannot be replaced by a draft'; end if;

  update public.client_write_heads set
    server_version=head.server_version+1,
    revision=greatest(revision+1,1),
    last_operation_id=p_operation_id,
    last_operation_hash=p_operation_hash,
    terminal=head.terminal or p_terminal,
    deleted=head.deleted or p_deleted,
    updated_at=now()
  where user_id=uid and entity_key=p_entity_key;
  insert into public.client_write_operations(user_id,operation_id,entity_key,content_hash,expected_version,resulting_version)
  values(uid,p_operation_id,p_entity_key,p_operation_hash,p_expected_version,head.server_version+1);
  return query select head.server_version+1,true;
end; $$;

create or replace function public.validate_endurance_blocks_v2(p_blocks jsonb)
returns void language plpgsql immutable set search_path='' as $$
begin
  if exists(select 1 from jsonb_array_elements(coalesce(p_blocks,'[]'::jsonb)) item
    where (nullif(item->>'repetitions','') is not null and ((item->>'repetitions')::integer<1 or (item->>'repetitions')::integer>1000))
      or (item->>'completionType'='time' and coalesce(nullif(item->>'durationSeconds','')::numeric,0)<=0)
      or (item->>'completionType'='distance' and coalesce(nullif(item->>'distanceMetres','')::numeric,0)<=0)
      or (nullif(item->>'durationSeconds','') is not null and (item->>'durationSeconds')::numeric<0)
      or (nullif(item->>'distanceMetres','') is not null and (item->>'distanceMetres')::numeric<0)
      or (nullif(item->>'recoveryDurationSeconds','') is not null and (item->>'recoveryDurationSeconds')::numeric<0)
      or (nullif(item->>'recoveryDistanceMetres','') is not null and (item->>'recoveryDistanceMetres')::numeric<0)
      or (nullif(item->>'targetMinValue','') is not null and (item->>'targetMinValue')::numeric<0)
      or (nullif(item->>'targetMaxValue','') is not null and (item->>'targetMaxValue')::numeric<0)
      or (nullif(item->>'targetMinValue','') is not null and nullif(item->>'targetMaxValue','') is not null and (item->>'targetMinValue')::numeric>(item->>'targetMaxValue')::numeric)
      or (item->>'targetMetric'='rpe' and (coalesce(nullif(item->>'targetMinValue','')::numeric,0)>10 or coalesce(nullif(item->>'targetMaxValue','')::numeric,0)>10))
      or (item->>'targetMetric'='heart_rate' and (coalesce(nullif(item->>'targetMinValue','')::numeric,20)<20 or coalesce(nullif(item->>'targetMaxValue','')::numeric,260)>260)))
  then raise exception 'VALIDATION: one or more structured steps are invalid'; end if;
end; $$;

-- The lifecycle body is shared by the v2 wrapper without claiming a second
-- legacy revision. It mirrors the reviewed 20260921000100 behaviour.
create or replace function public.save_strength_workout_revisioned_body(p_workout jsonb,p_status text)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); saved_at timestamptz; old_template_client_id text; old_date date; next_status text:='completed';
begin
  if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item where nullif(set_item->>'rpe','') is not null and ((set_item->>'rpe')::numeric<0 or (set_item->>'rpe')::numeric>10)) then raise exception 'VALIDATION: set RPE must be between 0 and 10'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item where coalesce(exercise->>'loadMode','kg')='kg' and nullif(set_item->>'weight','') is not null and (coalesce(set_item->>'weight','') !~ '^[0-9]+([.][0-9]+)?$' or (set_item->>'weight')::numeric<0)) then raise exception 'VALIDATION: kilogram loads must be non-negative numbers'; end if;
  select template.client_id,workout.workout_date into old_template_client_id,old_date from public.workouts workout left join public.workout_templates template on template.id=workout.template_id where workout.user_id=uid and workout.client_id=p_workout->>'id';
  saved_at:=public.save_strength_workout(p_workout,p_status);
  update public.workout_exercises child set
    planned_load_mode=nullif(item->'plannedLoad'->>'mode',''),
    planned_load_value=case when item->'plannedLoad'->>'mode'='kg' and coalesce(item->'plannedLoad'->>'value','')~'^[0-9]+([.][0-9]+)?$' then (item->'plannedLoad'->>'value')::numeric else null end,
    planned_load_text=case when item->'plannedLoad'->>'mode'='band' then nullif(item->'plannedLoad'->>'value','') when item->'plannedLoad'->>'mode'='bw' then 'BW' else null end,
    planned_load_source_unit=nullif(item->'plannedLoad'->>'sourceUnit','')
  from public.workouts workout,jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) with ordinality source(item,position)
  where workout.user_id=uid and workout.client_id=p_workout->>'id' and child.workout_id=workout.id and child.position=source.position-1;
  if old_template_client_id is not null and (old_template_client_id is distinct from nullif(p_workout->>'templateId','') or old_date is distinct from (p_workout->>'date')::date) then update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now() where user_id=uid and occurrence_key='strength:'||old_template_client_id||':'||old_date::text and linked_completion_client_id=p_workout->>'id'; end if;
  if p_status='completed' and nullif(p_workout->>'templateId','') is not null then
    if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise where coalesce((exercise->>'skipped')::boolean,false)) or exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item where not coalesce((exercise->>'skipped')::boolean,false) and not coalesce((set_item->>'done')::boolean,false)) then next_status:='partial'; end if;
    update public.training_plan_occurrences set status=next_status,linked_completion_client_id=p_workout->>'id',completed_at=coalesce(nullif(p_workout->>'completedAt','')::timestamptz,now()),updated_at=now() where user_id=uid and occurrence_key='strength:'||(p_workout->>'templateId')||':'||(p_workout->>'date');
  end if;
  return saved_at;
end; $$;

create or replace function public.save_strength_workout_v2(p_workout jsonb,p_status text,p_operation_id text,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare claim record; saved_at timestamptz;
begin
  select * into claim from public.claim_client_write_v2('workout:'||(p_workout->>'id'),p_operation_id,md5(p_workout::text||':'||p_status),p_expected_version,p_status='completed',false);
  if not claim.apply_write then return claim.server_version; end if;
  saved_at:=public.save_strength_workout_revisioned_body(p_workout,p_status);
  return claim.server_version;
end; $$;

create or replace function public.save_strength_template_v2(p_template jsonb,p_operation_id text,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$ declare claim record; begin
  if exists(select 1 from jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) item where coalesce(item->>'sets','') !~ '^[0-9]+$' or (item->>'sets')::integer not between 1 and 100 or nullif(trim(item->>'reps'),'') is null or char_length(item->>'reps')>30) then raise exception 'VALIDATION: strength template sets or reps are invalid'; end if;
  select * into claim from public.claim_client_write_v2('strength-template:'||(p_template->>'id'),p_operation_id,md5(p_template::text),p_expected_version,false,false);if claim.apply_write then perform public.save_strength_template(p_template);update public.template_exercises child set planned_load_mode=nullif(item->'plannedLoad'->>'mode',''),planned_load_value=case when item->'plannedLoad'->>'mode'='kg' and coalesce(item->'plannedLoad'->>'value','')~'^[0-9]+([.][0-9]+)?$' then (item->'plannedLoad'->>'value')::numeric else null end,planned_load_text=case when item->'plannedLoad'->>'mode'='band' then nullif(item->'plannedLoad'->>'value','') when item->'plannedLoad'->>'mode'='bw' then 'BW' else null end,planned_load_source_unit=nullif(item->'plannedLoad'->>'sourceUnit','') from public.workout_templates template,jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) with ordinality source(item,position) where template.user_id=auth.uid() and template.client_id=p_template->>'id' and child.template_id=template.id and child.position=source.position-1;end if;return claim.server_version;
end; $$;

create or replace function public.save_endurance_template_v2(p_template jsonb,p_operation_id text,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$ declare claim record; begin
  if nullif(trim(p_template->>'title'),'') is null then raise exception 'VALIDATION: template name is required'; end if;
  if nullif(p_template->>'plannedDurationMinutes','') is not null and (p_template->>'plannedDurationMinutes')::numeric<0 then raise exception 'VALIDATION: planned duration cannot be negative'; end if;
  if nullif(p_template->>'plannedDistanceMetres','') is not null and (p_template->>'plannedDistanceMetres')::numeric<0 then raise exception 'VALIDATION: planned distance cannot be negative'; end if;
  if nullif(p_template->>'targetRpe','') is not null and ((p_template->>'targetRpe')::numeric<0 or (p_template->>'targetRpe')::numeric>10) then raise exception 'VALIDATION: RPE must be between 0 and 10'; end if;
  perform public.validate_endurance_blocks_v2(p_template->'blocks');
  select * into claim from public.claim_client_write_v2('endurance-template:'||(p_template->>'id'),p_operation_id,md5(p_template::text),p_expected_version,false,false);if claim.apply_write then perform public.save_endurance_template(p_template);end if;return claim.server_version;
end; $$;

create or replace function public.save_endurance_session_v2(p_session jsonb,p_operation_id text,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$ declare claim record;uid uuid:=auth.uid();old_planned_client_id text;begin
  if nullif(trim(p_session->>'title'),'') is null then raise exception 'VALIDATION: workout name is required'; end if;
  if coalesce(p_session->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'VALIDATION: a valid date is required'; end if;
  if p_session->>'status'='completed' and nullif(p_session->>'localToday','') is not null and (p_session->>'date')::date>(p_session->>'localToday')::date then raise exception 'VALIDATION: completed activities cannot be future dated'; end if;
  if nullif(p_session->>'durationSeconds','') is not null and (p_session->>'durationSeconds')::numeric<0 then raise exception 'VALIDATION: duration cannot be negative'; end if;
  if nullif(p_session->>'distanceMetres','') is not null and (p_session->>'distanceMetres')::numeric<0 then raise exception 'VALIDATION: distance cannot be negative'; end if;
  if nullif(p_session->>'rpe','') is not null and ((p_session->>'rpe')::numeric<0 or (p_session->>'rpe')::numeric>10) then raise exception 'VALIDATION: RPE must be between 0 and 10'; end if;
  if nullif(p_session->>'averageHeartRate','') is not null and ((p_session->>'averageHeartRate')::integer<20 or (p_session->>'averageHeartRate')::integer>260) then raise exception 'VALIDATION: heart rate must be between 20 and 260'; end if;
  perform public.validate_endurance_blocks_v2(p_session->'blocks');
  if p_session->>'status'='completed' and coalesce(nullif(p_session->>'durationSeconds','')::numeric,0)<=0 and coalesce(nullif(p_session->>'distanceMetres','')::numeric,0)<=0 and jsonb_array_length(coalesce(p_session->'blocks','[]'::jsonb))=0 and nullif(trim(p_session->>'notes'),'') is null and nullif(p_session->>'rpe','') is null and nullif(p_session->>'averageHeartRate','') is null and coalesce(nullif(p_session->>'elevationGainMetres','')::numeric,0)<=0 and not coalesce((p_session->>'minimalEntryConfirmed')::boolean,false) then raise exception 'VALIDATION: confirm an intentional minimal activity'; end if;
  select * into claim from public.claim_client_write_v2('endurance-session:'||(p_session->>'id'),p_operation_id,md5(p_session::text),p_expected_version,p_session->>'status'='completed',false);
  if claim.apply_write then
    select planned.client_id into old_planned_client_id from public.training_sessions completed join public.training_sessions planned on planned.id=completed.planned_session_id where completed.user_id=uid and completed.client_id=p_session->>'id';
    perform public.save_endurance_session(p_session);
    update public.training_sessions set minimal_entry_confirmed=coalesce((p_session->>'minimalEntryConfirmed')::boolean,false) where user_id=uid and client_id=p_session->>'id';
    if old_planned_client_id is not null and old_planned_client_id is distinct from nullif(p_session->>'plannedSessionId','') then update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now() where user_id=uid and occurrence_key='endurance:'||old_planned_client_id and linked_completion_client_id=p_session->>'id';end if;
    if p_session->>'status'='completed' and nullif(p_session->>'plannedSessionId','') is not null then update public.training_plan_occurrences set status='completed',linked_completion_client_id=p_session->>'id',completed_at=coalesce(nullif(p_session->>'completedAt','')::timestamptz,now()),updated_at=now() where user_id=uid and occurrence_key='endurance:'||(p_session->>'plannedSessionId');end if;
  end if;return claim.server_version;
end; $$;

create or replace function public.delete_client_entity_v2(p_entity_key text,p_operation_id text,p_expected_version bigint,p_delete_kind text,p_client_id text,p_today date default null)
returns bigint language plpgsql security definer set search_path='' as $$ declare uid uuid:=auth.uid();claim record;old_template_client_id text;old_date date;planned_client_id text;begin
  select * into claim from public.claim_client_write_v2(p_entity_key,p_operation_id,md5('delete:'||p_delete_kind||':'||p_client_id),p_expected_version,true,true);if not claim.apply_write then return claim.server_version;end if;
  if p_delete_kind='workout' then
    select template.client_id,workout.workout_date into old_template_client_id,old_date from public.workouts workout left join public.workout_templates template on template.id=workout.template_id where workout.user_id=uid and workout.client_id=p_client_id;
    delete from public.workouts where user_id=uid and client_id=p_client_id;
    if old_template_client_id is not null then update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now() where user_id=uid and occurrence_key='strength:'||old_template_client_id||':'||old_date::text and linked_completion_client_id=p_client_id;end if;
  elsif p_delete_kind='strength-template' then delete from public.workout_templates where user_id=uid and client_id=p_client_id;
  elsif p_delete_kind='endurance-template' then delete from public.endurance_templates where user_id=uid and client_id=p_client_id;
  elsif p_delete_kind='endurance-session' then
    select planned.client_id into planned_client_id from public.training_sessions completed join public.training_sessions planned on planned.id=completed.planned_session_id where completed.user_id=uid and completed.client_id=p_client_id;
    if planned_client_id is not null then update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now() where user_id=uid and occurrence_key='endurance:'||planned_client_id and linked_completion_client_id=p_client_id;else update public.training_plan_occurrences set status='cancelled',updated_at=now() where user_id=uid and modality='endurance' and source_client_id=p_client_id and status in ('planned','skipped') and planned_date>=coalesce(p_today,current_date);end if;
    delete from public.training_sessions where user_id=uid and client_id=p_client_id;
  else raise exception 'VALIDATION: unsupported delete kind';end if;return claim.server_version;
end; $$;

create or replace function public.replace_strength_schedule_v2(p_items jsonb,p_operation_id text,p_expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$ declare claim record;begin select * into claim from public.claim_client_write_v2('schedule:current',p_operation_id,md5(p_items::text),p_expected_version,false,false);if claim.apply_write then perform public.replace_strength_schedule(p_items);end if;return claim.server_version;end; $$;

revoke all on function public.claim_client_write_v2(text,text,text,bigint,boolean,boolean) from public,anon,authenticated;
revoke all on function public.validate_endurance_blocks_v2(jsonb) from public,anon,authenticated;
revoke all on function public.save_strength_workout_revisioned_body(jsonb,text) from public,anon,authenticated;
grant execute on function public.save_strength_workout_v2(jsonb,text,text,bigint) to authenticated;
grant execute on function public.save_strength_template_v2(jsonb,text,bigint) to authenticated;
grant execute on function public.save_endurance_template_v2(jsonb,text,bigint) to authenticated;
grant execute on function public.save_endurance_session_v2(jsonb,text,bigint) to authenticated;
grant execute on function public.delete_client_entity_v2(text,text,bigint,text,text,date) to authenticated;
grant execute on function public.replace_strength_schedule_v2(jsonb,text,bigint) to authenticated;

-- Correct reviewed catalogue metadata without changing stable exercise IDs or
-- any historical foreign keys.
update public.exercises set equipment='Barbell' where id in ('behind-the-neck-press','snatch-grip-behind-the-neck-press');

commit;
