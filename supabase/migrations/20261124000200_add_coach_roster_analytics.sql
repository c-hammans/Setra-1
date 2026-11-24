begin;

create or replace function public.list_coach_roster_analytics(p_anchor date default current_date,p_weeks integer default 4)
returns table(
  relationship_id uuid,client_user_id uuid,username text,display_name text,avatar_url text,
  week_start date,current_planned bigint,current_completed bigint,period_planned bigint,period_completed bigint,
  total_training_seconds bigint,strength_sessions bigint,endurance_sessions bigint,
  latest_completed_title text,latest_completed_date date,latest_rpe numeric,latest_session_feel text,
  active_program_id uuid,active_program_name text,program_current_week integer,program_duration_weeks integer,
  primary_goal_id uuid,primary_goal_title text,primary_goal_current numeric,primary_goal_target numeric,
  primary_goal_metric text,primary_goal_unit text,primary_goal_reached boolean,active_goal_count bigint,
  group_ids uuid[],group_names text[],attention_count bigint,weekly_trend jsonb
)
language sql stable security definer set search_path='' as $$
  with requested as (select greatest(1,least(coalesce(p_weeks,4),52)) as weeks),
  dashboard as (select * from public.list_coach_clients_dashboard(p_anchor)),
  authorised as (
    select dashboard.*,relationship.can_view_planned_sessions,relationship.can_view_completed_sessions
    from dashboard join public.coach_client_relationships relationship on relationship.id=dashboard.relationship_id
    where relationship.coach_user_id=auth.uid() and relationship.status='active'
      and relationship.can_view_planned_sessions and relationship.can_view_completed_sessions
  )
  select client.relationship_id,client.client_user_id,client.username,client.display_name,client.avatar_url,
    client.week_start,client.planned_sessions,client.completed_sessions,
    coalesce(period.planned,0),coalesce(period.completed,0),coalesce(training.duration_seconds,0),
    coalesce(training.strength_sessions,0),coalesce(training.endurance_sessions,0),
    client.latest_completed_title,client.latest_completed_date,client.latest_rpe,client.latest_session_feel,
    program.id,program.name,program.current_week,program.duration_weeks,
    goal.goal_id,goal.title,goal.current_value,goal.target_value,goal.metric_type,goal.target_unit,coalesce(goal.goal_reached,false),coalesce(goal_count.value,0),
    coalesce(groups.ids,'{}'::uuid[]),coalesce(groups.names,'{}'::text[]),0::bigint,coalesce(trend.items,'[]'::jsonb)
  from authorised client cross join requested
  left join lateral (
    select count(*) filter(where occurrence.status in ('planned','completed','partial','skipped'))::bigint as planned,
      count(*) filter(where occurrence.status in ('completed','partial'))::bigint as completed
    from public.training_plan_occurrences occurrence
    where occurrence.user_id=client.client_user_id
      and occurrence.planned_date between client.week_start-(requested.weeks-1)*7 and client.week_start+6
  ) period on true
  left join lateral (
    select coalesce(sum(session.duration_seconds),0)::bigint as duration_seconds,
      count(*) filter(where session.modality='strength')::bigint as strength_sessions,
      count(*) filter(where session.modality='endurance')::bigint as endurance_sessions
    from public.training_sessions session
    where session.user_id=client.client_user_id and session.status='completed'
      and session.session_date between client.week_start-(requested.weeks-1)*7 and client.week_start+6
  ) training on true
  left join lateral (
    select instance.id,instance.name,
      least(instance.duration_weeks,greatest(1,((p_anchor-instance.start_date)/7)+1))::integer as current_week,
      instance.duration_weeks
    from public.client_programs instance
    where instance.relationship_id=client.relationship_id and instance.coach_user_id=auth.uid() and instance.status='active'
      and p_anchor between instance.start_date and instance.end_date
    order by instance.start_date desc limit 1
  ) program on true
  left join lateral (
    select listed.goal_id,listed.title,listed.current_value,listed.target_value,listed.metric_type,listed.target_unit,listed.goal_reached
    from public.list_athlete_goals(client.relationship_id) listed
    where listed.status='active' and listed.approval_status='accepted' and listed.is_primary
    order by listed.updated_at desc limit 1
  ) goal on true
  left join lateral (
    select count(*)::bigint as value from public.athlete_goals athlete_goal
    where athlete_goal.client_user_id=client.client_user_id and athlete_goal.status='active' and athlete_goal.approval_status='accepted'
  ) goal_count on true
  left join lateral (
    select array_agg(coach_group.id order by coach_group.name) as ids,array_agg(coach_group.name order by coach_group.name) as names
    from public.coach_group_members member join public.coach_groups coach_group on coach_group.id=member.group_id
    where member.relationship_id=client.relationship_id and coach_group.coach_user_id=auth.uid() and coach_group.archived_at is null
  ) groups on true
  left join lateral (
    select jsonb_agg(jsonb_build_object('weekStart',week.week_start,'planned',week.planned,'completed',week.completed) order by week.week_start) as items
    from (
      select series.week_start,
        count(occurrence.id) filter(where occurrence.status in ('planned','completed','partial','skipped'))::integer as planned,
        count(occurrence.id) filter(where occurrence.status in ('completed','partial'))::integer as completed
      from generate_series(client.week_start-(requested.weeks-1)*7,client.week_start,'7 days'::interval) generated
      cross join lateral (select generated::date as week_start) series
      left join public.training_plan_occurrences occurrence on occurrence.user_id=client.client_user_id
        and occurrence.planned_date between series.week_start and series.week_start+6
      group by series.week_start
    ) week
  ) trend on true
  order by client.display_name;
$$;

revoke all on function public.list_coach_roster_analytics(date,integer) from public,anon;
grant execute on function public.list_coach_roster_analytics(date,integer) to authenticated;

commit;
