begin;

create table if not exists public.coach_training_assignments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coach_client_relationships(id) on delete restrict,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  modality text not null check (modality in ('strength','endurance')),
  source_template_client_id text not null,
  source_template_name text not null check (char_length(source_template_name) between 1 and 120),
  assigned_date date not null,
  coach_instruction text not null default '' check (char_length(coach_instruction) <= 1000),
  coach_display_name text not null check (char_length(coach_display_name) between 1 and 120),
  occurrence_key text not null check (char_length(occurrence_key) between 1 and 220),
  client_strength_template_id uuid,
  client_planned_session_id uuid,
  scheduled_workout_id uuid,
  created_at timestamptz not null default now(),
  unique (client_user_id, occurrence_key),
  check (coach_user_id <> client_user_id)
);

alter table public.workout_templates add column if not exists coach_assignment_id uuid;
alter table public.scheduled_workouts add column if not exists coach_assignment_id uuid;
alter table public.training_sessions add column if not exists coach_assignment_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='workout_templates_coach_assignment_fk') then
    alter table public.workout_templates add constraint workout_templates_coach_assignment_fk
      foreign key (coach_assignment_id) references public.coach_training_assignments(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='scheduled_workouts_coach_assignment_fk') then
    alter table public.scheduled_workouts add constraint scheduled_workouts_coach_assignment_fk
      foreign key (coach_assignment_id) references public.coach_training_assignments(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='training_sessions_coach_assignment_fk') then
    alter table public.training_sessions add constraint training_sessions_coach_assignment_fk
      foreign key (coach_assignment_id) references public.coach_training_assignments(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='coach_assignments_client_template_fk') then
    alter table public.coach_training_assignments add constraint coach_assignments_client_template_fk
      foreign key (client_strength_template_id) references public.workout_templates(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='coach_assignments_client_session_fk') then
    alter table public.coach_training_assignments add constraint coach_assignments_client_session_fk
      foreign key (client_planned_session_id) references public.training_sessions(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='coach_assignments_scheduled_workout_fk') then
    alter table public.coach_training_assignments add constraint coach_assignments_scheduled_workout_fk
      foreign key (scheduled_workout_id) references public.scheduled_workouts(id) on delete set null;
  end if;
end;
$$;

create or replace function public.inherit_planned_coach_assignment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.coach_assignment_id is null and new.planned_session_id is not null then
    select planned.coach_assignment_id into new.coach_assignment_id
    from public.training_sessions planned
    where planned.id=new.planned_session_id and planned.user_id=new.user_id;
  end if;
  return new;
end;$$;
drop trigger if exists training_sessions_inherit_coach_assignment on public.training_sessions;
create trigger training_sessions_inherit_coach_assignment
  before insert or update of planned_session_id on public.training_sessions
  for each row execute function public.inherit_planned_coach_assignment();
revoke all on function public.inherit_planned_coach_assignment() from public,anon,authenticated;

create index if not exists coach_training_assignments_relationship_idx
  on public.coach_training_assignments(relationship_id,assigned_date desc);
create index if not exists coach_training_assignments_client_idx
  on public.coach_training_assignments(client_user_id,assigned_date desc);
create index if not exists workout_templates_coach_assignment_idx
  on public.workout_templates(coach_assignment_id) where coach_assignment_id is not null;
create index if not exists training_sessions_coach_assignment_idx
  on public.training_sessions(coach_assignment_id) where coach_assignment_id is not null;

alter table public.coach_training_assignments enable row level security;

drop policy if exists coach_training_assignments_client_select on public.coach_training_assignments;
create policy coach_training_assignments_client_select
  on public.coach_training_assignments for select to authenticated
  using ((select auth.uid())=client_user_id);

