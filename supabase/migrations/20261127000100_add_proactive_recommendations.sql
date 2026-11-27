begin;

create table if not exists public.adaptive_recommendation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_hash text not null check (char_length(source_hash) between 32 and 128),
  trigger_source text not null check (trigger_source in ('weekly_review','training_change','manual')),
  status text not null default 'generating' check (status in ('generating','ready','failed')),
  model_provider text,
  model_name text,
  prompt_version text not null default 'proactive-recommendations-v1',
  input_tokens integer check (input_tokens is null or input_tokens>=0),
  output_tokens integer check (output_tokens is null or output_tokens>=0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd>=0),
  generation_count integer not null default 1 check (generation_count between 1 and 2),
  error_message text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,source_hash)
);

create table if not exists public.adaptive_training_recommendations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.adaptive_recommendation_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_key text not null check (char_length(candidate_key) between 1 and 160),
  recommendation_type text not null check (recommendation_type in ('progress','maintain','reduce','schedule','goal','recovery_consideration')),
  title text not null check (char_length(title) between 1 and 100),
  recommendation text not null check (char_length(recommendation) between 1 and 500),
  evidence jsonb not null check (jsonb_typeof(evidence)='array'),
  confidence text not null check (confidence in ('high','medium')),
  source_hash text not null check (char_length(source_hash) between 32 and 128),
  related_session_id text,
  related_goal_id uuid,
  status text not null default 'active' check (status in ('active','dismissed','outdated')),
  dismissed_at timestamptz,
  outdated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,source_hash,candidate_key)
);

create index if not exists adaptive_recommendation_runs_user_idx on public.adaptive_recommendation_runs(user_id,created_at desc);
create index if not exists adaptive_training_recommendations_user_status_idx on public.adaptive_training_recommendations(user_id,status,created_at desc);

drop trigger if exists adaptive_recommendation_runs_set_updated_at on public.adaptive_recommendation_runs;
create trigger adaptive_recommendation_runs_set_updated_at before update on public.adaptive_recommendation_runs for each row execute function public.set_updated_at();
drop trigger if exists adaptive_training_recommendations_set_updated_at on public.adaptive_training_recommendations;
create trigger adaptive_training_recommendations_set_updated_at before update on public.adaptive_training_recommendations for each row execute function public.set_updated_at();

alter table public.adaptive_recommendation_runs enable row level security;
alter table public.adaptive_training_recommendations enable row level security;

drop policy if exists adaptive_recommendation_runs_owner_select on public.adaptive_recommendation_runs;
create policy adaptive_recommendation_runs_owner_select on public.adaptive_recommendation_runs for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists adaptive_training_recommendations_owner_select on public.adaptive_training_recommendations;
create policy adaptive_training_recommendations_owner_select on public.adaptive_training_recommendations for select to authenticated using ((select auth.uid())=user_id);

revoke all on public.adaptive_recommendation_runs,public.adaptive_training_recommendations from anon,authenticated;
grant select on public.adaptive_recommendation_runs,public.adaptive_training_recommendations to authenticated;
grant all on public.adaptive_recommendation_runs,public.adaptive_training_recommendations to service_role;

create or replace function public.claim_adaptive_recommendation_run(p_user_id uuid,p_source_hash text,p_trigger text)
returns table(run_id uuid,should_generate boolean,run_status text)
language plpgsql
security definer
set search_path=''
as $$
declare existing public.adaptive_recommendation_runs;created_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Service role required';end if;
  if char_length(p_source_hash) not between 32 and 128 then raise exception 'Invalid recommendation source';end if;
  if p_trigger not in ('weekly_review','training_change','manual') then raise exception 'Invalid recommendation trigger';end if;

  select * into existing from public.adaptive_recommendation_runs where user_id=p_user_id and source_hash=p_source_hash for update;
  if found then
    if existing.status='ready' or (existing.status='generating' and existing.updated_at>now()-interval '5 minutes') or existing.generation_count>=2 then
      return query select existing.id,false,existing.status;return;
    end if;
    update public.adaptive_recommendation_runs set status='generating',trigger_source=p_trigger,generation_count=generation_count+1,error_message=null,completed_at=null,updated_at=now() where id=existing.id;
    return query select existing.id,true,'generating'::text;return;
  end if;

  if (select count(*) from public.adaptive_recommendation_runs where user_id=p_user_id and created_at>now()-interval '5 minutes')>=2 then raise exception 'Recommendations are taking a short pause. Try again in a few minutes.';end if;
  if (select count(*) from public.adaptive_recommendation_runs where user_id=p_user_id and created_at>now()-interval '24 hours')>=6 then raise exception 'You have reached the daily recommendation limit. Try again tomorrow.';end if;

  insert into public.adaptive_recommendation_runs(user_id,source_hash,trigger_source) values(p_user_id,p_source_hash,p_trigger) returning id into created_id;
  return query select created_id,true,'generating'::text;
end;
$$;

revoke all on function public.claim_adaptive_recommendation_run(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_adaptive_recommendation_run(uuid,text,text) to service_role;

commit;
