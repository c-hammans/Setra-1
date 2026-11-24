begin;

create table if not exists public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references auth.users(id) on delete cascade,
  relationship_id uuid references public.coach_client_relationships(id) on delete set null,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_role text not null check (created_by_role in ('client','coach')),
  title text not null check (char_length(trim(title)) between 1 and 120),
  goal_type text not null check (goal_type in ('strength','muscle_gain','general_fitness','running','cycling','swimming','rowing','hybrid','event_race','custom')),
  target_date date,
  metric_type text not null default 'none' check (metric_type in ('none','strength_load','event_time','distance','duration','custom')),
  target_value numeric(14,3),
  target_unit text not null default '' check (target_unit in ('','kg','seconds','metres','text')),
  target_label text not null default '' check (char_length(target_label)<=120),
  target_distance_metres numeric(14,3) check (target_distance_metres is null or target_distance_metres>0),
  target_text text not null default '' check (char_length(target_text)<=240),
  notes text not null default '' check (char_length(notes)<=2000),
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','archived')),
  approval_status text not null default 'accepted' check (approval_status in ('proposed','accepted')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by_role='client' or relationship_id is not null),
  check (created_by_user_id<>client_user_id or created_by_role='client'),
  check ((metric_type='strength_load' and target_value is not null and target_unit='kg' and target_label<>'') or metric_type<>'strength_load'),
  check ((metric_type='event_time' and target_value is not null and target_unit='seconds' and target_distance_metres is not null) or metric_type<>'event_time')
);

create table if not exists public.client_program_goals (
  client_program_id uuid not null references public.client_programs(id) on delete cascade,
  goal_id uuid not null references public.athlete_goals(id) on delete cascade,
  linked_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(client_program_id,goal_id)
);

create unique index if not exists athlete_goals_one_primary_idx
  on public.athlete_goals(client_user_id)
  where is_primary and status='active' and approval_status='accepted';
create index if not exists athlete_goals_client_idx on public.athlete_goals(client_user_id,status,updated_at desc);

alter table public.athlete_goals enable row level security;
alter table public.client_program_goals enable row level security;

drop policy if exists athlete_goals_client_select on public.athlete_goals;
create policy athlete_goals_client_select on public.athlete_goals for select to authenticated
  using ((select auth.uid())=client_user_id);
drop policy if exists athlete_goals_active_coach_select on public.athlete_goals;
create policy athlete_goals_active_coach_select on public.athlete_goals for select to authenticated
  using (exists(select 1 from public.coach_client_relationships relationship
    where relationship.client_user_id=athlete_goals.client_user_id
      and relationship.coach_user_id=(select auth.uid()) and relationship.status='active'
      and relationship.can_view_planned_sessions));
drop policy if exists client_program_goals_participant_select on public.client_program_goals;
create policy client_program_goals_participant_select on public.client_program_goals for select to authenticated
  using (exists(select 1 from public.client_programs program
    where program.id=client_program_id and ((select auth.uid())=program.client_user_id or
      ((select auth.uid())=program.coach_user_id and exists(select 1 from public.coach_client_relationships relationship
        where relationship.id=program.relationship_id and relationship.status='active')))));

revoke all on public.athlete_goals,public.client_program_goals from anon,authenticated;
grant select on public.athlete_goals,public.client_program_goals to authenticated;
grant all on public.athlete_goals,public.client_program_goals to service_role;

