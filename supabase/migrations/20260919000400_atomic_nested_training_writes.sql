begin;

-- Nested workout/template writes previously used a delete followed by several
-- browser requests. These tightly scoped security-definer functions derive the
-- owner exclusively from auth.uid(), validate references, expose execution only
-- to authenticated users, and replace each parent + children in one transaction.

create or replace function public.save_strength_workout(p_workout jsonb,p_status text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  workout_uuid uuid;
  template_uuid uuid;
  exercise_row jsonb;
  exercise_uuid uuid;
  exercise_position integer;
  set_row jsonb;
  set_position integer;
  mode text;
  saved_at timestamptz;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if p_status not in ('in_progress','completed') then raise exception 'Invalid workout status'; end if;
  if nullif(trim(p_workout->>'id'),'') is null then raise exception 'Workout id is required'; end if;
  if nullif(trim(p_workout->>'name'),'') is null then raise exception 'Workout name is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':strength-workout:' || (p_workout->>'id'),0));

  if nullif(p_workout->>'templateId','') is not null then
    select id into template_uuid from public.workout_templates
    where user_id=uid and client_id=p_workout->>'templateId';
    if template_uuid is null then raise exception 'Workout template is unavailable'; end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) item
    where not exists (
      select 1 from public.exercises exercise
      where exercise.id=item->>'exerciseId' and (exercise.owner_id is null or exercise.owner_id=uid)
    )
  ) then raise exception 'One or more workout exercises are unavailable'; end if;

  insert into public.workouts(user_id,client_id,template_id,status,name,workout_date,started_at,ended_at,timezone,notes,completed_at)
  values(uid,p_workout->>'id',template_uuid,p_status::public.workout_status,trim(p_workout->>'name'),(p_workout->>'date')::date,
    nullif(p_workout->>'startedAt','')::time,nullif(p_workout->>'endedAt','')::time,
    coalesce(nullif(p_workout->>'timezone',''),'UTC'),coalesce(p_workout->>'note',''),
    case when p_status='completed' then coalesce(nullif(p_workout->>'completedAt','')::timestamptz,now()) else null end)
  on conflict(user_id,client_id) do update set
    template_id=excluded.template_id,status=excluded.status,name=excluded.name,workout_date=excluded.workout_date,
    started_at=excluded.started_at,ended_at=excluded.ended_at,timezone=excluded.timezone,notes=excluded.notes,
    completed_at=excluded.completed_at
  returning id,updated_at into workout_uuid,saved_at;

  delete from public.workout_warmup_items where workout_id=workout_uuid;
  insert into public.workout_warmup_items(user_id,workout_id,client_id,item_type,exercise_id,title,instructions,position,completed)
  select uid,workout_uuid,item->>'id',case when item->>'kind'='exercise' then 'exercise' else 'instruction' end,
    case when item->>'kind'='exercise' then nullif(item->>'exerciseId','') else null end,
    coalesce(item->>'title',''),coalesce(item->>'instructions',''),ordinality::integer-1,
    coalesce((item->>'done')::boolean,false)
  from jsonb_array_elements(coalesce(p_workout->'warmup','[]'::jsonb)) with ordinality as warmup(item,ordinality);

  delete from public.workout_exercises where workout_id=workout_uuid;
  for exercise_row,exercise_position in
    select item,ordinality::integer-1
    from jsonb_array_elements(coalesce(p_workout->'exercises','[]'::jsonb)) with ordinality as exercises(item,ordinality)
  loop
    mode := coalesce(nullif(exercise_row->>'loadMode',''),'kg');
    insert into public.workout_exercises(user_id,workout_id,exercise_id,position,superset_key,superset_name,notes,planning_notes,rep_target,load_mode,skipped)
    values(uid,workout_uuid,exercise_row->>'exerciseId',exercise_position,nullif(exercise_row->>'group',''),
      case when nullif(exercise_row->>'group','') is null then null else p_workout->'supersetNames'->>(exercise_row->>'group') end,
      coalesce(exercise_row->>'note',''),coalesce(exercise_row->>'planNote',''),nullif(exercise_row->>'repTarget',''),
      case when mode='kg' then 'kg'::public.load_mode else 'text'::public.load_mode end,coalesce((exercise_row->>'skipped')::boolean,false))
    returning id into exercise_uuid;

    for set_row,set_position in
      select item,ordinality::integer
      from jsonb_array_elements(coalesce(exercise_row->'sets','[]'::jsonb)) with ordinality as sets(item,ordinality)
    loop
      insert into public.workout_sets(user_id,workout_exercise_id,set_number,weight,load_text,reps,rpe,notes,completed)
      values(uid,exercise_uuid,set_position,
        case when mode='kg' and coalesce(set_row->>'weight','') ~ '^[0-9]+([.][0-9]+)?$' then (set_row->>'weight')::numeric else null end,
        case when mode in ('band','text') then nullif(set_row->>'weight','') when mode='bw' then 'BW' else null end,
        nullif(set_row->>'reps',''),case when coalesce(set_row->>'rpe','') ~ '^[0-9]+([.][0-9]+)?$' then (set_row->>'rpe')::numeric else null end,
        coalesce(set_row->>'note',''),coalesce((set_row->>'done')::boolean,false));
    end loop;
  end loop;

  if p_status='completed' and template_uuid is not null then
    update public.training_plan_occurrences
    set status='completed',linked_completion_client_id=p_workout->>'id',completed_at=now()
    where user_id=uid and occurrence_key='strength:' || (p_workout->>'templateId') || ':' || (p_workout->>'date')
      and status in ('planned','skipped');
  end if;
  return saved_at;
