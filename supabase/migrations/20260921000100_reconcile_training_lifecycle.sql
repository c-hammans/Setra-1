begin;

-- Keep an intentional minimal endurance entry intentional after reload/edit.
alter table public.training_sessions
  add column if not exists minimal_entry_confirmed boolean not null default false;

-- Equal revisions are safe retries. A genuinely older revision is a conflict,
-- not an acknowledgement: the browser must retain it for the user to review.
create or replace function public.claim_client_write(
  p_entity_key text,
  p_revision bigint,
  p_terminal boolean default false,
  p_deleted boolean default false
)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); current_head public.client_write_heads%rowtype;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_entity_key),'') is null then raise exception 'Entity key is required'; end if;
  if p_revision is null or p_revision<=0 then raise exception 'A positive revision is required'; end if;

  select * into current_head from public.client_write_heads
  where user_id=uid and entity_key=p_entity_key for update;
  if found then
    if p_revision=current_head.revision then raise exception 'STALE_WRITE: operation is already stored'; end if;
    if p_revision<current_head.revision then raise exception 'WRITE_CONFLICT: a newer version is already stored'; end if;
    if current_head.deleted and not p_deleted then raise exception 'WRITE_CONFLICT: this item was deleted on another device'; end if;
    if current_head.terminal and not (p_terminal or p_deleted) then raise exception 'WRITE_CONFLICT: a completed item cannot be replaced by an older draft'; end if;
    update public.client_write_heads set revision=p_revision,terminal=current_head.terminal or p_terminal,
      deleted=current_head.deleted or p_deleted,updated_at=now()
    where user_id=uid and entity_key=p_entity_key;
  else
    insert into public.client_write_heads(user_id,entity_key,revision,terminal,deleted)
    values(uid,p_entity_key,p_revision,p_terminal,p_deleted);
  end if;
end; $$;

create or replace function public.save_strength_workout_revisioned(p_workout jsonb,p_status text,p_revision bigint)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); saved_at timestamptz; old_template_client_id text; old_date date;
  next_status text:='completed';
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

  select template.client_id,workout.workout_date into old_template_client_id,old_date
  from public.workouts workout left join public.workout_templates template on template.id=workout.template_id
  where workout.user_id=uid and workout.client_id=p_workout->>'id';

  perform public.claim_client_write('workout:'||(p_workout->>'id'),p_revision,p_status='completed',false);
  saved_at:=public.save_strength_workout(p_workout,p_status);

  if old_template_client_id is not null and
    (old_template_client_id is distinct from nullif(p_workout->>'templateId','') or old_date is distinct from (p_workout->>'date')::date) then
    update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now()
    where user_id=uid and occurrence_key='strength:'||old_template_client_id||':'||old_date::text
      and linked_completion_client_id=p_workout->>'id';
  end if;

  if p_status='completed' and nullif(p_workout->>'templateId','') is not null then
    if exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise
      where coalesce((exercise->>'skipped')::boolean,false))
      or exists(select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) exercise,
        jsonb_array_elements(coalesce(exercise->'sets','[]'::jsonb)) set_item
        where not coalesce((exercise->>'skipped')::boolean,false) and not coalesce((set_item->>'done')::boolean,false))
    then next_status:='partial'; end if;
    update public.training_plan_occurrences set status=next_status,
      linked_completion_client_id=p_workout->>'id',completed_at=coalesce(nullif(p_workout->>'completedAt','')::timestamptz,now()),updated_at=now()
    where user_id=uid and occurrence_key='strength:'||(p_workout->>'templateId')||':'||(p_workout->>'date');
  end if;
  return saved_at;
end; $$;

