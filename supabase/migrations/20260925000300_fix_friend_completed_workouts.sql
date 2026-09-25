-- Fix completed-workout friend profiles after the initial social migration.
-- The original UNION attempted to order by a JSON expression at the UNION level,
-- which PostgreSQL rejects when the completed-workout permission is enabled.

create or replace function public.get_friend_profile(p_friend uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  privacy public.friend_privacy_settings;
  override_row public.friend_permission_overrides;
  result jsonb;
  pbs jsonb := '[]'::jsonb;
  endurance_pbs jsonb := '[]'::jsonb;
  recent_workouts jsonb := '[]'::jsonb;
  summary jsonb := '{}'::jsonb;
begin
  if not public.social_are_friends(uid, p_friend) then
    raise exception 'Friend profile is unavailable';
  end if;

  select * into privacy
  from public.friend_privacy_settings
  where user_id = p_friend;

  select * into override_row
  from public.friend_permission_overrides
  where owner_user_id = p_friend and friend_user_id = uid;

  if coalesce(override_row.share_pbs, privacy.share_pbs, false) then
    select coalesce(jsonb_agg(to_jsonb(best) order by best.exercise_name), '[]'::jsonb)
    into pbs
    from (
      select distinct on (we.exercise_id)
        we.exercise_id,
        e.name as exercise_name,
        ws.weight,
        ws.reps,
        w.workout_date
      from public.workouts w
      join public.workout_exercises we on we.workout_id = w.id
      join public.workout_sets ws on ws.workout_exercise_id = we.id
      join public.exercises e on e.id = we.exercise_id
      where w.user_id = p_friend
        and w.status = 'completed'
        and ws.completed
        and ws.weight is not null
        and ws.weight > 0
        and not we.skipped
      order by we.exercise_id, ws.weight desc, w.workout_date asc
    ) best;

    select coalesce(jsonb_agg(to_jsonb(best) order by best.distance_metres), '[]'::jsonb)
    into endurance_pbs
    from (
      select distinct on (round(ts.distance_metres))
        round(ts.distance_metres)::integer as distance_metres,
        ts.activity_type,
        ts.duration_seconds,
        ts.session_date
      from public.training_sessions ts
      where ts.user_id = p_friend
        and ts.status = 'completed'
        and ts.duration_seconds > 0
        and round(ts.distance_metres) in (5000, 10000, 21098)
      order by round(ts.distance_metres), ts.duration_seconds asc, ts.session_date asc
    ) best;
  end if;

  if coalesce(override_row.share_completed_workouts, privacy.share_completed_workouts, false) then
    select coalesce(jsonb_agg(recent.item order by recent.workout_date desc), '[]'::jsonb)
    into recent_workouts
    from (
      select combined.item, combined.workout_date
      from (
        select
          jsonb_build_object(
            'type', 'strength',
            'title', w.name,
            'date', w.workout_date,
            'durationMinutes',
              case
                when w.started_at is null or w.ended_at is null then null
                when w.ended_at >= w.started_at
                  then extract(epoch from (w.ended_at - w.started_at)) / 60
                else (86400 + extract(epoch from (w.ended_at - w.started_at))) / 60
              end
          ) as item,
          w.workout_date
        from public.workouts w
        where w.user_id = p_friend and w.status = 'completed'

        union all

        select
          jsonb_build_object(
            'type', 'endurance',
            'title', ts.title,
            'date', ts.session_date,
            'activityType', ts.activity_type,
            'durationMinutes', ts.duration_seconds / 60.0,
            'distanceKm', ts.distance_metres / 1000.0
          ) as item,
          ts.session_date as workout_date
        from public.training_sessions ts
        where ts.user_id = p_friend and ts.status = 'completed'
      ) combined
      order by combined.workout_date desc
      limit 10
    ) recent;
  end if;

  if coalesce(override_row.share_training_summary, privacy.share_training_summary, false) then
    select jsonb_build_object(
      'strengthSessions', (
        select count(*)
        from public.workouts
        where user_id = p_friend and status = 'completed' and workout_date >= current_date - 6
      ),
      'enduranceSessions', (
        select count(*)
        from public.training_sessions
        where user_id = p_friend and status = 'completed' and session_date >= current_date - 6
      ),
      'trainingMinutes', coalesce((
        select sum(duration_seconds) / 60.0
        from public.training_sessions
        where user_id = p_friend and status = 'completed' and session_date >= current_date - 6
      ), 0)
    ) into summary;
  end if;

  select jsonb_build_object(
    'userId', p.id,
    'username', p.username,
    'displayName', coalesce(p.display_name, p.username),
    'avatarUrl', p.avatar_url,
    'permissions', jsonb_build_object(
      'pbs', coalesce(override_row.share_pbs, privacy.share_pbs, false),
      'completedWorkouts', coalesce(override_row.share_completed_workouts, privacy.share_completed_workouts, false),
      'trainingSummary', coalesce(override_row.share_training_summary, privacy.share_training_summary, false)
    ),
    'strengthPbs', pbs,
    'endurancePbs', endurance_pbs,
    'recentWorkouts', recent_workouts,
    'trainingSummary', summary
  )
  into result
  from public.profiles p
  where p.id = p_friend;

  return result;
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
