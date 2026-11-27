begin;

alter table public.adaptive_weekly_reviews
  add column attempt_count integer not null default 0 check (attempt_count >= 0);

create or replace function public.claim_adaptive_weekly_review_generation(
  p_user_id uuid, p_week_start date, p_source_hash text, p_force boolean default false
) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  existing public.adaptive_weekly_reviews;
  profile_timezone text;
  starts_on integer;
  today_local date;
  target_week date;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service role required';end if;
  if public.effective_individual_plan(p_user_id) is distinct from 'adaptive' then return false;end if;
  select profile.timezone, profile.week_starts_on into profile_timezone, starts_on
    from public.profiles profile where profile.id=p_user_id;
  if not found then return false;end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=profile_timezone) then profile_timezone:='UTC';end if;
  today_local:=(now() at time zone profile_timezone)::date;
  target_week:=today_local-((extract(dow from today_local)::int-coalesce(starts_on,1)+7)%7)-7;
  if p_week_start is distinct from target_week then return false;end if;

  insert into public.adaptive_weekly_reviews(user_id,week_start,week_end,status,source_hash,attempt_count)
    values(p_user_id,p_week_start,p_week_start+6,'generating',p_source_hash,1)
    on conflict(user_id,week_start) do nothing;
  if found then return true;end if;

  select * into existing from public.adaptive_weekly_reviews
    where user_id=p_user_id and week_start=p_week_start for update;
  if existing.status='generating' and existing.updated_at>now()-interval '5 minutes' then return false;end if;
  if existing.status in ('ready','failed') and existing.source_hash=p_source_hash and not p_force then return false;end if;
  if greatest(existing.attempt_count,existing.generation_count)>=4 then
    raise exception using errcode='P0429',message='Weekly review generation limit reached';
  end if;

  update public.adaptive_weekly_reviews set status='generating',source_hash=p_source_hash,
    error_message=null,updated_at=now(),attempt_count=greatest(existing.attempt_count,existing.generation_count)+1
    where id=existing.id;
  return true;
end;
$$;

grant execute on function public.upsert_app_notification(uuid,uuid,text,text,text,text,text,text,text,text,timestamptz) to service_role;

commit;
