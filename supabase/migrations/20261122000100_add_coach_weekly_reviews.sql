begin;

create table if not exists public.coach_weekly_review_notes (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coach_client_relationships(id) on delete restrict,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  coach_display_name text not null check (char_length(coach_display_name) between 1 and 120),
  note text not null check (char_length(trim(note)) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (relationship_id,week_start),
  check (coach_user_id<>client_user_id)
);

create index if not exists coach_weekly_review_notes_client_idx
  on public.coach_weekly_review_notes(client_user_id,week_start desc);
create index if not exists coach_weekly_review_notes_coach_idx
  on public.coach_weekly_review_notes(coach_user_id,week_start desc);

alter table public.coach_weekly_review_notes enable row level security;

drop policy if exists coach_weekly_review_notes_client_select on public.coach_weekly_review_notes;
create policy coach_weekly_review_notes_client_select on public.coach_weekly_review_notes
  for select to authenticated using ((select auth.uid())=client_user_id);
drop policy if exists coach_weekly_review_notes_active_coach_select on public.coach_weekly_review_notes;
create policy coach_weekly_review_notes_active_coach_select on public.coach_weekly_review_notes
  for select to authenticated using (
    (select auth.uid())=coach_user_id and exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.id=relationship_id
        and relationship.status='active'
        and relationship.coach_user_id=(select auth.uid())
        and relationship.client_user_id=client_user_id
        and relationship.can_view_planned_sessions
        and relationship.can_view_completed_sessions
    )
  );

revoke all on public.coach_weekly_review_notes from anon,authenticated;
grant select on public.coach_weekly_review_notes to authenticated;
grant all on public.coach_weekly_review_notes to service_role;