end;
$$;

create or replace function public.save_strength_template(p_template jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid(); template_uuid uuid; group_row record;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if nullif(trim(p_template->>'id'),'') is null or nullif(trim(p_template->>'name'),'') is null then raise exception 'Template id and name are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':strength-template:' || (p_template->>'id'),0));
  if exists(select 1 from jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) item where not exists(select 1 from public.exercises e where e.id=item->>'exerciseId' and (e.owner_id is null or e.owner_id=uid))) then raise exception 'One or more template exercises are unavailable'; end if;
  insert into public.workout_templates(user_id,client_id,name,focus,colour,icon)
  values(uid,p_template->>'id',trim(p_template->>'name'),coalesce(p_template->>'focus',''),coalesce(nullif(p_template->>'color',''),'#409ECE'),coalesce(nullif(p_template->>'icon',''),'◆'))
  on conflict(user_id,client_id) do update set name=excluded.name,focus=excluded.focus,colour=excluded.colour,icon=excluded.icon
  returning id into template_uuid;
  delete from public.template_warmup_items where template_id=template_uuid;
  delete from public.template_exercises where template_id=template_uuid;
  delete from public.template_supersets where template_id=template_uuid;
  for group_row in select item->>'group' key,min(ordinality)::integer-1 position from jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) with ordinality e(item,ordinality) where nullif(item->>'group','') is not null group by item->>'group'
  loop insert into public.template_supersets(user_id,template_id,client_group_key,name,position) values(uid,template_uuid,group_row.key,nullif(p_template->'supersetNames'->>group_row.key,''),group_row.position); end loop;
  insert into public.template_warmup_items(user_id,template_id,client_id,item_type,exercise_id,title,instructions,position)
  select uid,template_uuid,item->>'id',case when item->>'kind'='exercise' then 'exercise' else 'instruction' end,case when item->>'kind'='exercise' then nullif(item->>'exerciseId','') else null end,coalesce(item->>'title',''),coalesce(item->>'instructions',''),ordinality::integer-1
  from jsonb_array_elements(coalesce(p_template->'warmup','[]'::jsonb)) with ordinality warmup(item,ordinality);
  insert into public.template_exercises(user_id,template_id,exercise_id,superset_id,position,planned_sets,rep_target,notes)
  select uid,template_uuid,item->>'exerciseId',superset.id,ordinality::integer-1,greatest(1,coalesce((item->>'sets')::integer,1)),coalesce(nullif(item->>'reps',''),'8'),coalesce(item->>'note','')
  from jsonb_array_elements(coalesce(p_template->'exercises','[]'::jsonb)) with ordinality e(item,ordinality)
  left join public.template_supersets superset on superset.template_id=template_uuid and superset.client_group_key=item->>'group';
end;
$$;