drop policy if exists coach_training_assignments_active_coach_select on public.coach_training_assignments;
create policy coach_training_assignments_active_coach_select
  on public.coach_training_assignments for select to authenticated
  using (
    (select auth.uid())=coach_user_id
    and exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.id=relationship_id
        and relationship.status='active'
        and relationship.coach_user_id=(select auth.uid())
        and relationship.client_user_id=client_user_id
        and (relationship.can_view_planned_sessions or relationship.can_view_completed_sessions)
    )
  );

revoke all on public.coach_training_assignments from anon,authenticated;
grant select on public.coach_training_assignments to authenticated;
grant all on public.coach_training_assignments to service_role;

create or replace function public.set_coaching_mvp_permissions(p_relationship_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.coach_client_relationships
  set can_view_planned_sessions=p_enabled,
      can_view_completed_sessions=p_enabled,
      can_assign_training=p_enabled,
      updated_at=now()
  where id=p_relationship_id and client_user_id=auth.uid() and status='active';
  if not found then raise exception 'This coaching relationship is unavailable';end if;
end;$$;

create or replace function public.respond_coach_client_invite(p_relationship_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();relationship public.coach_client_relationships;
begin
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and client_user_id=current_user_id and status='pending' for update;
  if relationship.id is null then raise exception 'This coaching invitation is unavailable';end if;
  if p_accept and public.coaching_pair_is_blocked(relationship.coach_user_id,current_user_id) then raise exception 'This account is unavailable';end if;
  update public.coach_client_relationships set
    status=case when p_accept then 'active' else 'declined' end,
    responded_at=now(),accepted_at=case when p_accept then now() else null end,
    ended_at=case when p_accept then null else now() end,
    can_view_planned_sessions=p_accept,
    can_view_completed_sessions=p_accept,
    can_assign_training=p_accept,
    updated_at=now()
  where id=p_relationship_id;
end;$$;

comment on column public.coach_client_relationships.can_view_planned_sessions is
  'Client-controlled coaching permission. New MVP invitations grant the minimum training permissions when the client accepts; the client can revoke them later.';

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
  client_template_id uuid;scheduled_id uuid;planned_session_id uuid;
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
    returning id,training_session_id into scheduled_id,planned_session_id;
    update public.training_sessions set coach_assignment_id=assignment_id where id=planned_session_id and user_id=relationship.client_user_id;
    insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
    values(relationship.client_user_id,assignment_key,'strength',assignment_client_id,p_assigned_date,'planned')
    on conflict(user_id,occurrence_key) do nothing;
    update public.coach_training_assignments set client_strength_template_id=client_template_id,client_planned_session_id=planned_session_id,scheduled_workout_id=scheduled_id where id=assignment_id;
  else
    select * into source_endurance from public.endurance_templates where user_id=uid and client_id=p_source_template_client_id;
    if source_endurance.id is null then raise exception 'Endurance template is unavailable';end if;
    assignment_key:='endurance:'||assignment_client_id;
    insert into public.coach_training_assignments(id,relationship_id,coach_user_id,client_user_id,modality,source_template_client_id,source_template_name,assigned_date,coach_instruction,coach_display_name,occurrence_key)
    values(assignment_id,relationship.id,uid,relationship.client_user_id,'endurance',p_source_template_client_id,source_endurance.title,p_assigned_date,coalesce(p_instruction,''),coach_name,assignment_key);
    insert into public.training_sessions(user_id,client_id,modality,activity_type,status,title,session_date,planned_duration_minutes,planned_distance_metres,target_rpe,environment,training_category,notes,source,coach_assignment_id)
    values(relationship.client_user_id,assignment_client_id,'endurance',source_endurance.activity_type,'planned',source_endurance.title,p_assigned_date,source_endurance.planned_duration_minutes,source_endurance.planned_distance_metres,source_endurance.target_rpe,source_endurance.environment,source_endurance.training_category,
      trim(both from concat_ws(E'\n\n',nullif(source_endurance.notes,''),nullif(p_instruction,''))),'coach_assignment',assignment_id)
    returning id into planned_session_id;
    insert into public.training_session_blocks(user_id,session_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id)
    select relationship.client_user_id,planned_session_id,client_id,block_type,position,title,instructions,repetitions,planned_duration_seconds,planned_distance_metres,recovery_duration_seconds,recovery_distance_metres,intensity_target,completion_type,target_metric,target_min_value,target_max_value,target_unit,stroke,provider_metadata,parent_client_id
    from public.endurance_template_blocks where template_id=source_endurance.id order by position;
    insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
    values(relationship.client_user_id,assignment_key,'endurance',assignment_client_id,p_assigned_date,'planned');
    update public.coach_training_assignments set client_planned_session_id=planned_session_id where id=assignment_id;
  end if;
  return assignment_id;
end;$$;

create or replace function public.list_coach_clients_summary(p_anchor date default current_date)
returns table(relationship_id uuid,client_user_id uuid,username text,display_name text,avatar_url text,week_start date,planned_sessions bigint,completed_sessions bigint,next_session_title text,next_session_date date,permissions_ready boolean)
language sql stable security definer set search_path='' as $$
  with clients as (
    select relationship.*,profile.username,coalesce(profile.display_name,profile.username,'Setra athlete') display_name,profile.avatar_url,
      p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7)) week_start
    from public.coach_client_relationships relationship join public.profiles profile on profile.id=relationship.client_user_id
    where relationship.coach_user_id=auth.uid() and relationship.status='active'
  )
  select clients.id,clients.client_user_id,clients.username,clients.display_name,clients.avatar_url,clients.week_start,
    case when clients.can_view_planned_sessions then (select count(*) from public.training_plan_occurrences occurrence where occurrence.user_id=clients.client_user_id and occurrence.planned_date between clients.week_start and clients.week_start+6 and occurrence.status in ('planned','completed','partial','skipped')) else 0 end,
    case when clients.can_view_completed_sessions then (select count(*) from public.training_plan_occurrences occurrence where occurrence.user_id=clients.client_user_id and occurrence.planned_date between clients.week_start and clients.week_start+6 and occurrence.status in ('completed','partial')) else 0 end,
    case when clients.can_view_planned_sessions then next_item.title else null end,
    case when clients.can_view_planned_sessions then next_item.planned_date else null end,
    clients.can_view_planned_sessions and clients.can_view_completed_sessions and clients.can_assign_training
  from clients left join lateral (
    select occurrence.planned_date,coalesce(strength.name,endurance.title,'Planned session') title
    from public.training_plan_occurrences occurrence
    left join public.workout_templates strength on occurrence.modality='strength' and strength.user_id=clients.client_user_id and strength.client_id=occurrence.source_client_id
    left join public.training_sessions endurance on occurrence.modality='endurance' and endurance.user_id=clients.client_user_id and endurance.client_id=occurrence.source_client_id
    where occurrence.user_id=clients.client_user_id and occurrence.status='planned' and occurrence.planned_date>=p_anchor
    order by occurrence.planned_date limit 1
  ) next_item on true order by clients.display_name;
