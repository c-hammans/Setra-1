begin;

-- Avoid a collision with training_sessions.planned_session_id while linking a strength assignment.
create or replace function public.coach_assign_template(
  p_relationship_id uuid,
  p_modality text,
  p_source_template_client_id text,
  p_assigned_date date,
  p_instruction text default ''
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();relationship public.coach_client_relationships;assignment_id uuid:=gen_random_uuid();
  source_strength public.workout_templates;source_endurance public.endurance_templates;
  client_template_id uuid;scheduled_id uuid;new_planned_session_id uuid;
  assignment_client_id text:='coach-assignment:'||assignment_id::text;
  assignment_key text;coach_name text;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_modality not in ('strength','endurance') then raise exception 'Unsupported training type';end if;
  if p_assigned_date is null then raise exception 'An assignment date is required';end if;
  if char_length(coalesce(p_instruction,''))>1000 then raise exception 'Instruction is too long';end if;
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=uid and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if public.coaching_pair_is_blocked(uid,relationship.client_user_id) then raise exception 'This account is unavailable';end if;
  select coalesce(nullif(display_name,''),username,'Setra coach') into coach_name from public.profiles where id=uid;

  if p_modality='strength' then
    select * into source_strength from public.workout_templates where user_id=uid and client_id=p_source_template_client_id;
    if source_strength.id is null then raise exception 'Strength template is unavailable';end if;
    assignment_key:='strength:'||assignment_client_id||':'||p_assigned_date::text;
    insert into public.coach_training_assignments(id,relationship_id,coach_user_id,client_user_id,modality,source_template_client_id,source_template_name,assigned_date,coach_instruction,coach_display_name,occurrence_key)
    values(assignment_id,relationship.id,uid,relationship.client_user_id,'strength',p_source_template_client_id,source_strength.name,p_assigned_date,coalesce(p_instruction,''),coach_name,assignment_key);

    insert into public.exercises(id,owner_id,name,muscle_group,equipment)
    select 'coach-'||replace(assignment_id::text,'-','')||'-'||left(md5(exercise.id),12),relationship.client_user_id,exercise.name,exercise.muscle_group,exercise.equipment
    from public.exercises exercise
    where exercise.owner_id=uid and exercise.id in (
      select exercise_id from public.template_exercises where template_id=source_strength.id
      union select exercise_id from public.template_warmup_items where template_id=source_strength.id and exercise_id is not null
    ) on conflict(id) do nothing;

    insert into public.workout_templates(user_id,client_id,name,focus,colour,icon,coach_assignment_id)
    values(relationship.client_user_id,assignment_client_id,source_strength.name,source_strength.focus,source_strength.colour,source_strength.icon,assignment_id)
    returning id into client_template_id;
    insert into public.template_supersets(user_id,template_id,client_group_key,name,position)
    select relationship.client_user_id,client_template_id,client_group_key,name,position from public.template_supersets where template_id=source_strength.id;
    insert into public.template_warmup_items(user_id,template_id,client_id,item_type,exercise_id,title,instructions,position)
    select relationship.client_user_id,client_template_id,item.client_id,item.item_type,
      case when exercise.owner_id is null then item.exercise_id else 'coach-'||replace(assignment_id::text,'-','')||'-'||left(md5(item.exercise_id),12) end,
      item.title,item.instructions,item.position
    from public.template_warmup_items item left join public.exercises exercise on exercise.id=item.exercise_id
    where item.template_id=source_strength.id;
    insert into public.template_exercises(user_id,template_id,exercise_id,superset_id,position,planned_sets,rep_target,notes,planned_load_mode,planned_load_value,planned_load_text,planned_load_source_unit)
    select relationship.client_user_id,client_template_id,
      case when exercise.owner_id is null then item.exercise_id else 'coach-'||replace(assignment_id::text,'-','')||'-'||left(md5(item.exercise_id),12) end,
      target_superset.id,item.position,item.planned_sets,item.rep_target,item.notes,item.planned_load_mode,item.planned_load_value,item.planned_load_text,item.planned_load_source_unit
    from public.template_exercises item
    join public.exercises exercise on exercise.id=item.exercise_id
    left join public.template_supersets source_superset on source_superset.id=item.superset_id
    left join public.template_supersets target_superset on target_superset.template_id=client_template_id and target_superset.client_group_key=source_superset.client_group_key
    where item.template_id=source_strength.id;
    insert into public.scheduled_workouts(user_id,template_id,scheduled_date,coach_assignment_id)
    values(relationship.client_user_id,client_template_id,p_assigned_date,assignment_id)
    returning id,training_session_id into scheduled_id,new_planned_session_id;
    update public.training_sessions set coach_assignment_id=assignment_id where id=new_planned_session_id and user_id=relationship.client_user_id;
    insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
    values(relationship.client_user_id,assignment_key,'strength',assignment_client_id,p_assigned_date,'planned')
    on conflict(user_id,occurrence_key) do nothing;
    update public.coach_training_assignments set client_strength_template_id=client_template_id,client_planned_session_id=new_planned_session_id,scheduled_workout_id=scheduled_id where id=assignment_id;
  else
    select * into source_endurance from public.endurance_templates where user_id=uid and client_id=p_source_template_client_id;
    if source_endurance.id is null then raise exception 'Endurance template is unavailable';end if;
    assignment_key:='endurance:'||assignment_client_id;
    insert into public.coach_training_assignments(id,relationship_id,coach_user_id,client_user_id,modality,source_template_client_id,source_template_name,assigned_date,coach_instruction,coach_display_name,occurrence_key)
    values(assignment_id,relationship.id,uid,relationship.client_user_id,'endurance',p_source_template_client_id,source_endurance.title,p_assigned_date,coalesce(p_instruction,''),coach_name,assignment_key);
    insert into public.training_sessions(user_id,client_id,modality,activity_type,status,title,session_date,planned_duration_minutes,planned_distance_metres,target_rpe,environment,training_category,notes,source,coach_assignment_id)
    values(relationship.client_user_id,assignment_client_id,'endurance',source_endurance.activity_type,'planned',source_endurance.title,p_assigned_date,source_endurance.planned_duration_minutes,source_endurance.planned_distance_metres,source_endurance.target_rpe,source_endurance.environment,source_endurance.training_category,
      trim(both from concat_ws(E'\n\n',nullif(source_endurance.notes,''),nullif(p_instruction,''))),'coach_assignment',assignment_id)
    returning id into new_planned_session_id;
    insert into public.training_session_blocks(user_id,session_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id)
    select relationship.client_user_id,new_planned_session_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id
    from public.endurance_template_blocks where template_id=source_endurance.id order by position;
    insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
    values(relationship.client_user_id,assignment_key,'endurance',assignment_client_id,p_assigned_date,'planned');
    update public.coach_training_assignments set client_planned_session_id=new_planned_session_id where id=assignment_id;
  end if;
  return assignment_id;
end;$$;

commit;
