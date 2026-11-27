begin;

create table if not exists public.adaptive_ask_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adaptive_ask_turns (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.adaptive_ask_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_request_id uuid not null,
  question text not null check (char_length(question) between 3 and 500),
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  answer jsonb,
  selected_context jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_context)='object'),
  context_hash text,
  model_provider text,
  model_name text,
  prompt_version text not null default 'ask-setra-v1',
  input_tokens integer check (input_tokens is null or input_tokens>=0),
  output_tokens integer check (output_tokens is null or output_tokens>=0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd>=0),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(user_id,client_request_id),
  check (answer is null or jsonb_typeof(answer)='object')
);

create index if not exists adaptive_ask_threads_user_idx on public.adaptive_ask_threads(user_id,updated_at desc);
create index if not exists adaptive_ask_turns_thread_idx on public.adaptive_ask_turns(thread_id,created_at,id);
create index if not exists adaptive_ask_turns_user_rate_idx on public.adaptive_ask_turns(user_id,created_at desc);

drop trigger if exists adaptive_ask_threads_set_updated_at on public.adaptive_ask_threads;
create trigger adaptive_ask_threads_set_updated_at before update on public.adaptive_ask_threads
  for each row execute function public.set_updated_at();

alter table public.adaptive_ask_threads enable row level security;
alter table public.adaptive_ask_turns enable row level security;

drop policy if exists adaptive_ask_threads_owner_select on public.adaptive_ask_threads;
create policy adaptive_ask_threads_owner_select on public.adaptive_ask_threads for select to authenticated
  using ((select auth.uid())=user_id);
drop policy if exists adaptive_ask_turns_owner_select on public.adaptive_ask_turns;
create policy adaptive_ask_turns_owner_select on public.adaptive_ask_turns for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on public.adaptive_ask_threads,public.adaptive_ask_turns from anon,authenticated;
grant select on public.adaptive_ask_threads,public.adaptive_ask_turns to authenticated;
grant all on public.adaptive_ask_threads,public.adaptive_ask_turns to service_role;

create or replace function public.claim_adaptive_ask_turn(
  p_user_id uuid,
  p_thread_id uuid,
  p_client_request_id uuid,
  p_question text
)
returns table(thread_id uuid,turn_id uuid,should_generate boolean,turn_status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  resolved_thread_id uuid;
  existing_turn public.adaptive_ask_turns;
  created_turn_id uuid;
  clean_question text:=trim(coalesce(p_question,''));
begin
  if auth.role()<>'service_role' then raise exception 'Service role required';end if;
  if char_length(clean_question) not between 3 and 500 then raise exception 'Question must be between 3 and 500 characters';end if;

  select * into existing_turn from public.adaptive_ask_turns
  where user_id=p_user_id and client_request_id=p_client_request_id;
  if found then return query select existing_turn.thread_id,existing_turn.id,false,existing_turn.status;return;end if;

  if (select count(*) from public.adaptive_ask_turns where user_id=p_user_id and created_at>now()-interval '60 seconds')>=4 then
    raise exception 'Ask Setra is taking a short pause. Try again in a minute.';
  end if;
  if (select count(*) from public.adaptive_ask_turns where user_id=p_user_id and created_at>now()-interval '24 hours')>=40 then
    raise exception 'You have reached today''s Ask Setra limit. Try again tomorrow.';
  end if;

  if p_thread_id is null then
    insert into public.adaptive_ask_threads(user_id,title) values(p_user_id,left(clean_question,120)) returning id into resolved_thread_id;
  else
    select id into resolved_thread_id from public.adaptive_ask_threads where id=p_thread_id and user_id=p_user_id;
    if resolved_thread_id is null then raise exception 'That Ask Setra conversation is unavailable';end if;
  end if;

  insert into public.adaptive_ask_turns(thread_id,user_id,client_request_id,question)
  values(resolved_thread_id,p_user_id,p_client_request_id,clean_question) returning id into created_turn_id;
  update public.adaptive_ask_threads set updated_at=now() where id=resolved_thread_id;
  return query select resolved_thread_id,created_turn_id,true,'generating'::text;
end;
$$;

revoke all on function public.claim_adaptive_ask_turn(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_adaptive_ask_turn(uuid,uuid,uuid,text) to service_role;

create or replace function public.get_adaptive_training_bests(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result jsonb;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required';end if;
  with strength_bests as (
    select jsonb_build_object('kind','strength','label',best.exercise_name,'result',trim(to_char(best.weight,'FM999999990.###'))||' kg'||case when nullif(best.reps,'') is null then '' else ' × '||best.reps end,'date',best.workout_date) item
    from (
      select distinct on (exercise.id) exercise.name exercise_name,set_row.weight,set_row.reps,workout.workout_date
      from public.workouts workout
      join public.workout_exercises workout_exercise on workout_exercise.workout_id=workout.id
      join public.workout_sets set_row on set_row.workout_exercise_id=workout_exercise.id
      join public.exercises exercise on exercise.id=workout_exercise.exercise_id
      where workout.user_id=p_user_id and workout.status='completed' and set_row.completed and set_row.weight>0 and not workout_exercise.skipped
      order by exercise.id,set_row.weight desc,workout.workout_date desc
    ) best
  ), endurance_bests as (
    select jsonb_build_object('kind','endurance','label',case best.distance_metres when 5000 then '5K' when 10000 then '10K' else 'Half marathon' end,'result',best.duration_seconds::text||' seconds','date',best.session_date) item
    from (
      select distinct on (round(session.distance_metres)) round(session.distance_metres)::integer distance_metres,session.duration_seconds,session.session_date
      from public.training_sessions session
      where session.user_id=p_user_id and session.status='completed' and session.duration_seconds>0 and round(session.distance_metres)::integer in (5000,10000,21098)
      order by round(session.distance_metres),session.duration_seconds,session.session_date desc
    ) best
  )
  select coalesce(jsonb_agg(item),'[]'::jsonb) into result from (
    select item from strength_bests union all select item from endurance_bests
  ) combined;
  return result;
end;
$$;

revoke all on function public.get_adaptive_training_bests(uuid) from public,anon,authenticated;
grant execute on function public.get_adaptive_training_bests(uuid) to service_role;

commit;