$$;

create or replace function public.get_coach_client_week(p_relationship_id uuid,p_anchor date default current_date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare relationship public.coach_client_relationships;week_start date;client_name text;result jsonb;
begin
  select * into relationship from public.coach_client_relationships where id=p_relationship_id and coach_user_id=auth.uid() and status='active';
  if relationship.id is null then raise exception 'Active coaching relationship is required';end if;
  if not relationship.can_view_planned_sessions and not relationship.can_view_completed_sessions then raise exception 'Client training permission is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(week_starts_on,1)+7)%7)),coalesce(display_name,username,'Setra athlete') into week_start,client_name from public.profiles where id=relationship.client_user_id;
  select jsonb_build_object('relationshipId',relationship.id,'clientUserId',relationship.client_user_id,'clientName',client_name,'weekStart',week_start,'weekEnd',week_start+6,
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',occurrence.id,'date',occurrence.planned_date,'modality',occurrence.modality,'status',occurrence.status,
      'title',coalesce(strength.name,endurance.title,'Training session'),
      'summary',case when occurrence.modality='strength' then coalesce((select count(*)::text||' exercises · '||coalesce(sum(planned_sets),0)::text||' sets' from public.template_exercises where template_id=strength.id),'Strength') else concat_ws(' · ',case when endurance.planned_distance_metres is not null then trim(to_char(endurance.planned_distance_metres/1000,'FM999990.##'))||' km' end,case when endurance.planned_duration_minutes is not null then trim(to_char(endurance.planned_duration_minutes,'FM999990.##'))||' min' end,endurance.activity_type) end,
      'assignedBy',assignment.coach_display_name,
      'completedDetail',case when occurrence.status in ('completed','partial') and relationship.can_view_completed_sessions then
        case when occurrence.modality='strength' then (select jsonb_build_object('durationSeconds',session.duration_seconds,'exercises',coalesce(jsonb_agg(jsonb_build_object('name',exercise.name,'sets',(select coalesce(jsonb_agg(jsonb_build_object('weight',set_row.weight,'loadText',set_row.load_text,'reps',set_row.reps,'rpe',set_row.rpe) order by set_row.set_number),'[]'::jsonb) from public.workout_sets set_row where set_row.workout_exercise_id=workout_exercise.id and set_row.completed)) order by workout_exercise.position),'[]'::jsonb)) from public.workouts workout join public.workout_exercises workout_exercise on workout_exercise.workout_id=workout.id join public.exercises exercise on exercise.id=workout_exercise.exercise_id left join public.training_sessions session on session.id=workout.training_session_id where workout.user_id=relationship.client_user_id and workout.client_id=occurrence.linked_completion_client_id group by session.duration_seconds)
        else (select jsonb_build_object('durationSeconds',actual.duration_seconds,'distanceMetres',actual.distance_metres,'averagePaceSecondsPerKm',actual.average_pace_seconds_per_km,'averageSpeedKph',actual.average_speed_kph,'averageHeartRate',actual.average_heart_rate,'elevationGainMetres',actual.elevation_gain_metres) from public.training_sessions actual where actual.user_id=relationship.client_user_id and actual.client_id=occurrence.linked_completion_client_id) end
      else null end
    ) order by occurrence.planned_date,coalesce(strength.name,endurance.title)),'[]'::jsonb)) into result
  from public.training_plan_occurrences occurrence
  left join public.workout_templates strength on occurrence.modality='strength' and strength.user_id=relationship.client_user_id and strength.client_id=occurrence.source_client_id
  left join public.training_sessions endurance on occurrence.modality='endurance' and endurance.user_id=relationship.client_user_id and endurance.client_id=occurrence.source_client_id
  left join public.coach_training_assignments assignment on assignment.client_user_id=relationship.client_user_id and assignment.occurrence_key=occurrence.occurrence_key
  where occurrence.user_id=relationship.client_user_id and occurrence.planned_date between week_start and week_start+6
    and ((occurrence.status in ('completed','partial') and relationship.can_view_completed_sessions) or (occurrence.status not in ('completed','partial') and relationship.can_view_planned_sessions));
  return result;
end;$$;

revoke all on function public.set_coaching_mvp_permissions(uuid,boolean) from public,anon;
revoke all on function public.respond_coach_client_invite(uuid,boolean) from public,anon;
revoke all on function public.coach_assign_template(uuid,text,text,date,text) from public,anon;
revoke all on function public.list_coach_clients_summary(date) from public,anon;
revoke all on function public.get_coach_client_week(uuid,date) from public,anon;
grant execute on function public.set_coaching_mvp_permissions(uuid,boolean) to authenticated;
grant execute on function public.respond_coach_client_invite(uuid,boolean) to authenticated;
grant execute on function public.coach_assign_template(uuid,text,text,date,text) to authenticated;
grant execute on function public.list_coach_clients_summary(date) to authenticated;
grant execute on function public.get_coach_client_week(uuid,date) to authenticated;

commit;
