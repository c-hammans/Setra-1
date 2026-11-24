begin;

create table if not exists public.adaptive_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  source_hash text not null check (char_length(source_hash) between 32 and 128),
  review jsonb,
  model_provider text,
  model_name text,
  prompt_version text not null default 'weekly-review-v1',
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  generation_count integer not null default 0 check (generation_count >= 0),
  error_message text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id,week_start),
  check (week_end=week_start+6),
  check (review is null or jsonb_typeof(review)='object')
);

create index if not exists adaptive_weekly_reviews_user_week_idx
  on public.adaptive_weekly_reviews(user_id,week_start desc);

drop trigger if exists adaptive_weekly_reviews_set_updated_at on public.adaptive_weekly_reviews;
create trigger adaptive_weekly_reviews_set_updated_at
  before update on public.adaptive_weekly_reviews
  for each row execute function public.set_updated_at();

alter table public.adaptive_weekly_reviews enable row level security;

drop policy if exists adaptive_weekly_reviews_owner_select on public.adaptive_weekly_reviews;
create policy adaptive_weekly_reviews_owner_select on public.adaptive_weekly_reviews
  for select to authenticated using ((select auth.uid())=user_id);

revoke all on public.adaptive_weekly_reviews from anon,authenticated;
grant select on public.adaptive_weekly_reviews to authenticated;
grant all on public.adaptive_weekly_reviews to service_role;

create or replace function public.claim_adaptive_weekly_review_generation(
  p_user_id uuid,
  p_week_start date,
  p_source_hash text,
  p_force boolean default false
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  inserted_count integer:=0;
  existing public.adaptive_weekly_reviews;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required';end if;
  insert into public.adaptive_weekly_reviews(user_id,week_start,week_end,status,source_hash)
  values(p_user_id,p_week_start,p_week_start+6,'generating',p_source_hash)
  on conflict(user_id,week_start) do nothing;
  get diagnostics inserted_count=row_count;
  if inserted_count>0 then return true;end if;

  select * into existing from public.adaptive_weekly_reviews
  where user_id=p_user_id and week_start=p_week_start for update;

  if existing.status='ready' and existing.source_hash=p_source_hash and not p_force then return false;end if;
  if existing.status='generating' and existing.updated_at>now()-interval '5 minutes' then return false;end if;
  if existing.status='failed' and existing.source_hash=p_source_hash and not p_force then return false;end if;

  update public.adaptive_weekly_reviews set
    status='generating',source_hash=p_source_hash,error_message=null,updated_at=now()
  where id=existing.id;
  return true;
end;
$$;

revoke all on function public.claim_adaptive_weekly_review_generation(uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_adaptive_weekly_review_generation(uuid,date,text,boolean) to service_role;

create or replace function public.get_adaptive_weekly_personal_bests(p_user_id uuid,p_week_start date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required';end if;
  with weekly_strength as (
    select distinct on (exercise.id) exercise.id,exercise.name,set_row.weight,set_row.reps,workout.workout_date
    from public.workouts workout
    join public.workout_exercises workout_exercise on workout_exercise.workout_id=workout.id
    join public.workout_sets set_row on set_row.workout_exercise_id=workout_exercise.id
    join public.exercises exercise on exercise.id=workout_exercise.exercise_id
    where workout.user_id=p_user_id and workout.status='completed' and workout.workout_date between p_week_start and p_week_start+6
      and set_row.completed and set_row.weight>0 and not workout_exercise.skipped
    order by exercise.id,set_row.weight desc,workout.workout_date
  ), strength_pbs as (
    select jsonb_build_object('label',weekly.name,'result',trim(to_char(weekly.weight,'FM999999990.###'))||' kg'||case when nullif(weekly.reps,'') is null then '' else ' × '||weekly.reps end) item
    from weekly_strength weekly
    where weekly.weight>coalesce((select max(previous_set.weight) from public.workouts previous_workout
      join public.workout_exercises previous_exercise on previous_exercise.workout_id=previous_workout.id
      join public.workout_sets previous_set on previous_set.workout_exercise_id=previous_exercise.id
      where previous_workout.user_id=p_user_id and previous_workout.status='completed' and previous_workout.workout_date<p_week_start
        and previous_exercise.exercise_id=weekly.id and previous_set.completed and previous_set.weight>0 and not previous_exercise.skipped),0)
  ), endurance_pbs as (
    select jsonb_build_object('label',case round(session.distance_metres)::integer when 5000 then '5K' when 10000 then '10K' else 'Half marathon' end,
      'result',session.duration_seconds::text||' seconds') item
    from public.training_sessions session
    where session.user_id=p_user_id and session.status='completed' and session.session_date between p_week_start and p_week_start+6
      and session.duration_seconds>0 and round(session.distance_metres)::integer in (5000,10000,21098)
      and session.duration_seconds=(select min(previous.duration_seconds) from public.training_sessions previous
        where previous.user_id=p_user_id and previous.status='completed' and previous.duration_seconds>0
          and round(previous.distance_metres)=round(session.distance_metres) and previous.session_date<=p_week_start+6)
  )
  select coalesce(jsonb_agg(item),'[]'::jsonb) into result from (
    select item from strength_pbs union all select item from endurance_pbs
  ) combined;
  return result;
end;
$$;

revoke all on function public.get_adaptive_weekly_personal_bests(uuid,date) from public,anon,authenticated;
grant execute on function public.get_adaptive_weekly_personal_bests(uuid,date) to service_role;

commit;
