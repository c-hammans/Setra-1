begin;

create table if not exists public.coach_programs (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description)<=2000),
  duration_weeks smallint not null check (duration_weeks between 1 and 52),
  focus text not null default '' check (char_length(focus)<=240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_program_sessions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.coach_programs(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 52),
  day_offset smallint not null check (day_offset between 0 and 6),
  position integer not null default 0 check (position>=0),
  modality text not null check (modality in ('strength','endurance')),
  source_template_client_id text not null check (char_length(source_template_client_id) between 1 and 220),
  source_template_name text not null check (char_length(source_template_name) between 1 and 120),
  instruction text not null default '' check (char_length(instruction)<=1000),
  created_at timestamptz not null default now(),
  unique(program_id,week_number,day_offset,position)
);

create table if not exists public.client_programs (
  id uuid primary key default gen_random_uuid(),
  source_program_id uuid references public.coach_programs(id) on delete set null,
  relationship_id uuid not null references public.coach_client_relationships(id) on delete restrict,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description)<=2000),
  duration_weeks smallint not null check (duration_weeks between 1 and 52),
  focus text not null default '' check (char_length(focus)<=240),
  start_date date not null,
  end_date date not null,
  status text not null default 'active' check (status in ('active','completed','ended')),
  note text not null default '' check (char_length(note)<=2000),
  program_snapshot jsonb not null check (jsonb_typeof(program_snapshot)='object'),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (coach_user_id<>client_user_id and end_date>=start_date)
);

alter table public.coach_training_assignments add column if not exists client_program_id uuid;
alter table public.coach_training_assignments add column if not exists program_week_number smallint;
alter table public.coach_training_assignments add column if not exists source_program_session_id uuid;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='coach_assignment_client_program_fk') then
    alter table public.coach_training_assignments add constraint coach_assignment_client_program_fk
      foreign key(client_program_id) references public.client_programs(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='coach_assignment_program_session_fk') then
    alter table public.coach_training_assignments add constraint coach_assignment_program_session_fk
      foreign key(source_program_session_id) references public.coach_program_sessions(id) on delete set null;
  end if;
  if not exists(select 1 from pg_constraint where conname='coach_assignment_program_week_check') then
    alter table public.coach_training_assignments add constraint coach_assignment_program_week_check
      check (program_week_number is null or program_week_number between 1 and 52);
  end if;
end;$$;

create index if not exists coach_programs_owner_idx on public.coach_programs(coach_user_id,updated_at desc);
create index if not exists coach_program_sessions_program_idx on public.coach_program_sessions(program_id,week_number,day_offset,position);
create index if not exists client_programs_client_idx on public.client_programs(client_user_id,status,start_date desc);
create index if not exists client_programs_coach_idx on public.client_programs(coach_user_id,status,start_date desc);
create index if not exists coach_assignments_program_idx on public.coach_training_assignments(client_program_id,program_week_number,assigned_date);

drop trigger if exists coach_programs_set_updated_at on public.coach_programs;
create trigger coach_programs_set_updated_at before update on public.coach_programs
  for each row execute function public.set_updated_at();

alter table public.coach_programs enable row level security;
alter table public.coach_program_sessions enable row level security;
alter table public.client_programs enable row level security;

drop policy if exists coach_programs_owner_select on public.coach_programs;
create policy coach_programs_owner_select on public.coach_programs for select to authenticated
  using ((select auth.uid())=coach_user_id);
drop policy if exists coach_program_sessions_owner_select on public.coach_program_sessions;
create policy coach_program_sessions_owner_select on public.coach_program_sessions for select to authenticated
  using ((select auth.uid())=coach_user_id);
drop policy if exists client_programs_client_select on public.client_programs;
create policy client_programs_client_select on public.client_programs for select to authenticated
  using ((select auth.uid())=client_user_id);
