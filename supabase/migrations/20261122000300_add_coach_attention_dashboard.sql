begin;

create or replace function public.list_coach_clients_dashboard(p_anchor date default current_date)
returns table(
  relationship_id uuid,
  client_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  week_start date,
  planned_sessions bigint,
  completed_sessions bigint,
  next_session_title text,
  next_session_date date,
  permissions_ready boolean,
  latest_completed_title text,
  latest_completed_date date,
  latest_rpe numeric,
  latest_session_feel text,
  latest_athlete_comment text,
  latest_feedback_date timestamptz
)
language sql stable security definer set search_path='' as $$
  with clients as (
    select relationship.*,
      profile.username,
      coalesce(nullif(profile.display_name,''),profile.username,'Setra athlete') as display_name,
      profile.avatar_url,
      p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7)) as week_start
    from public.coach_client_relationships relationship
    join public.profiles profile on profile.id=relationship.client_user_id
    where relationship.coach_user_id=auth.uid() and relationship.status='active'
  )
  select clients.id,clients.client_user_id,clients.username,clients.display_name,clients.avatar_url,clients.week_start,
    case when clients.can_view_planned_sessions then coalesce(week_totals.planned_sessions,0) else 0 end,
    case when clients.can_view_completed_sessions then coalesce(week_totals.completed_sessions,0) else 0 end,
    case when clients.can_view_planned_sessions then next_item.title end,
    case when clients.can_view_planned_sessions then next_item.planned_date end,
    clients.can_view_planned_sessions and clients.can_view_completed_sessions and clients.can_assign_training,
    case when clients.can_view_completed_sessions then recent_completion.title end,
    case when clients.can_view_completed_sessions then recent_completion.planned_date end,
    case when clients.can_view_completed_sessions then recent_feedback.session_rpe end,
    case when clients.can_view_completed_sessions then recent_feedback.session_feel end,
    case when clients.can_view_completed_sessions then recent_feedback.athlete_comment end,
    case when clients.can_view_completed_sessions then recent_feedback.feedback_date end
  from clients
  left join lateral (
    select
      count(*) filter(where occurrence.status in ('planned','completed','partial','skipped')) as planned_sessions,
      count(*) filter(where occurrence.status in ('completed','partial')) as completed_sessions
    from public.training_plan_occurrences occurrence
    where occurrence.user_id=clients.client_user_id
      and occurrence.planned_date between clients.week_start and clients.week_start+6
  ) week_totals on true
  left join lateral (
    select occurrence.planned_date,coalesce(strength.name,endurance.title,'Planned session') as title
    from public.training_plan_occurrences occurrence
    left join public.workout_templates strength on occurrence.modality='strength' and strength.user_id=clients.client_user_id and strength.client_id=occurrence.source_client_id
    left join public.training_sessions endurance on occurrence.modality='endurance' and endurance.user_id=clients.client_user_id and endurance.client_id=occurrence.source_client_id
    where occurrence.user_id=clients.client_user_id and occurrence.status='planned' and occurrence.planned_date>=p_anchor
    order by occurrence.planned_date,occurrence.created_at limit 1
  ) next_item on true
  left join lateral (
    select occurrence.planned_date,coalesce(strength.name,endurance.title,actual_strength.name,'Completed session') as title
    from public.training_plan_occurrences occurrence
    left join public.workout_templates strength on occurrence.modality='strength' and strength.user_id=clients.client_user_id and strength.client_id=occurrence.source_client_id
    left join public.training_sessions endurance on occurrence.modality='endurance' and endurance.user_id=clients.client_user_id and endurance.client_id=occurrence.source_client_id
    left join public.workouts actual_strength on occurrence.modality='strength' and actual_strength.user_id=clients.client_user_id and actual_strength.client_id=occurrence.linked_completion_client_id
    where occurrence.user_id=clients.client_user_id and occurrence.status in ('completed','partial')
    order by occurrence.planned_date desc,occurrence.completed_at desc nulls last limit 1
  ) recent_completion on true
  left join lateral (
    select
      case when occurrence.modality='endurance' then actual_endurance.completed_rpe else checkin.session_rpe end as session_rpe,
      checkin.session_feel,
      nullif(checkin.athlete_comment,'') as athlete_comment,
      coalesce(checkin.updated_at,actual_endurance.updated_at) as feedback_date
    from public.training_plan_occurrences occurrence
    left join public.athlete_session_checkins checkin
      on checkin.user_id=clients.client_user_id
      and checkin.modality=occurrence.modality
      and checkin.completed_client_id=occurrence.linked_completion_client_id
    left join public.training_sessions actual_endurance
      on occurrence.modality='endurance'
      and actual_endurance.user_id=clients.client_user_id
      and actual_endurance.client_id=occurrence.linked_completion_client_id
    where occurrence.user_id=clients.client_user_id
      and occurrence.planned_date between clients.week_start and clients.week_start+6
      and occurrence.status in ('completed','partial')
      and (checkin.id is not null or actual_endurance.completed_rpe is not null)
    order by coalesce(checkin.updated_at,actual_endurance.updated_at) desc nulls last limit 1
  ) recent_feedback on true
  order by clients.display_name;
