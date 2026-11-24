begin;

create or replace function public.list_client_coaching_week(p_anchor date default current_date)
returns table(
  relationship_id uuid,
  relationship_status text,
  coach_name text,
  occurrence_id uuid,
  assignment_id uuid,
  client_program_id uuid,
  program_name text,
  program_week_number smallint,
  program_duration_weeks smallint,
  planned_date date,
  modality text,
  status text,
  title text,
  linked_completion_client_id text,
  coach_feedback text,
  coach_feedback_updated_at timestamptz,
  session_rpe numeric,
  session_feel text,
  athlete_comment text,
  week_start date,
  week_end date
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();configured_week_start date;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into configured_week_start from public.profiles profile where profile.id=uid;
  return query
  select
    relationship.id,relationship.status,assignment.coach_display_name,
    occurrence.id,assignment.id,assignment.client_program_id,program.name,
    assignment.program_week_number,program.duration_weeks,
    occurrence.planned_date,occurrence.modality,occurrence.status,
    assignment.source_template_name,occurrence.linked_completion_client_id,
    feedback.feedback,feedback.updated_at,
    coalesce(checkin.session_rpe,endurance_actual.completed_rpe)::numeric,
    checkin.session_feel,checkin.athlete_comment,
    configured_week_start,configured_week_start+6
  from public.coach_training_assignments assignment
  join public.coach_client_relationships relationship on relationship.id=assignment.relationship_id
  join public.training_plan_occurrences occurrence
    on occurrence.user_id=uid and occurrence.occurrence_key=assignment.occurrence_key
  left join public.client_programs program on program.id=assignment.client_program_id
  left join public.coach_session_feedback feedback on feedback.assignment_id=assignment.id
  left join public.athlete_session_checkins checkin
    on checkin.user_id=uid and checkin.modality=assignment.modality
    and checkin.completed_client_id=occurrence.linked_completion_client_id
  left join public.training_sessions endurance_actual
    on assignment.modality='endurance' and endurance_actual.user_id=uid
    and endurance_actual.client_id=occurrence.linked_completion_client_id
  where assignment.client_user_id=uid
    and occurrence.planned_date between configured_week_start and configured_week_start+6
  order by occurrence.planned_date,coalesce(assignment.day_position,2147483647),assignment.created_at;
end;$$;

create or replace function public.list_client_program_progress(p_anchor date default current_date)
returns table(
  client_program_id uuid,
  relationship_id uuid,
  relationship_status text,
  coach_name text,
  name text,
  description text,
  focus text,
  duration_weeks smallint,
  start_date date,
  end_date date,
  status text,
  note text,
  current_week integer,
  total_sessions bigint,
  completed_sessions bigint,
  remaining_sessions bigint
)
language sql stable security definer set search_path='' as $$
  select
    program.id,program.relationship_id,relationship.status,
    coalesce(nullif(profile.display_name,''),profile.username,'Setra coach'),
    program.name,program.description,program.focus,program.duration_weeks,
    program.start_date,program.end_date,
    case
      when program.status='active' and p_anchor>program.end_date
        and count(assignment.id) filter(where occurrence.status='planned')=0 then 'completed'
      else program.status
    end,
    program.note,
    least(program.duration_weeks::integer,greatest(1,((p_anchor-program.start_date)/7)+1)),
    count(assignment.id),
    count(assignment.id) filter(where occurrence.status in ('completed','partial')),
    count(assignment.id) filter(where occurrence.status='planned')
  from public.client_programs program
  join public.coach_client_relationships relationship on relationship.id=program.relationship_id
  join public.profiles profile on profile.id=program.coach_user_id
  left join public.coach_training_assignments assignment on assignment.client_program_id=program.id
  left join public.training_plan_occurrences occurrence
    on occurrence.user_id=program.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
  where program.client_user_id=auth.uid()
  group by program.id,relationship.status,profile.display_name,profile.username
  order by case program.status when 'active' then 0 when 'completed' then 1 else 2 end,program.start_date desc;
$$;

revoke all on function public.list_client_coaching_week(date) from public,anon;
revoke all on function public.list_client_program_progress(date) from public,anon;
grant execute on function public.list_client_coaching_week(date) to authenticated;
grant execute on function public.list_client_program_progress(date) to authenticated;

commit;