drop policy if exists client_programs_active_coach_select on public.client_programs;
create policy client_programs_active_coach_select on public.client_programs for select to authenticated
  using ((select auth.uid())=coach_user_id and exists(
    select 1 from public.coach_client_relationships relationship
    where relationship.id=relationship_id and relationship.status='active'
      and relationship.coach_user_id=(select auth.uid()) and relationship.client_user_id=client_user_id
      and (relationship.can_view_planned_sessions or relationship.can_view_completed_sessions)
  ));

revoke all on public.coach_programs,public.coach_program_sessions,public.client_programs from anon,authenticated;
grant select on public.coach_programs,public.coach_program_sessions,public.client_programs to authenticated;
grant all on public.coach_programs,public.coach_program_sessions,public.client_programs to service_role;

create or replace function public.list_coach_programs()
returns table(program_id uuid,name text,description text,duration_weeks smallint,focus text,sessions jsonb,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select program.id,program.name,program.description,program.duration_weeks,program.focus,
    coalesce(jsonb_agg(jsonb_build_object(
      'id',session.id,'weekNumber',session.week_number,'dayOffset',session.day_offset,'position',session.position,
      'modality',session.modality,'templateId',session.source_template_client_id,'templateName',session.source_template_name,
      'instruction',session.instruction
    ) order by session.week_number,session.day_offset,session.position) filter(where session.id is not null),'[]'::jsonb),
    program.created_at,program.updated_at
  from public.coach_programs program
  left join public.coach_program_sessions session on session.program_id=program.id
  where program.coach_user_id=auth.uid()
  group by program.id order by program.updated_at desc;
$$;

create or replace function public.save_coach_program(
  p_program_id uuid,
  p_name text,
  p_description text,
  p_duration_weeks integer,
  p_focus text,
  p_sessions jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();v_program_id uuid;item jsonb;template_name text;session_position integer;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if not exists(select 1 from public.user_roles where user_id=uid and role='coach') then raise exception 'Coach access is required';end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Program name is required';end if;
  if p_duration_weeks not between 1 and 52 then raise exception 'Program duration must be between 1 and 52 weeks';end if;
  if char_length(coalesce(p_description,''))>2000 or char_length(coalesce(p_focus,''))>240 then raise exception 'Program details are too long';end if;
  if p_sessions is null or jsonb_typeof(p_sessions)<>'array' or jsonb_array_length(p_sessions)>364 then raise exception 'Program sessions are invalid';end if;

  if p_program_id is null then
    insert into public.coach_programs(coach_user_id,name,description,duration_weeks,focus)
    values(uid,trim(p_name),trim(coalesce(p_description,'')),p_duration_weeks,trim(coalesce(p_focus,''))) returning id into v_program_id;
  else
    update public.coach_programs set name=trim(p_name),description=trim(coalesce(p_description,'')),duration_weeks=p_duration_weeks,focus=trim(coalesce(p_focus,''))
    where id=p_program_id and coach_user_id=uid returning id into v_program_id;
    if v_program_id is null then raise exception 'Program is unavailable';end if;
    delete from public.coach_program_sessions session where session.program_id=v_program_id and session.coach_user_id=uid;
  end if;

  for item in select value from jsonb_array_elements(p_sessions) loop
    if (item->>'weekNumber')::integer not between 1 and p_duration_weeks then raise exception 'A session is outside the program duration';end if;
    if (item->>'dayOffset')::integer not between 0 and 6 then raise exception 'A session day is invalid';end if;
    if item->>'modality'='strength' then
      select template.name into template_name from public.workout_templates template
      where template.user_id=uid and template.client_id=item->>'templateId' and template.coach_assignment_id is null;
    elsif item->>'modality'='endurance' then
      select template.title into template_name from public.endurance_templates template
      where template.user_id=uid and template.client_id=item->>'templateId';
    else raise exception 'Unsupported session type';end if;
    if template_name is null then raise exception 'A source template is unavailable';end if;
    select count(*)::integer into session_position from public.coach_program_sessions session
      where session.program_id=v_program_id and session.week_number=(item->>'weekNumber')::integer and session.day_offset=(item->>'dayOffset')::integer;
    insert into public.coach_program_sessions(program_id,coach_user_id,week_number,day_offset,position,modality,source_template_client_id,source_template_name,instruction)
    values(v_program_id,uid,(item->>'weekNumber')::integer,(item->>'dayOffset')::integer,session_position,item->>'modality',item->>'templateId',template_name,trim(coalesce(item->>'instruction','')));
    template_name:=null;
  end loop;
  return v_program_id;
end;$$;

create or replace function public.delete_coach_program(p_program_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.coach_programs where id=p_program_id and coach_user_id=auth.uid();
  if not found then raise exception 'Program is unavailable';end if;
end;$$;

create or replace function public.assign_coach_program(
  p_program_id uuid,
  p_relationship_id uuid,
  p_start_date date,
  p_note text default ''
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();program public.coach_programs;relationship public.coach_client_relationships;
  session public.coach_program_sessions;client_program_id uuid;assignment_id uuid;week_start date;session_date date;snapshot jsonb;
begin
  select * into program from public.coach_programs where id=p_program_id and coach_user_id=uid;
  if program.id is null then raise exception 'Program is unavailable';end if;
  if not exists(select 1 from public.coach_program_sessions where program_id=program.id) then raise exception 'Add at least one session before assigning this program';end if;
  select * into relationship from public.coach_client_relationships
    where id=p_relationship_id and coach_user_id=uid and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if p_start_date is null then raise exception 'A program start date is required';end if;
  if char_length(coalesce(p_note,''))>2000 then raise exception 'Program note is too long';end if;
  select p_start_date-(((extract(dow from p_start_date)::integer-coalesce(profile.week_starts_on,1)+7)%7))
    into week_start from public.profiles profile where profile.id=relationship.client_user_id;
  select jsonb_build_object('name',program.name,'description',program.description,'durationWeeks',program.duration_weeks,'focus',program.focus,
    'sessions',coalesce(jsonb_agg(jsonb_build_object('id',source.id,'weekNumber',source.week_number,'dayOffset',source.day_offset,'position',source.position,'modality',source.modality,'templateId',source.source_template_client_id,'templateName',source.source_template_name,'instruction',source.instruction) order by source.week_number,source.day_offset,source.position),'[]'::jsonb))
    into snapshot from public.coach_program_sessions source where source.program_id=program.id;
  insert into public.client_programs(source_program_id,relationship_id,coach_user_id,client_user_id,name,description,duration_weeks,focus,start_date,end_date,note,program_snapshot)
  values(program.id,relationship.id,uid,relationship.client_user_id,program.name,program.description,program.duration_weeks,program.focus,week_start,week_start+(program.duration_weeks*7-1),trim(coalesce(p_note,'')),snapshot)
  returning id into client_program_id;
  for session in select * from public.coach_program_sessions where program_id=program.id order by week_number,day_offset,position loop
    session_date:=week_start+((session.week_number-1)*7+session.day_offset);
    assignment_id:=public.coach_assign_template(relationship.id,session.modality,session.source_template_client_id,session_date,session.instruction);
    update public.coach_training_assignments set client_program_id=client_program_id,program_week_number=session.week_number,source_program_session_id=session.id
      where id=assignment_id;
  end loop;
  return client_program_id;
end;$$;

create or replace function public.add_coach_program_sessions(
  p_client_program_id uuid,
  p_items jsonb
)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();instance public.client_programs;relationship public.coach_client_relationships;
  item jsonb;item_date date;week_number integer;assignment_id uuid;assignment_ids uuid[]:='{}';
begin
  select * into instance from public.client_programs where id=p_client_program_id and coach_user_id=uid and status='active' for update;
  if instance.id is null then raise exception 'Active client program is required';end if;
  select * into relationship from public.coach_client_relationships where id=instance.relationship_id and coach_user_id=uid and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 28 then raise exception 'Choose between 1 and 28 sessions';end if;
  for item in select value from jsonb_array_elements(p_items) loop
    item_date:=(item->>'date')::date;
    if item_date not between instance.start_date and instance.end_date then raise exception 'Every session must be inside the assigned program';end if;
    week_number:=((item_date-instance.start_date)/7)+1;
    assignment_id:=public.coach_assign_template(instance.relationship_id,item->>'modality',item->>'templateId',item_date,coalesce(item->>'instruction',''));
    update public.coach_training_assignments set client_program_id=instance.id,program_week_number=week_number where id=assignment_id;
    assignment_ids:=array_append(assignment_ids,assignment_id);
  end loop;
  return assignment_ids;
end;$$;

create or replace function public.list_coach_client_programs(p_relationship_id uuid,p_anchor date default current_date)
returns table(client_program_id uuid,name text,description text,focus text,duration_weeks smallint,start_date date,end_date date,status text,note text,current_week integer,total_sessions bigint,completed_sessions bigint,planned_sessions bigint)
language plpgsql security definer set search_path='' as $$
declare relationship public.coach_client_relationships;
begin
  select * into relationship from public.coach_client_relationships
    where id=p_relationship_id and coach_user_id=auth.uid() and status='active' and (can_view_planned_sessions or can_view_completed_sessions);
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  update public.client_programs instance set status='completed'
    where instance.relationship_id=relationship.id and instance.status='active' and p_anchor>instance.end_date
      and not exists(select 1 from public.coach_training_assignments assignment join public.training_plan_occurrences occurrence on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key where assignment.client_program_id=instance.id and occurrence.status='planned');
  return query
    select instance.id,instance.name,instance.description,instance.focus,instance.duration_weeks,instance.start_date,instance.end_date,instance.status,instance.note,
      least(instance.duration_weeks::integer,greatest(1,((p_anchor-instance.start_date)/7)+1)),
      count(assignment.id),count(assignment.id) filter(where occurrence.status in ('completed','partial')),
      count(assignment.id) filter(where occurrence.status='planned')
    from public.client_programs instance
    left join public.coach_training_assignments assignment on assignment.client_program_id=instance.id
    left join public.training_plan_occurrences occurrence on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
    where instance.relationship_id=relationship.id
    group by instance.id order by case instance.status when 'active' then 0 when 'completed' then 1 else 2 end,instance.start_date desc;
end;$$;

create or replace function public.end_coach_program(p_client_program_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare instance public.client_programs;relationship public.coach_client_relationships;assignment record;
begin
  select * into instance from public.client_programs where id=p_client_program_id and coach_user_id=auth.uid() and status='active' for update;
  if instance.id is null then raise exception 'Active client program is required';end if;
  select * into relationship from public.coach_client_relationships where id=instance.relationship_id and coach_user_id=auth.uid() and status='active' and can_assign_training;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  for assignment in select id from public.coach_training_assignments where client_program_id=instance.id order by assigned_date desc loop
    if not public.coach_assignment_is_locked(assignment.id) then perform public.coach_remove_assignment(assignment.id);end if;
  end loop;
  update public.client_programs set status='ended',ended_at=now() where id=instance.id;
end;$$;

create or replace function public.coach_move_assignment(p_assignment_id uuid,p_date date)
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;
  relationship public.coach_client_relationships;occurrence public.training_plan_occurrences;
  instance public.client_programs;next_position integer;next_occurrence_key text;next_program_week smallint;
begin
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid for update;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  select * into relationship from public.coach_client_relationships
  where id=assignment.relationship_id and coach_user_id=uid and client_user_id=assignment.client_user_id
    and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if public.coach_assignment_is_locked(assignment.id) then raise exception 'A started or completed session cannot be moved';end if;
  if p_date is null then raise exception 'A new date is required';end if;
  if p_date=assignment.assigned_date then return;end if;
  if assignment.client_program_id is not null then
    select * into instance from public.client_programs where id=assignment.client_program_id and status='active' for update;
    if instance.id is null or p_date not between instance.start_date and instance.end_date then
      raise exception 'Program sessions must remain inside the assigned block';
    end if;
    next_program_week:=((p_date-instance.start_date)/7)+1;
  end if;
  select * into occurrence from public.training_plan_occurrences
  where user_id=assignment.client_user_id and occurrence_key=assignment.occurrence_key for update;
  select coalesce(max(day_position),-1)+1 into next_position from public.coach_training_assignments
  where client_user_id=assignment.client_user_id and assigned_date=p_date;
  if assignment.modality='strength' then
    next_occurrence_key:='strength:'||occurrence.source_client_id||':'||p_date::text;
    update public.training_plan_occurrences set occurrence_key=next_occurrence_key,planned_date=p_date where id=occurrence.id;
    update public.scheduled_workouts set scheduled_date=p_date
      where id=assignment.scheduled_workout_id and user_id=assignment.client_user_id;
    update public.coach_training_assignments set assigned_date=p_date,day_position=next_position,occurrence_key=next_occurrence_key,
      program_week_number=coalesce(next_program_week,program_week_number) where id=assignment.id;
  else
    update public.training_plan_occurrences set planned_date=p_date where id=occurrence.id;
    update public.training_sessions set session_date=p_date
      where id=assignment.client_planned_session_id and user_id=assignment.client_user_id and status='planned';
    update public.coach_training_assignments set assigned_date=p_date,day_position=next_position,
      program_week_number=coalesce(next_program_week,program_week_number) where id=assignment.id;
  end if;
end;$$;

create or replace function public.coach_replace_assignment(p_assignment_id uuid,p_modality text,p_source_template_client_id text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;relationship_id uuid;assigned_date date;instruction text;position integer;replacement_id uuid;
  program_id uuid;program_week smallint;program_session_id uuid;
begin
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid for update;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  if public.coach_assignment_is_locked(assignment.id) then raise exception 'A started or completed session cannot be replaced';end if;
  relationship_id:=assignment.relationship_id;assigned_date:=assignment.assigned_date;instruction:=assignment.coach_instruction;position:=assignment.day_position;
  program_id:=assignment.client_program_id;program_week:=assignment.program_week_number;program_session_id:=assignment.source_program_session_id;
  perform public.coach_remove_assignment(assignment.id);
  replacement_id:=public.coach_assign_template(relationship_id,p_modality,p_source_template_client_id,assigned_date,instruction);
  update public.coach_training_assignments set day_position=position,client_program_id=program_id,program_week_number=program_week,source_program_session_id=program_session_id where id=replacement_id;
  return replacement_id;
end;$$;

revoke all on function public.list_coach_programs() from public,anon;
revoke all on function public.save_coach_program(uuid,text,text,integer,text,jsonb) from public,anon;
revoke all on function public.delete_coach_program(uuid) from public,anon;
revoke all on function public.assign_coach_program(uuid,uuid,date,text) from public,anon;
revoke all on function public.add_coach_program_sessions(uuid,jsonb) from public,anon;
revoke all on function public.list_coach_client_programs(uuid,date) from public,anon;
revoke all on function public.end_coach_program(uuid) from public,anon;
revoke all on function public.coach_move_assignment(uuid,date) from public,anon;
grant execute on function public.list_coach_programs() to authenticated;
grant execute on function public.save_coach_program(uuid,text,text,integer,text,jsonb) to authenticated;
grant execute on function public.delete_coach_program(uuid) to authenticated;
grant execute on function public.assign_coach_program(uuid,uuid,date,text) to authenticated;
grant execute on function public.add_coach_program_sessions(uuid,jsonb) to authenticated;
grant execute on function public.list_coach_client_programs(uuid,date) to authenticated;
grant execute on function public.end_coach_program(uuid) to authenticated;
grant execute on function public.coach_move_assignment(uuid,date) to authenticated;

commit;