$$;

create or replace function public.list_coach_attention_queue(
  p_anchor date default current_date,
  p_high_rpe numeric default 9,
  p_inactivity_days integer default 14
)
returns table(
  relationship_id uuid,
  client_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  occurrence_id uuid,
  assignment_id uuid,
  session_title text,
  session_date date,
  status text,
  reasons text[],
  session_rpe numeric,
  session_feel text,
  athlete_comment text
)
language sql stable security definer set search_path='' as $$
  with clients as (
    select relationship.*,
      profile.username,
      coalesce(nullif(profile.display_name,''),profile.username,'Setra athlete') as display_name,
      profile.avatar_url,
      p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7)) as week_start
    from public.coach_client_relationships relationship
    join public.profiles profile on profile.id=relationship.client_user_id
    where relationship.coach_user_id=auth.uid() and relationship.status='active'
  ), current_week as (
    select clients.*,
      occurrence.id as occurrence_id,
      occurrence.planned_date,
      occurrence.status as occurrence_status,
      coalesce(strength.name,endurance.title,actual_strength.name,'Training session') as title,
      assignment.id as assignment_id,
      feedback.id as coach_feedback_id,
      case when occurrence.modality='endurance' then actual_endurance.completed_rpe else checkin.session_rpe end as session_rpe,
      checkin.session_feel,
      nullif(checkin.athlete_comment,'') as athlete_comment,
      checkin.id as checkin_id
    from clients
    join public.training_plan_occurrences occurrence
      on occurrence.user_id=clients.client_user_id
      and occurrence.planned_date between clients.week_start and clients.week_start+6
    left join public.workout_templates strength on occurrence.modality='strength' and strength.user_id=clients.client_user_id and strength.client_id=occurrence.source_client_id
    left join public.training_sessions endurance on occurrence.modality='endurance' and endurance.user_id=clients.client_user_id and endurance.client_id=occurrence.source_client_id
    left join public.workouts actual_strength on occurrence.modality='strength' and actual_strength.user_id=clients.client_user_id and actual_strength.client_id=occurrence.linked_completion_client_id
    left join public.training_sessions actual_endurance on occurrence.modality='endurance' and actual_endurance.user_id=clients.client_user_id and actual_endurance.client_id=occurrence.linked_completion_client_id
    left join public.athlete_session_checkins checkin
      on checkin.user_id=clients.client_user_id
      and checkin.modality=occurrence.modality
      and checkin.completed_client_id=occurrence.linked_completion_client_id
    left join public.coach_training_assignments assignment
      on assignment.relationship_id=clients.id
      and assignment.client_user_id=clients.client_user_id
      and assignment.occurrence_key=occurrence.occurrence_key
    left join public.coach_session_feedback feedback on feedback.assignment_id=assignment.id
  ), session_items as (
    select current_week.*,
      array_remove(array[
        case when current_week.can_view_planned_sessions and current_week.occurrence_status='planned' and current_week.planned_date<p_anchor then 'session_overdue' end,
        case when current_week.can_view_completed_sessions and current_week.occurrence_status in ('completed','partial') and current_week.session_feel='harder' then 'harder_than_expected' end,
        case when current_week.can_view_completed_sessions and current_week.occurrence_status in ('completed','partial') and current_week.session_rpe>=p_high_rpe then 'high_rpe' end,
        case when current_week.can_view_completed_sessions and current_week.can_provide_feedback and current_week.occurrence_status in ('completed','partial') and current_week.assignment_id is not null and (current_week.checkin_id is not null or current_week.session_rpe is not null) and current_week.coach_feedback_id is null then 'awaiting_coach_review' end
      ]::text[],null) as item_reasons
    from current_week
  ), inactivity_items as (
    select clients.*,
      due.id as occurrence_id,
      due.planned_date,
      due.status as occurrence_status,
      coalesce(due_strength.name,due_endurance.title,'Planned training') as title,
      due_assignment.id as assignment_id,
      null::numeric as session_rpe,
      null::text as session_feel,
      null::text as athlete_comment,
      array['no_recent_session']::text[] as item_reasons
    from clients
    join lateral (
      select occurrence.*
      from public.training_plan_occurrences occurrence
      where occurrence.user_id=clients.client_user_id
        and occurrence.status='planned'
        and occurrence.planned_date between clients.week_start and least(clients.week_start+6,p_anchor)
      order by occurrence.planned_date,occurrence.created_at limit 1
    ) due on true
    left join public.workout_templates due_strength on due.modality='strength' and due_strength.user_id=clients.client_user_id and due_strength.client_id=due.source_client_id
    left join public.training_sessions due_endurance on due.modality='endurance' and due_endurance.user_id=clients.client_user_id and due_endurance.client_id=due.source_client_id
    left join public.coach_training_assignments due_assignment on due_assignment.relationship_id=clients.id and due_assignment.occurrence_key=due.occurrence_key
    where clients.can_view_planned_sessions and clients.can_view_completed_sessions
      and not exists(
        select 1 from public.training_plan_occurrences completed
        where completed.user_id=clients.client_user_id
          and completed.status in ('completed','partial')
          and completed.planned_date>=p_anchor-greatest(p_inactivity_days,1)
      )
  )
  select item.relationship_id,item.client_user_id,item.username,item.display_name,item.avatar_url,
    item.occurrence_id,item.assignment_id,item.title,item.planned_date,item.occurrence_status,item.item_reasons,
    item.session_rpe,item.session_feel,item.athlete_comment
  from (
    select session_items.id as relationship_id,session_items.client_user_id,session_items.username,session_items.display_name,session_items.avatar_url,
      session_items.occurrence_id,session_items.assignment_id,session_items.title,session_items.planned_date,session_items.occurrence_status,session_items.item_reasons,
      session_items.session_rpe,session_items.session_feel,session_items.athlete_comment
    from session_items where cardinality(session_items.item_reasons)>0
    union all
    select inactivity_items.id,inactivity_items.client_user_id,inactivity_items.username,inactivity_items.display_name,inactivity_items.avatar_url,
      inactivity_items.occurrence_id,inactivity_items.assignment_id,inactivity_items.title,inactivity_items.planned_date,inactivity_items.occurrence_status,inactivity_items.item_reasons,
      inactivity_items.session_rpe,inactivity_items.session_feel,inactivity_items.athlete_comment
    from inactivity_items
  ) item
  order by item.planned_date nulls last,item.display_name,item.title;
$$;

revoke all on function public.list_coach_clients_dashboard(date) from public,anon;
revoke all on function public.list_coach_attention_queue(date,numeric,integer) from public,anon;
grant execute on function public.list_coach_clients_dashboard(date) to authenticated;
grant execute on function public.list_coach_attention_queue(date,numeric,integer) to authenticated;

commit;