create or replace function public.delete_strength_workout_revisioned(p_client_id text,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old_template_client_id text; old_date date;
begin
  select template.client_id,workout.workout_date into old_template_client_id,old_date
  from public.workouts workout left join public.workout_templates template on template.id=workout.template_id
  where workout.user_id=uid and workout.client_id=p_client_id;
  perform public.claim_client_write('workout:'||p_client_id,p_revision,true,true);
  delete from public.workouts where user_id=uid and client_id=p_client_id;
  if old_template_client_id is not null then
    update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now()
    where user_id=uid and occurrence_key='strength:'||old_template_client_id||':'||old_date::text
      and linked_completion_client_id=p_client_id;
  end if;
end; $$;

create or replace function public.save_endurance_session_revisioned(p_session jsonb,p_revision bigint)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); old_planned_client_id text;
begin
  if nullif(trim(p_session->>'title'),'') is null then raise exception 'VALIDATION: workout name is required'; end if;
  if coalesce(p_session->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'VALIDATION: a valid date is required'; end if;
  if p_session->>'status'='completed' and nullif(p_session->>'localToday','') is not null and (p_session->>'date')::date>(p_session->>'localToday')::date then raise exception 'VALIDATION: completed activities cannot be future dated'; end if;
  if nullif(p_session->>'durationSeconds','') is not null and (p_session->>'durationSeconds')::numeric<0 then raise exception 'VALIDATION: duration cannot be negative'; end if;
  if nullif(p_session->>'distanceMetres','') is not null and (p_session->>'distanceMetres')::numeric<0 then raise exception 'VALIDATION: distance cannot be negative'; end if;
  if nullif(p_session->>'rpe','') is not null and ((p_session->>'rpe')::numeric<0 or (p_session->>'rpe')::numeric>10) then raise exception 'VALIDATION: RPE must be between 0 and 10'; end if;
  if p_session->>'status'='completed'
    and coalesce(nullif(p_session->>'durationSeconds','')::numeric,0)<=0
    and coalesce(nullif(p_session->>'distanceMetres','')::numeric,0)<=0
    and jsonb_array_length(coalesce(p_session->'blocks','[]'::jsonb))=0
    and nullif(trim(p_session->>'notes'),'') is null
    and nullif(p_session->>'rpe','') is null and nullif(p_session->>'averageHeartRate','') is null
    and coalesce(nullif(p_session->>'elevationGainMetres','')::numeric,0)<=0
    and not coalesce((p_session->>'minimalEntryConfirmed')::boolean,false)
  then raise exception 'VALIDATION: confirm an intentional minimal activity'; end if;

  select planned.client_id into old_planned_client_id
  from public.training_sessions completed join public.training_sessions planned on planned.id=completed.planned_session_id
  where completed.user_id=uid and completed.client_id=p_session->>'id';
  perform public.claim_client_write('endurance-session:'||(p_session->>'id'),p_revision,p_session->>'status'='completed',false);
  perform public.save_endurance_session(p_session);
  update public.training_sessions set minimal_entry_confirmed=coalesce((p_session->>'minimalEntryConfirmed')::boolean,false)
  where user_id=uid and client_id=p_session->>'id';

  if old_planned_client_id is not null and old_planned_client_id is distinct from nullif(p_session->>'plannedSessionId','') then
    update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now()
    where user_id=uid and occurrence_key='endurance:'||old_planned_client_id and linked_completion_client_id=p_session->>'id';
  end if;
  if p_session->>'status'='completed' and nullif(p_session->>'plannedSessionId','') is not null then
    update public.training_plan_occurrences set status='completed',linked_completion_client_id=p_session->>'id',
      completed_at=coalesce(nullif(p_session->>'completedAt','')::timestamptz,now()),updated_at=now()
    where user_id=uid and occurrence_key='endurance:'||(p_session->>'plannedSessionId');
  end if;
end; $$;

create or replace function public.delete_endurance_session_revisioned(p_client_id text,p_revision bigint,p_today date)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); planned_client_id text;
begin
  select planned.client_id into planned_client_id from public.training_sessions completed
  join public.training_sessions planned on planned.id=completed.planned_session_id
  where completed.user_id=uid and completed.client_id=p_client_id;
  perform public.claim_client_write('endurance-session:'||p_client_id,p_revision,true,true);
  if planned_client_id is not null then
    update public.training_plan_occurrences set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now()
    where user_id=uid and occurrence_key='endurance:'||planned_client_id and linked_completion_client_id=p_client_id;
  else
    update public.training_plan_occurrences set status='cancelled',updated_at=now()
    where user_id=uid and modality='endurance' and source_client_id=p_client_id
      and status in ('planned','skipped') and planned_date>=p_today;
  end if;
  delete from public.training_sessions where user_id=uid and client_id=p_client_id;
end; $$;

-- Repair dangling links left by earlier lifecycle rules without changing dates.
update public.training_plan_occurrences occurrence
set status='planned',linked_completion_client_id=null,completed_at=null,updated_at=now()
where occurrence.linked_completion_client_id is not null and not exists(
  select 1 from public.workouts workout where workout.user_id=occurrence.user_id and workout.client_id=occurrence.linked_completion_client_id
  union all
  select 1 from public.training_sessions session where session.user_id=occurrence.user_id and session.client_id=occurrence.linked_completion_client_id and session.status='completed'
);

-- The browser may execute only the guarded entry points.
revoke execute on function public.save_strength_workout(jsonb,text) from authenticated;
revoke execute on function public.save_strength_template(jsonb) from authenticated;
revoke execute on function public.save_endurance_template(jsonb) from authenticated;
revoke execute on function public.save_endurance_session(jsonb) from authenticated;
revoke execute on function public.replace_strength_schedule(jsonb) from authenticated;

grant execute on function public.save_strength_workout_revisioned(jsonb,text,bigint) to authenticated;
grant execute on function public.delete_strength_workout_revisioned(text,bigint) to authenticated;
grant execute on function public.save_endurance_session_revisioned(jsonb,bigint) to authenticated;
grant execute on function public.delete_endurance_session_revisioned(text,bigint,date) to authenticated;

commit;