create or replace function public.list_coach_week_review_sessions(
  p_relationship_id uuid,
  p_anchor date default current_date
)
returns table(
  occurrence_id uuid,
  planned_date date,
  modality text,
  status text,
  title text,
  planned_summary text,
  planned_duration_minutes numeric,
  planned_distance_metres numeric,
  planned_sets bigint,
  actual_duration_seconds integer,
  actual_distance_metres numeric,
  actual_sets bigint,
  actual_volume_kg numeric,
  actual_rpe numeric,
  activity_type text,
  assigned_by text,
  coach_feedback text,
  coach_feedback_updated_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare active_relationship public.coach_client_relationships;week_start date;
begin
  select * into active_relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=auth.uid() and status='active'
    and can_view_planned_sessions and can_view_completed_sessions;
  if active_relationship.id is null then raise exception 'Active weekly review permission is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into week_start from public.profiles profile where profile.id=active_relationship.client_user_id;

  return query
  select
    occurrence.id,
    occurrence.planned_date,
    occurrence.modality,
    occurrence.status,
    coalesce(strength_template.name,endurance_plan.title,'Training session'),
    case when occurrence.modality='strength' then
      coalesce(strength_plan.planned_sets::text||' planned sets','Strength')
    else concat_ws(' · ',
      case when endurance_plan.planned_distance_metres is not null then trim(to_char(endurance_plan.planned_distance_metres/1000,'FM999990.##'))||' km' end,
      case when endurance_plan.planned_duration_minutes is not null then trim(to_char(endurance_plan.planned_duration_minutes,'FM999990.##'))||' min' end,
      endurance_plan.activity_type
    ) end,
    case when occurrence.modality='endurance' then endurance_plan.planned_duration_minutes::numeric else null end,
    case when occurrence.modality='endurance' then endurance_plan.planned_distance_metres else null end,
    case when occurrence.modality='strength' then strength_plan.planned_sets else null end,
    case when occurrence.modality='strength' then strength_actual.duration_seconds else endurance_actual.duration_seconds end,
    case when occurrence.modality='endurance' then endurance_actual.distance_metres else null end,
    case when occurrence.modality='strength' then strength_actual.actual_sets else null end,
    case when occurrence.modality='strength' then strength_actual.actual_volume_kg else null end,
    case when occurrence.modality='endurance' then endurance_actual.completed_rpe else null end,
    case when occurrence.modality='endurance' then coalesce(endurance_actual.activity_type,endurance_plan.activity_type) else 'strength' end,
    assignment.coach_display_name,
    session_feedback.feedback,
    session_feedback.updated_at
  from public.training_plan_occurrences occurrence
  left join public.workout_templates strength_template
    on occurrence.modality='strength'
    and strength_template.user_id=active_relationship.client_user_id
    and strength_template.client_id=occurrence.source_client_id
  left join lateral (
    select coalesce(sum(exercise.planned_sets),0)::bigint planned_sets
    from public.template_exercises exercise
    where exercise.template_id=strength_template.id
  ) strength_plan on occurrence.modality='strength'
  left join public.training_sessions endurance_plan
    on occurrence.modality='endurance'
    and endurance_plan.user_id=active_relationship.client_user_id
    and endurance_plan.client_id=occurrence.source_client_id
  left join lateral (
    select session.duration_seconds,
      count(set_row.id) filter(where set_row.completed)::bigint actual_sets,
      coalesce(sum(
        case when set_row.completed and set_row.weight is not null
          and set_row.reps~'^[0-9]+([.][0-9]+)?$'
        then set_row.weight*(set_row.reps::numeric) else 0 end
      ),0)::numeric actual_volume_kg,
      avg(set_row.rpe) filter(where set_row.completed and set_row.rpe is not null)::numeric actual_rpe
    from public.workouts workout
    left join public.training_sessions session on session.id=workout.training_session_id
    left join public.workout_exercises workout_exercise on workout_exercise.workout_id=workout.id and not workout_exercise.skipped
    left join public.workout_sets set_row on set_row.workout_exercise_id=workout_exercise.id
    where workout.user_id=active_relationship.client_user_id
      and workout.client_id=occurrence.linked_completion_client_id
    group by session.duration_seconds
  ) strength_actual on occurrence.modality='strength' and occurrence.linked_completion_client_id is not null
  left join public.training_sessions endurance_actual
    on occurrence.modality='endurance'
    and endurance_actual.user_id=active_relationship.client_user_id
    and endurance_actual.client_id=occurrence.linked_completion_client_id
  left join public.coach_training_assignments assignment
    on assignment.client_user_id=active_relationship.client_user_id
    and assignment.occurrence_key=occurrence.occurrence_key
  left join public.coach_session_feedback session_feedback on session_feedback.assignment_id=assignment.id
  where occurrence.user_id=active_relationship.client_user_id
    and occurrence.planned_date between week_start and week_start+6
    and occurrence.status in ('planned','completed','partial','skipped','cancelled','rescheduled')
  order by occurrence.planned_date,coalesce(assignment.day_position,2147483647),occurrence.created_at;
end;$$;

create or replace function public.save_coach_weekly_review_note(
  p_relationship_id uuid,
  p_week_start date,
  p_note text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();active_relationship public.coach_client_relationships;
  expected_week_start date;clean_note text:=trim(coalesce(p_note,''));coach_name text;note_id uuid;
begin
  select * into active_relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=uid and status='active'
    and can_view_planned_sessions and can_view_completed_sessions for update;
  if active_relationship.id is null then raise exception 'Active weekly review permission is required';end if;
  select p_week_start-(((extract(dow from p_week_start)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into expected_week_start from public.profiles profile where profile.id=active_relationship.client_user_id;
  if expected_week_start is distinct from p_week_start then raise exception 'The review date must be the start of the client training week';end if;
  if char_length(clean_note)>3000 then raise exception 'The weekly review note is too long';end if;
  if clean_note='' then
    delete from public.coach_weekly_review_notes
    where relationship_id=active_relationship.id and week_start=p_week_start and coach_user_id=uid;
    return null;
  end if;
  select coalesce(nullif(display_name,''),username,'Setra coach') into coach_name
  from public.profiles where id=uid;
  insert into public.coach_weekly_review_notes(
    relationship_id,coach_user_id,client_user_id,week_start,coach_display_name,note
  ) values(
    active_relationship.id,uid,active_relationship.client_user_id,p_week_start,coach_name,clean_note
  ) on conflict(relationship_id,week_start) do update set
    note=excluded.note,coach_display_name=excluded.coach_display_name,updated_at=now()
  where public.coach_weekly_review_notes.coach_user_id=uid
  returning id into note_id;
  return note_id;
end;$$;

create or replace function public.get_coach_weekly_review_note(
  p_relationship_id uuid,
  p_week_start date
)
returns table(note_id uuid,note text,coach_display_name text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select review.id,review.note,review.coach_display_name,review.created_at,review.updated_at
  from public.coach_weekly_review_notes review
  join public.coach_client_relationships relationship on relationship.id=review.relationship_id
  where review.relationship_id=p_relationship_id and review.week_start=p_week_start
    and relationship.status='active'
    and relationship.coach_user_id=auth.uid()
    and relationship.can_view_planned_sessions
    and relationship.can_view_completed_sessions;
$$;

create or replace function public.list_client_weekly_review_notes()
returns table(note_id uuid,relationship_id uuid,week_start date,note text,coach_display_name text,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select review.id,review.relationship_id,review.week_start,review.note,review.coach_display_name,review.created_at,review.updated_at
  from public.coach_weekly_review_notes review
  where review.client_user_id=auth.uid()
  order by review.week_start desc,review.updated_at desc
  limit 52;
$$;

revoke all on function public.list_coach_week_review_sessions(uuid,date) from public,anon;
revoke all on function public.save_coach_weekly_review_note(uuid,date,text) from public,anon;
revoke all on function public.get_coach_weekly_review_note(uuid,date) from public,anon;
revoke all on function public.list_client_weekly_review_notes() from public,anon;
grant execute on function public.list_coach_week_review_sessions(uuid,date) to authenticated;
grant execute on function public.save_coach_weekly_review_note(uuid,date,text) to authenticated;
grant execute on function public.get_coach_weekly_review_note(uuid,date) to authenticated;
grant execute on function public.list_client_weekly_review_notes() to authenticated;

commit;
