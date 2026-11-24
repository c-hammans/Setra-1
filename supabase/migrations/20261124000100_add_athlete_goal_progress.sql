begin;

drop function if exists public.list_athlete_goals(uuid);

create function public.list_athlete_goals(p_relationship_id uuid default null)
returns table(
  goal_id uuid,client_user_id uuid,relationship_id uuid,title text,goal_type text,target_date date,
  metric_type text,target_value numeric,target_unit text,target_label text,target_distance_metres numeric,target_text text,
  notes text,is_primary boolean,status text,approval_status text,created_by_role text,creator_name text,
  current_value numeric,previous_value numeric,current_value_date date,recent_data_count bigint,goal_reached boolean,
  linked_programs jsonb,created_at timestamptz,updated_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();client_id uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_relationship_id is null then client_id:=uid;
  else
    select relationship.client_user_id into client_id from public.coach_client_relationships relationship
    where relationship.id=p_relationship_id and relationship.coach_user_id=uid and relationship.status='active'
      and relationship.can_view_planned_sessions and relationship.can_view_completed_sessions;
    if client_id is null then raise exception 'Active client permission is required';end if;
  end if;

  return query
  select goal.id,goal.client_user_id,goal.relationship_id,goal.title,goal.goal_type,goal.target_date,
    goal.metric_type,goal.target_value,goal.target_unit,goal.target_label,goal.target_distance_metres,goal.target_text,
    goal.notes,goal.is_primary,goal.status,goal.approval_status,goal.created_by_role,
    coalesce(nullif(creator.display_name,''),creator.username,'Setra user'),
    current_metric.metric_value,previous_metric.metric_value,current_metric.metric_date,
    case
      when goal.metric_type='strength_load' then (select count(distinct workout.id) from public.workout_sets set_row
        join public.workout_exercises workout_exercise on workout_exercise.id=set_row.workout_exercise_id
        join public.exercises exercise on exercise.id=workout_exercise.exercise_id
        join public.workouts workout on workout.id=workout_exercise.workout_id
        where workout.user_id=goal.client_user_id and workout.status='completed' and set_row.completed
          and not workout_exercise.skipped and set_row.weight is not null and lower(exercise.name)=lower(goal.target_label)
          and workout.workout_date>=current_date-42)
      when goal.metric_type in ('event_time','distance','duration') then (select count(*) from public.training_sessions session
        where session.user_id=goal.client_user_id and session.status='completed' and session.session_date>=current_date-42
          and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
            or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row'))
          and (goal.metric_type<>'event_time' or (session.duration_seconds is not null and session.distance_metres between goal.target_distance_metres*.98 and goal.target_distance_metres*1.02))
          and (goal.metric_type<>'distance' or session.distance_metres is not null)
          and (goal.metric_type<>'duration' or session.duration_seconds is not null))
      else 0
    end,
    case when current_metric.metric_value is null or goal.target_value is null then false
      when goal.metric_type='event_time' then current_metric.metric_value<=goal.target_value
      when goal.metric_type in ('strength_load','distance','duration') then current_metric.metric_value>=goal.target_value
      else false end,
    coalesce((select jsonb_agg(jsonb_build_object('id',program.id,'name',program.name,'status',program.status))
      from public.client_program_goals link join public.client_programs program on program.id=link.client_program_id
      where link.goal_id=goal.id),'[]'::jsonb),goal.created_at,goal.updated_at
  from public.athlete_goals goal
  left join public.profiles creator on creator.id=goal.created_by_user_id
  left join lateral (
    (select set_row.weight::numeric as metric_value,workout.workout_date as metric_date
      from public.workout_sets set_row join public.workout_exercises workout_exercise on workout_exercise.id=set_row.workout_exercise_id
      join public.exercises exercise on exercise.id=workout_exercise.exercise_id join public.workouts workout on workout.id=workout_exercise.workout_id
      where goal.metric_type='strength_load' and workout.user_id=goal.client_user_id and workout.status='completed' and set_row.completed
        and not workout_exercise.skipped and set_row.weight is not null and lower(exercise.name)=lower(goal.target_label)
      order by set_row.weight desc,workout.workout_date desc limit 1)
    union all
    (select session.duration_seconds::numeric,session.session_date from public.training_sessions session
      where goal.metric_type='event_time' and session.user_id=goal.client_user_id and session.status='completed' and session.duration_seconds is not null
        and session.distance_metres between goal.target_distance_metres*.98 and goal.target_distance_metres*1.02
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row'))
      order by session.duration_seconds,session.session_date desc limit 1)
    union all
    (select session.distance_metres::numeric,session.session_date from public.training_sessions session
      where goal.metric_type='distance' and session.user_id=goal.client_user_id and session.status='completed' and session.distance_metres is not null
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row'))
      order by session.distance_metres desc,session.session_date desc limit 1)
    union all
    (select session.duration_seconds::numeric,session.session_date from public.training_sessions session
      where goal.metric_type='duration' and session.user_id=goal.client_user_id and session.status='completed' and session.duration_seconds is not null
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row'))
      order by session.duration_seconds desc,session.session_date desc limit 1)
  ) current_metric on true
  left join lateral (
    (select max(set_row.weight)::numeric as metric_value from public.workout_sets set_row
      join public.workout_exercises workout_exercise on workout_exercise.id=set_row.workout_exercise_id
      join public.exercises exercise on exercise.id=workout_exercise.exercise_id join public.workouts workout on workout.id=workout_exercise.workout_id
      where goal.metric_type='strength_load' and workout.user_id=goal.client_user_id and workout.status='completed' and set_row.completed
        and not workout_exercise.skipped and lower(exercise.name)=lower(goal.target_label) and workout.workout_date<current_date-28
      having count(*)>0)
    union all
    (select min(session.duration_seconds)::numeric from public.training_sessions session
      where goal.metric_type='event_time' and session.user_id=goal.client_user_id and session.status='completed'
        and session.session_date<current_date-28 and session.distance_metres between goal.target_distance_metres*.98 and goal.target_distance_metres*1.02
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row')) having count(*)>0)
    union all
    (select max(session.distance_metres)::numeric from public.training_sessions session
      where goal.metric_type='distance' and session.user_id=goal.client_user_id and session.status='completed' and session.session_date<current_date-28
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row')) having count(*)>0)
    union all
    (select max(session.duration_seconds)::numeric from public.training_sessions session
      where goal.metric_type='duration' and session.user_id=goal.client_user_id and session.status='completed' and session.session_date<current_date-28
        and ((goal.goal_type='running' and session.activity_type='run') or (goal.goal_type='cycling' and session.activity_type='bike')
          or (goal.goal_type='swimming' and session.activity_type='swim') or (goal.goal_type='rowing' and session.activity_type='row')) having count(*)>0)
  ) previous_metric on true
  where goal.client_user_id=client_id
  order by case when goal.is_primary and goal.status='active' and goal.approval_status='accepted' then 0 else 1 end,
    case goal.status when 'active' then 0 when 'completed' then 1 else 2 end,goal.updated_at desc;
end;$$;

revoke all on function public.list_athlete_goals(uuid) from public,anon;
grant execute on function public.list_athlete_goals(uuid) to authenticated;

create or replace function public.list_coach_goal_attention(p_anchor date default current_date)
returns table(
  relationship_id uuid,client_user_id uuid,username text,display_name text,avatar_url text,
  occurrence_id uuid,assignment_id uuid,session_title text,session_date date,status text,reasons text[],
  session_rpe numeric,session_feel text,athlete_comment text
)
language sql stable security definer set search_path='' as $$
  select relationship.id,relationship.client_user_id,profile.username,
    coalesce(nullif(profile.display_name,''),profile.username,'Setra athlete'),profile.avatar_url,
    null::uuid,null::uuid,goal.title,goal.target_date,'goal'::text,
    array_remove(array[
      case when goal.goal_reached then 'goal_reached' end,
      case when not goal.goal_reached and goal.target_date between p_anchor and p_anchor+28 then 'goal_target_approaching' end,
      case when goal.metric_type in ('strength_load','event_time','distance','duration') and goal.recent_data_count=0
        and goal.target_date between p_anchor and p_anchor+28 then 'goal_limited_data' end
    ]::text[],null),null::numeric,null::text,null::text
  from public.coach_client_relationships relationship
  join public.profiles profile on profile.id=relationship.client_user_id
  cross join lateral public.list_athlete_goals(relationship.id) goal
  where relationship.coach_user_id=auth.uid() and relationship.status='active'
    and goal.status='active' and goal.approval_status='accepted'
    and (goal.goal_reached or goal.target_date between p_anchor and p_anchor+28)
  order by goal.target_date nulls last,profile.display_name,goal.title;
$$;

revoke all on function public.list_coach_goal_attention(date) from public,anon;
grant execute on function public.list_coach_goal_attention(date) to authenticated;

commit;
