begin;

alter table public.coach_training_assignments
  add column if not exists day_position integer not null default 0
  check (day_position >= 0);

with ranked as (
  select id,(row_number() over (
    partition by client_user_id,assigned_date
    order by created_at,id
  )-1)::integer as next_position
  from public.coach_training_assignments
)
update public.coach_training_assignments assignment
set day_position=ranked.next_position
from ranked
where ranked.id=assignment.id;

create index if not exists coach_training_assignments_day_order_idx
  on public.coach_training_assignments(client_user_id,assigned_date,day_position);

alter table public.coach_training_assignments replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.coach_training_assignments;
exception when duplicate_object then null;
end;
$$;

create or replace function public.set_coach_assignment_day_position()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  select coalesce(max(day_position),-1)+1 into new.day_position
  from public.coach_training_assignments
  where client_user_id=new.client_user_id and assigned_date=new.assigned_date;
  return new;
end;$$;
drop trigger if exists coach_assignment_set_day_position on public.coach_training_assignments;
create trigger coach_assignment_set_day_position
  before insert on public.coach_training_assignments
  for each row execute function public.set_coach_assignment_day_position();
revoke all on function public.set_coach_assignment_day_position() from public,anon,authenticated;

create or replace function public.coach_assignment_is_locked(p_assignment_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((
    select occurrence.status not in ('planned','skipped')
      or occurrence.linked_completion_client_id is not null
      or exists (
        select 1 from public.workouts workout
        where assignment.modality='strength'
          and workout.user_id=assignment.client_user_id
          and workout.template_id=assignment.client_strength_template_id
          and workout.status in ('in_progress','completed')
      )
      or exists (
        select 1 from public.training_sessions actual
        where assignment.modality='endurance'
          and actual.user_id=assignment.client_user_id
          and actual.planned_session_id=assignment.client_planned_session_id
      )
    from public.coach_training_assignments assignment
    join public.training_plan_occurrences occurrence
      on occurrence.user_id=assignment.client_user_id
      and occurrence.occurrence_key=assignment.occurrence_key
    where assignment.id=p_assignment_id
  ),true);
$$;

revoke all on function public.coach_assignment_is_locked(uuid) from public,anon,authenticated;

create or replace function public.coach_assign_week(
  p_relationship_id uuid,
  p_week_start date,
  p_items jsonb
)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();relationship public.coach_client_relationships;
  expected_week_start date;item jsonb;item_date date;assignment_id uuid;
  assignment_ids uuid[]:='{}';next_position integer;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception 'Choose a valid list of sessions';
  end if;
  if jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>28 then
    raise exception 'Choose between 1 and 28 sessions';
  end if;
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=uid and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  select p_week_start-(((extract(dow from p_week_start)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into expected_week_start from public.profiles profile where profile.id=relationship.client_user_id;
  if expected_week_start is distinct from p_week_start then raise exception 'The selected date is not the start of the client training week';end if;

  for item in select value from jsonb_array_elements(p_items) loop
    item_date:=(item->>'date')::date;
    if item_date not between p_week_start and p_week_start+6 then raise exception 'Every session must be inside the selected client week';end if;
    assignment_id:=public.coach_assign_template(
      p_relationship_id,
      item->>'modality',
      item->>'templateId',
      item_date,
      coalesce(item->>'instruction','')
    );
    select coalesce(max(day_position),-1)+1 into next_position
    from public.coach_training_assignments
    where relationship_id=p_relationship_id and assigned_date=item_date and id<>assignment_id;
    update public.coach_training_assignments set day_position=next_position where id=assignment_id;
    assignment_ids:=array_append(assignment_ids,assignment_id);
  end loop;
  return assignment_ids;
end;$$;

create or replace function public.coach_move_assignment(p_assignment_id uuid,p_date date)
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;
  relationship public.coach_client_relationships;occurrence public.training_plan_occurrences;
  next_position integer;next_occurrence_key text;
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
  select * into occurrence from public.training_plan_occurrences
  where user_id=assignment.client_user_id and occurrence_key=assignment.occurrence_key for update;
  select coalesce(max(day_position),-1)+1 into next_position from public.coach_training_assignments
  where client_user_id=assignment.client_user_id and assigned_date=p_date;

  if assignment.modality='strength' then
    next_occurrence_key:='strength:'||occurrence.source_client_id||':'||p_date::text;
    update public.training_plan_occurrences set occurrence_key=next_occurrence_key,planned_date=p_date where id=occurrence.id;
    update public.scheduled_workouts set scheduled_date=p_date
      where id=assignment.scheduled_workout_id and user_id=assignment.client_user_id;
    update public.coach_training_assignments set assigned_date=p_date,day_position=next_position,occurrence_key=next_occurrence_key where id=assignment.id;
  else
    update public.training_plan_occurrences set planned_date=p_date where id=occurrence.id;
    update public.training_sessions set session_date=p_date
      where id=assignment.client_planned_session_id and user_id=assignment.client_user_id and status='planned';
    update public.coach_training_assignments set assigned_date=p_date,day_position=next_position where id=assignment.id;
  end if;
end;$$;

create or replace function public.coach_remove_assignment(p_assignment_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;
  relationship public.coach_client_relationships;custom_prefix text;
begin
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid for update;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  select * into relationship from public.coach_client_relationships
  where id=assignment.relationship_id and coach_user_id=uid and client_user_id=assignment.client_user_id
    and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if public.coach_assignment_is_locked(assignment.id) then raise exception 'A started or completed session cannot be removed';end if;

  delete from public.training_plan_occurrences
    where user_id=assignment.client_user_id and occurrence_key=assignment.occurrence_key;
  if assignment.modality='strength' then
    delete from public.scheduled_workouts where id=assignment.scheduled_workout_id and user_id=assignment.client_user_id;
    delete from public.workout_templates where id=assignment.client_strength_template_id and user_id=assignment.client_user_id;
    custom_prefix:='coach-'||replace(assignment.id::text,'-','')||'-%';
    delete from public.exercises where owner_id=assignment.client_user_id and id like custom_prefix;
  else
    delete from public.training_sessions where id=assignment.client_planned_session_id and user_id=assignment.client_user_id and status='planned';
  end if;
  delete from public.coach_training_assignments where id=assignment.id;
end;$$;

create or replace function public.coach_replace_assignment(
  p_assignment_id uuid,
  p_modality text,
  p_source_template_client_id text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;
  relationship_id uuid;assigned_date date;instruction text;position integer;replacement_id uuid;
begin
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid for update;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  if public.coach_assignment_is_locked(assignment.id) then raise exception 'A started or completed session cannot be replaced';end if;
  relationship_id:=assignment.relationship_id;assigned_date:=assignment.assigned_date;
  instruction:=assignment.coach_instruction;position:=assignment.day_position;
  perform public.coach_remove_assignment(assignment.id);
  replacement_id:=public.coach_assign_template(relationship_id,p_modality,p_source_template_client_id,assigned_date,instruction);
  update public.coach_training_assignments set day_position=position where id=replacement_id;
  return replacement_id;
end;$$;

create or replace function public.coach_reorder_assignment(p_assignment_id uuid,p_direction integer)
returns void language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;
  relationship public.coach_client_relationships;sibling public.coach_training_assignments;
begin
  if p_direction not in (-1,1) then raise exception 'Direction must be earlier or later';end if;
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid for update;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  select * into relationship from public.coach_client_relationships
  where id=assignment.relationship_id and coach_user_id=uid and client_user_id=assignment.client_user_id
    and status='active' and can_assign_training for update;
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  if public.coach_assignment_is_locked(assignment.id) then raise exception 'A started or completed session cannot be reordered';end if;
  if p_direction=-1 then
    select candidate.* into sibling from public.coach_training_assignments candidate
    where candidate.relationship_id=assignment.relationship_id and candidate.assigned_date=assignment.assigned_date
      and candidate.day_position<assignment.day_position and not public.coach_assignment_is_locked(candidate.id)
    order by candidate.day_position desc,candidate.created_at desc limit 1 for update;
  else
    select candidate.* into sibling from public.coach_training_assignments candidate
    where candidate.relationship_id=assignment.relationship_id and candidate.assigned_date=assignment.assigned_date
      and candidate.day_position>assignment.day_position and not public.coach_assignment_is_locked(candidate.id)
    order by candidate.day_position,candidate.created_at limit 1 for update;
  end if;
  if sibling.id is null then return;end if;
  update public.coach_training_assignments set day_position=case when id=assignment.id then sibling.day_position else assignment.day_position end
  where id in (assignment.id,sibling.id);
end;$$;

create or replace function public.list_coach_week_programming(p_relationship_id uuid,p_anchor date default current_date)
returns table(occurrence_id uuid,assignment_id uuid,day_position integer,editable boolean)
language plpgsql stable security definer set search_path='' as $$
declare active_relationship public.coach_client_relationships;week_start date;
begin
  select * into active_relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=auth.uid() and status='active'
    and (can_view_planned_sessions or can_view_completed_sessions);
  if active_relationship.id is null then raise exception 'Active training permission is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into week_start from public.profiles profile where profile.id=active_relationship.client_user_id;
  return query
    select occurrence.id,assignment.id,assignment.day_position,
      active_relationship.can_assign_training and not public.coach_assignment_is_locked(assignment.id)
    from public.coach_training_assignments assignment
    join public.training_plan_occurrences occurrence
      on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
    where assignment.relationship_id=active_relationship.id
      and occurrence.planned_date between week_start and week_start+6;
end;$$;

revoke all on function public.coach_assign_week(uuid,date,jsonb) from public,anon;
revoke all on function public.coach_move_assignment(uuid,date) from public,anon;
revoke all on function public.coach_remove_assignment(uuid) from public,anon;
revoke all on function public.coach_replace_assignment(uuid,text,text) from public,anon;
revoke all on function public.coach_reorder_assignment(uuid,integer) from public,anon;
revoke all on function public.list_coach_week_programming(uuid,date) from public,anon;
grant execute on function public.coach_assign_week(uuid,date,jsonb) to authenticated;
grant execute on function public.coach_move_assignment(uuid,date) to authenticated;
grant execute on function public.coach_remove_assignment(uuid) to authenticated;
grant execute on function public.coach_replace_assignment(uuid,text,text) to authenticated;
grant execute on function public.coach_reorder_assignment(uuid,integer) to authenticated;
grant execute on function public.list_coach_week_programming(uuid,date) to authenticated;

commit;