create or replace function public.save_endurance_template(p_template jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); template_uuid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':endurance-template:' || (p_template->>'id'),0));
  insert into public.endurance_templates(user_id,client_id,activity_type,title,planned_duration_minutes,planned_distance_metres,target_rpe,environment,training_category,notes)
  values(uid,p_template->>'id',p_template->>'activityType',trim(p_template->>'title'),nullif(p_template->>'plannedDurationMinutes','')::numeric,nullif(p_template->>'plannedDistanceMetres','')::numeric,nullif(p_template->>'targetRpe','')::numeric,nullif(p_template->>'environment',''),nullif(p_template->>'category',''),coalesce(p_template->>'notes',''))
  on conflict(user_id,client_id) do update set activity_type=excluded.activity_type,title=excluded.title,planned_duration_minutes=excluded.planned_duration_minutes,planned_distance_metres=excluded.planned_distance_metres,target_rpe=excluded.target_rpe,environment=excluded.environment,training_category=excluded.training_category,notes=excluded.notes returning id into template_uuid;
  delete from public.endurance_template_blocks where template_id=template_uuid;
  insert into public.endurance_template_blocks(user_id,template_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id)
  select uid,template_uuid,item->>'id',item->>'type',ordinality::integer-1,coalesce(item->>'title',''),coalesce(item->>'instructions',''),nullif(item->>'repetitions','')::integer,nullif(item->>'durationSeconds','')::integer,nullif(item->>'distanceMetres','')::numeric,nullif(item->>'recoveryDurationSeconds','')::integer,nullif(item->>'recoveryDistanceMetres','')::numeric,coalesce(item->>'intensityTarget',''),coalesce(nullif(item->>'completionType',''),'open'),nullif(item->>'targetMetric',''),nullif(item->>'targetMinValue','')::numeric,nullif(item->>'targetMaxValue','')::numeric,nullif(item->>'targetUnit',''),nullif(item->>'stroke',''),coalesce(item->'providerMetadata','{}'::jsonb),nullif(item->>'parentId','')
  from jsonb_array_elements(coalesce(p_template->'blocks','[]'::jsonb)) with ordinality blocks(item,ordinality);
end; $$;