create or replace function public.list_athlete_goals(p_relationship_id uuid default null)
returns table(
  goal_id uuid,client_user_id uuid,relationship_id uuid,title text,goal_type text,target_date date,
  metric_type text,target_value numeric,target_unit text,target_label text,target_distance_metres numeric,target_text text,
  notes text,is_primary boolean,status text,approval_status text,created_by_role text,creator_name text,
  current_value numeric,goal_reached boolean,linked_programs jsonb,created_at timestamptz,updated_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();client_id uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_relationship_id is null then client_id:=uid;
  else
    select relationship.client_user_id into client_id from public.coach_client_relationships relationship
    where relationship.id=p_relationship_id and relationship.coach_user_id=uid and relationship.status='active'
      and relationship.can_view_planned_sessions;
    if client_id is null then raise exception 'Active client permission is required';end if;
  end if;
  return query
  select goal.id,goal.client_user_id,goal.relationship_id,goal.title,goal.goal_type,goal.target_date,
    goal.metric_type,goal.target_value,goal.target_unit,goal.target_label,goal.target_distance_metres,goal.target_text,
    goal.notes,goal.is_primary,goal.status,goal.approval_status,goal.created_by_role,
    coalesce(nullif(creator.display_name,''),creator.username,'Setra user'),
    case
      when goal.metric_type='strength_load' then (select max(set_row.weight) from public.workout_sets set_row
        join public.workout_exercises workout_exercise on workout_exercise.id=set_row.workout_exercise_id
        join public.exercises exercise on exercise.id=workout_exercise.exercise_id
        join public.workouts workout on workout.id=workout_exercise.workout_id
        where workout.user_id=goal.client_user_id and workout.status='completed' and set_row.completed
          and not workout_exercise.skipped and lower(exercise.name)=lower(goal.target_label))
      when goal.metric_type='event_time' then (select min(session.duration_seconds)::numeric from public.training_sessions session
        where session.user_id=goal.client_user_id and session.status='completed' and session.duration_seconds is not null
          and session.distance_metres between goal.target_distance_metres*.98 and goal.target_distance_metres*1.02
          and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
            or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row')))
      else null
    end,
    case
      when goal.metric_type='strength_load' then coalesce((select max(set_row.weight) from public.workout_sets set_row
        join public.workout_exercises workout_exercise on workout_exercise.id=set_row.workout_exercise_id
        join public.exercises exercise on exercise.id=workout_exercise.exercise_id
        join public.workouts workout on workout.id=workout_exercise.workout_id
        where workout.user_id=goal.client_user_id and workout.status='completed' and set_row.completed
          and not workout_exercise.skipped and lower(exercise.name)=lower(goal.target_label)),0)>=goal.target_value
      when goal.metric_type='event_time' then coalesce((select min(session.duration_seconds)::numeric from public.training_sessions session
        where session.user_id=goal.client_user_id and session.status='completed' and session.duration_seconds is not null
          and session.distance_metres between goal.target_distance_metres*.98 and goal.target_distance_metres*1.02
          and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
            or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row'))),1e12)<=goal.target_value
      else false
    end,
    coalesce((select jsonb_agg(jsonb_build_object('id',program.id,'name',program.name,'status',program.status))
      from public.client_program_goals link join public.client_programs program on program.id=link.client_program_id
      where link.goal_id=goal.id),'[]'::jsonb),goal.created_at,goal.updated_at
  from public.athlete_goals goal left join public.profiles creator on creator.id=goal.created_by_user_id
  where goal.client_user_id=client_id
  order by case when goal.is_primary and goal.status='active' and goal.approval_status='accepted' then 0 else 1 end,
    case goal.status when 'active' then 0 when 'completed' then 1 else 2 end,goal.updated_at desc;
end;$$;

create or replace function public.save_athlete_goal(
  p_goal_id uuid,p_relationship_id uuid,p_title text,p_goal_type text,p_target_date date,p_metric_type text,
  p_target_value numeric,p_target_unit text,p_target_label text,p_target_distance_metres numeric,p_target_text text,
  p_notes text,p_is_primary boolean,p_linked_program_id uuid default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();relationship public.coach_client_relationships;existing public.athlete_goals;
  client_id uuid;creator_role text;approval text;result_id uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if char_length(trim(coalesce(p_title,''))) not between 1 and 120 then raise exception 'Goal title is required';end if;
  if p_goal_type not in ('strength','muscle_gain','general_fitness','running','cycling','swimming','rowing','hybrid','event_race','custom') then raise exception 'Goal type is invalid';end if;
  if p_metric_type not in ('none','strength_load','event_time','distance','duration','custom') then raise exception 'Goal metric is invalid';end if;
  if char_length(coalesce(p_target_label,''))>120 or char_length(coalesce(p_target_text,''))>240 or char_length(coalesce(p_notes,''))>2000 then raise exception 'Goal details are too long';end if;
  if p_metric_type='strength_load' and (p_target_value is null or p_target_value<=0 or p_target_unit<>'kg' or trim(coalesce(p_target_label,''))='') then raise exception 'Strength goals require an exercise and target load';end if;
  if p_metric_type='event_time' and (p_target_value is null or p_target_value<=0 or p_target_unit<>'seconds' or p_target_distance_metres is null or p_target_distance_metres<=0) then raise exception 'Event goals require a distance and target time';end if;

  if p_goal_id is null then
    if p_relationship_id is null then client_id:=uid;creator_role:='client';approval:='accepted';
    else
      select * into relationship from public.coach_client_relationships where id=p_relationship_id and coach_user_id=uid
        and status='active' and can_view_planned_sessions and can_assign_training;
      if relationship.id is null then raise exception 'Active coaching permission is required';end if;
      client_id:=relationship.client_user_id;creator_role:='coach';approval:='proposed';
    end if;
    if p_is_primary and approval='accepted' then update public.athlete_goals set is_primary=false,updated_at=now() where client_user_id=client_id and is_primary;end if;
    insert into public.athlete_goals(client_user_id,relationship_id,created_by_user_id,created_by_role,title,goal_type,target_date,
      metric_type,target_value,target_unit,target_label,target_distance_metres,target_text,notes,is_primary,approval_status)
    values(client_id,p_relationship_id,uid,creator_role,trim(p_title),p_goal_type,p_target_date,p_metric_type,p_target_value,
      coalesce(p_target_unit,''),trim(coalesce(p_target_label,'')),p_target_distance_metres,trim(coalesce(p_target_text,'')),
      trim(coalesce(p_notes,'')),p_is_primary and approval='accepted',approval) returning id into result_id;
  else
    select * into existing from public.athlete_goals where id=p_goal_id for update;
    if existing.id is null then raise exception 'Goal is unavailable';end if;
    if uid=existing.client_user_id then
      if p_is_primary then update public.athlete_goals set is_primary=false,updated_at=now() where client_user_id=uid and id<>existing.id and is_primary;end if;
      update public.athlete_goals set title=trim(p_title),goal_type=p_goal_type,target_date=p_target_date,metric_type=p_metric_type,
        target_value=p_target_value,target_unit=coalesce(p_target_unit,''),target_label=trim(coalesce(p_target_label,'')),
        target_distance_metres=p_target_distance_metres,target_text=trim(coalesce(p_target_text,'')),notes=trim(coalesce(p_notes,'')),
        is_primary=p_is_primary,approval_status='accepted',updated_at=now() where id=existing.id returning id into result_id;
    else
      select * into relationship from public.coach_client_relationships where coach_user_id=uid and client_user_id=existing.client_user_id
        and status='active' and can_view_planned_sessions and can_assign_training;
      if relationship.id is null or existing.created_by_user_id<>uid then raise exception 'Client-owned goals cannot be changed by a coach';end if;
      update public.athlete_goals set title=trim(p_title),goal_type=p_goal_type,target_date=p_target_date,metric_type=p_metric_type,
        target_value=p_target_value,target_unit=coalesce(p_target_unit,''),target_label=trim(coalesce(p_target_label,'')),
        target_distance_metres=p_target_distance_metres,target_text=trim(coalesce(p_target_text,'')),notes=trim(coalesce(p_notes,'')),updated_at=now()
      where id=existing.id returning id into result_id;
    end if;
  end if;
  return result_id;
end;$$;

create or replace function public.set_athlete_goal_status(p_goal_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare goal public.athlete_goals;relationship public.coach_client_relationships;
begin
  if p_status not in ('active','completed','archived') then raise exception 'Goal status is invalid';end if;
  select * into goal from public.athlete_goals where id=p_goal_id for update;
  if goal.id is null then raise exception 'Goal is unavailable';end if;
  if auth.uid()<>goal.client_user_id then
    select * into relationship from public.coach_client_relationships where coach_user_id=auth.uid() and client_user_id=goal.client_user_id
      and status='active' and can_view_planned_sessions;
    if relationship.id is null then raise exception 'Active coaching permission is required';end if;
    if p_status<>'completed' and goal.created_by_user_id<>auth.uid() then raise exception 'Client-owned goals cannot be archived by a coach';end if;
  end if;
  update public.athlete_goals set status=p_status,is_primary=case when p_status='active' then is_primary else false end,
    completed_at=case when p_status='completed' then now() else null end,updated_at=now() where id=goal.id;
end;$$;

create or replace function public.accept_athlete_goal(p_goal_id uuid,p_make_primary boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare goal public.athlete_goals;
begin
  select * into goal from public.athlete_goals where id=p_goal_id and client_user_id=auth.uid() and approval_status='proposed' for update;
  if goal.id is null then raise exception 'Proposed goal is unavailable';end if;
  if p_make_primary then update public.athlete_goals set is_primary=false,updated_at=now() where client_user_id=auth.uid() and is_primary;end if;
  update public.athlete_goals set approval_status='accepted',is_primary=p_make_primary,updated_at=now() where id=goal.id;
end;$$;

create or replace function public.link_athlete_goal_program(p_goal_id uuid,p_client_program_id uuid,p_link boolean)
returns void language plpgsql security definer set search_path='' as $$
declare goal public.athlete_goals;program public.client_programs;relationship public.coach_client_relationships;
begin
  select * into goal from public.athlete_goals where id=p_goal_id;
  select * into program from public.client_programs where id=p_client_program_id;
  if goal.id is null or program.id is null or goal.client_user_id<>program.client_user_id then raise exception 'Goal and program are unavailable';end if;
  if auth.uid()<>goal.client_user_id then
    select * into relationship from public.coach_client_relationships where id=program.relationship_id and coach_user_id=auth.uid()
      and client_user_id=goal.client_user_id and status='active' and can_assign_training;
    if relationship.id is null then raise exception 'Active coaching permission is required';end if;
  end if;
  if p_link then insert into public.client_program_goals(client_program_id,goal_id,linked_by_user_id)
    values(program.id,goal.id,auth.uid()) on conflict do nothing;
  else delete from public.client_program_goals where client_program_id=program.id and goal_id=goal.id;
  end if;
end;$$;

revoke all on function public.list_athlete_goals(uuid) from public,anon;
revoke all on function public.save_athlete_goal(uuid,uuid,text,text,date,text,numeric,text,text,numeric,text,text,boolean,uuid) from public,anon;
revoke all on function public.set_athlete_goal_status(uuid,text) from public,anon;
revoke all on function public.accept_athlete_goal(uuid,boolean) from public,anon;
revoke all on function public.link_athlete_goal_program(uuid,uuid,boolean) from public,anon;
grant execute on function public.list_athlete_goals(uuid) to authenticated;
grant execute on function public.save_athlete_goal(uuid,uuid,text,text,date,text,numeric,text,text,numeric,text,text,boolean,uuid) to authenticated;
grant execute on function public.set_athlete_goal_status(uuid,text) to authenticated;
grant execute on function public.accept_athlete_goal(uuid,boolean) to authenticated;
grant execute on function public.link_athlete_goal_program(uuid,uuid,boolean) to authenticated;

commit;
