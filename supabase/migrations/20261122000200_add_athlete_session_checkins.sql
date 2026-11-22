begin;

create table if not exists public.athlete_session_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  modality text not null check (modality in ('strength','endurance')),
  completed_client_id text not null check (char_length(completed_client_id) between 1 and 220),
  session_rpe numeric(3,1) check (session_rpe is null or (session_rpe between 0 and 10)),
  session_feel text check (session_feel is null or session_feel in ('easier','expected','harder')),
  athlete_comment text not null default '' check (char_length(athlete_comment)<=1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,modality,completed_client_id),
  check (modality='strength' or session_rpe is null)
);

create index if not exists athlete_session_checkins_user_idx
  on public.athlete_session_checkins(user_id,updated_at desc);

drop trigger if exists athlete_session_checkins_set_updated_at on public.athlete_session_checkins;
create trigger athlete_session_checkins_set_updated_at
  before update on public.athlete_session_checkins
  for each row execute function public.set_updated_at();

alter table public.athlete_session_checkins enable row level security;

drop policy if exists athlete_session_checkins_owner_select on public.athlete_session_checkins;
create policy athlete_session_checkins_owner_select on public.athlete_session_checkins
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists athlete_session_checkins_owner_insert on public.athlete_session_checkins;
create policy athlete_session_checkins_owner_insert on public.athlete_session_checkins
  for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists athlete_session_checkins_owner_update on public.athlete_session_checkins;
create policy athlete_session_checkins_owner_update on public.athlete_session_checkins
  for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists athlete_session_checkins_owner_delete on public.athlete_session_checkins;
create policy athlete_session_checkins_owner_delete on public.athlete_session_checkins
  for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists athlete_session_checkins_active_coach_select on public.athlete_session_checkins;
create policy athlete_session_checkins_active_coach_select on public.athlete_session_checkins
  for select to authenticated using (exists (
    select 1 from public.coach_client_relationships relationship
    where relationship.client_user_id=user_id
      and relationship.coach_user_id=(select auth.uid())
      and relationship.status='active'
      and relationship.can_view_completed_sessions
  ));

revoke all on public.athlete_session_checkins from anon,authenticated;
grant select,insert,update,delete on public.athlete_session_checkins to authenticated;
grant all on public.athlete_session_checkins to service_role;

create or replace function public.save_athlete_session_checkin(
  p_modality text,
  p_completed_client_id text,
  p_session_rpe numeric default null,
  p_session_feel text default null,
  p_athlete_comment text default ''
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  clean_comment text:=trim(coalesce(p_athlete_comment,''));
  checkin_id uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_modality not in ('strength','endurance') then raise exception 'Unsupported session type';end if;
  if p_session_rpe is not null and (p_session_rpe<0 or p_session_rpe>10) then raise exception 'Session RPE must be between 0 and 10';end if;
  if p_session_feel is not null and p_session_feel not in ('easier','expected','harder') then raise exception 'Unsupported session feel';end if;
  if char_length(clean_comment)>1000 then raise exception 'Athlete comment is too long';end if;

  if p_modality='strength' then
    if not exists(select 1 from public.workouts where user_id=uid and client_id=p_completed_client_id and status='completed') then
      raise exception 'Completed strength workout not found';
    end if;
  else
    update public.training_sessions set completed_rpe=p_session_rpe,updated_at=now()
    where user_id=uid and client_id=p_completed_client_id and modality='endurance' and status='completed';
    if not found then raise exception 'Completed endurance session not found';end if;
  end if;

  if p_session_feel is null and clean_comment='' and (p_modality='endurance' or p_session_rpe is null) then
    delete from public.athlete_session_checkins
    where user_id=uid and modality=p_modality and completed_client_id=p_completed_client_id;
    return null;
  end if;

  insert into public.athlete_session_checkins(user_id,modality,completed_client_id,session_rpe,session_feel,athlete_comment)
  values(uid,p_modality,p_completed_client_id,case when p_modality='strength' then p_session_rpe else null end,p_session_feel,clean_comment)
  on conflict(user_id,modality,completed_client_id) do update set
    session_rpe=excluded.session_rpe,
    session_feel=excluded.session_feel,
    athlete_comment=excluded.athlete_comment,
    updated_at=now()
  returning id into checkin_id;
  return checkin_id;
end;$$;

create or replace function public.list_coach_client_athlete_checkins(
  p_relationship_id uuid,
  p_anchor date default current_date
)
returns table(
  occurrence_id uuid,
  session_rpe numeric,
  session_feel text,
  athlete_comment text,
  updated_at timestamptz
)
language plpgsql stable security definer set search_path='' as $$
declare active_relationship public.coach_client_relationships;week_start date;
begin
  select * into active_relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=auth.uid() and status='active'
    and can_view_completed_sessions;
  if active_relationship.id is null then raise exception 'Active completed-session permission is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into week_start from public.profiles profile where profile.id=active_relationship.client_user_id;

  return query
  select occurrence.id,
    case when occurrence.modality='endurance' then endurance.completed_rpe else checkin.session_rpe end,
    checkin.session_feel,
    checkin.athlete_comment,
    greatest(checkin.updated_at,endurance.updated_at)
  from public.training_plan_occurrences occurrence
  left join public.athlete_session_checkins checkin
    on checkin.user_id=active_relationship.client_user_id
    and checkin.modality=occurrence.modality
    and checkin.completed_client_id=occurrence.linked_completion_client_id
  left join public.training_sessions endurance
    on occurrence.modality='endurance'
    and endurance.user_id=active_relationship.client_user_id
    and endurance.client_id=occurrence.linked_completion_client_id
  where occurrence.user_id=active_relationship.client_user_id
    and occurrence.planned_date between week_start and week_start+6
    and occurrence.status in ('completed','partial')
    and (checkin.id is not null or endurance.completed_rpe is not null)
  order by occurrence.planned_date,occurrence.created_at;
end;$$;

revoke all on function public.save_athlete_session_checkin(text,text,numeric,text,text) from public,anon;
revoke all on function public.list_coach_client_athlete_checkins(uuid,date) from public,anon;
grant execute on function public.save_athlete_session_checkin(text,text,numeric,text,text) to authenticated;
grant execute on function public.list_coach_client_athlete_checkins(uuid,date) to authenticated;

commit;