create or replace function public.save_endurance_session(p_session jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); session_uuid uuid; planned_uuid uuid; template_uuid uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':endurance-session:' || (p_session->>'id'),0));
  if nullif(p_session->>'plannedSessionId','') is not null then select id into planned_uuid from public.training_sessions where user_id=uid and client_id=p_session->>'plannedSessionId'; if planned_uuid is null then raise exception 'Planned session is unavailable'; end if; end if;
  if nullif(p_session->>'templateId','') is not null then select id into template_uuid from public.endurance_templates where user_id=uid and client_id=p_session->>'templateId'; if template_uuid is null then raise exception 'Endurance template is unavailable'; end if; end if;
  insert into public.training_sessions(user_id,client_id,modality,activity_type,status,title,session_date,planned_start_time,planned_duration_minutes,planned_distance_metres,target_rpe,environment,training_category,planned_session_id,endurance_template_id,started_at,ended_at,duration_seconds,distance_metres,average_pace_seconds_per_km,average_speed_kph,average_split_seconds_per_500m,completed_rpe,average_heart_rate,elevation_gain_metres,notes,source,external_provider,external_activity_id,completed_at,skipped)
  values(uid,p_session->>'id','endurance',p_session->>'activityType',p_session->>'status',trim(p_session->>'title'),(p_session->>'date')::date,nullif(p_session->>'plannedStartTime','')::time,nullif(p_session->>'plannedDurationMinutes','')::integer,nullif(p_session->>'plannedDistanceMetres','')::numeric,nullif(p_session->>'targetRpe','')::numeric,nullif(p_session->>'environment',''),nullif(p_session->>'category',''),planned_uuid,template_uuid,nullif(p_session->>'startedAt','')::timestamptz,nullif(p_session->>'endedAt','')::timestamptz,nullif(p_session->>'durationSeconds','')::integer,nullif(p_session->>'distanceMetres','')::numeric,nullif(p_session->>'averagePaceSecondsPerKm','')::numeric,nullif(p_session->>'averageSpeedKph','')::numeric,nullif(p_session->>'averageSplitSecondsPer500m','')::numeric,nullif(p_session->>'rpe','')::numeric,nullif(p_session->>'averageHeartRate','')::integer,nullif(p_session->>'elevationGainMetres','')::numeric,coalesce(p_session->>'notes',''),coalesce(nullif(p_session->>'source',''),'manual'),nullif(p_session->>'externalProvider',''),nullif(p_session->>'externalActivityId',''),case when p_session->>'status'='completed' then coalesce(nullif(p_session->>'completedAt','')::timestamptz,now()) else null end,coalesce((p_session->>'skipped')::boolean,false))
  on conflict(user_id,client_id) do update set activity_type=excluded.activity_type,status=excluded.status,title=excluded.title,session_date=excluded.session_date,planned_start_time=excluded.planned_start_time,planned_duration_minutes=excluded.planned_duration_minutes,planned_distance_metres=excluded.planned_distance_metres,target_rpe=excluded.target_rpe,environment=excluded.environment,training_category=excluded.training_category,planned_session_id=excluded.planned_session_id,endurance_template_id=excluded.endurance_template_id,started_at=excluded.started_at,ended_at=excluded.ended_at,duration_seconds=excluded.duration_seconds,distance_metres=excluded.distance_metres,average_pace_seconds_per_km=excluded.average_pace_seconds_per_km,average_speed_kph=excluded.average_speed_kph,average_split_seconds_per_500m=excluded.average_split_seconds_per_500m,completed_rpe=excluded.completed_rpe,average_heart_rate=excluded.average_heart_rate,elevation_gain_metres=excluded.elevation_gain_metres,notes=excluded.notes,source=excluded.source,external_provider=excluded.external_provider,external_activity_id=excluded.external_activity_id,completed_at=excluded.completed_at,skipped=excluded.skipped returning id into session_uuid;
  delete from public.training_session_blocks where session_id=session_uuid;
  insert into public.training_session_blocks(user_id,session_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id)
  select uid,session_uuid,item->>'id',item->>'type',ordinality::integer-1,coalesce(item->>'title',''),coalesce(item->>'instructions',''),nullif(item->>'repetitions','')::integer,nullif(item->>'durationSeconds','')::integer,nullif(item->>'distanceMetres','')::numeric,nullif(item->>'recoveryDurationSeconds','')::integer,nullif(item->>'recoveryDistanceMetres','')::numeric,coalesce(item->>'intensityTarget',''),coalesce(nullif(item->>'completionType',''),'open'),nullif(item->>'targetMetric',''),nullif(item->>'targetMinValue','')::numeric,nullif(item->>'targetMaxValue','')::numeric,nullif(item->>'targetUnit',''),nullif(item->>'stroke',''),coalesce(item->'providerMetadata','{}'::jsonb),nullif(item->>'parentId','')
  from jsonb_array_elements(coalesce(p_session->'blocks','[]'::jsonb)) with ordinality blocks(item,ordinality);
  if p_session->>'status'='planned' then
    insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
    values(uid,'endurance:' || (p_session->>'id'),'endurance',p_session->>'id',(p_session->>'date')::date,case when coalesce((p_session->>'skipped')::boolean,false) then 'skipped' else 'planned' end)
    on conflict(user_id,occurrence_key) do update set planned_date=excluded.planned_date,status=excluded.status;
  elsif p_session->>'status'='completed' and planned_uuid is not null then
    update public.training_plan_occurrences set status='completed',linked_completion_client_id=p_session->>'id',completed_at=now()
    where user_id=uid and occurrence_key='endurance:' || (p_session->>'plannedSessionId') and status in ('planned','skipped');
  end if;
end; $$;

revoke all on function public.save_strength_workout(jsonb,text) from public,anon;
revoke all on function public.save_strength_template(jsonb) from public,anon;
revoke all on function public.save_endurance_template(jsonb) from public,anon;
revoke all on function public.save_endurance_session(jsonb) from public,anon;
grant execute on function public.save_strength_workout(jsonb,text) to authenticated;
grant execute on function public.save_strength_template(jsonb) to authenticated;
grant execute on function public.save_endurance_template(jsonb) to authenticated;
grant execute on function public.save_endurance_session(jsonb) to authenticated;

commit;
