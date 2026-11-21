begin;

create table if not exists public.coach_client_relationships (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'ended')),
  can_view_planned_sessions boolean not null default false,
  can_view_completed_sessions boolean not null default false,
  can_view_history boolean not null default false,
  can_view_pbs boolean not null default false,
  can_assign_training boolean not null default false,
  can_provide_feedback boolean not null default false,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  check (coach_user_id <> client_user_id)
);

comment on table public.coach_client_relationships is
  'Consent-based coaching relationships. Independent from individual plans, user roles and friendships.';
comment on column public.coach_client_relationships.can_view_planned_sessions is
  'Reserved explicit permission. False until a future client-controlled consent flow grants it.';

create unique index if not exists coach_client_open_pair_unique
  on public.coach_client_relationships (coach_user_id, client_user_id)
  where status in ('pending', 'active');
create index if not exists coach_client_coach_status_idx
  on public.coach_client_relationships (coach_user_id, status, created_at desc);
create index if not exists coach_client_client_status_idx
  on public.coach_client_relationships (client_user_id, status, created_at desc);

alter table public.coach_client_relationships enable row level security;

drop policy if exists coach_client_relationships_select_involved on public.coach_client_relationships;
create policy coach_client_relationships_select_involved
  on public.coach_client_relationships for select to authenticated
  using ((select auth.uid()) in (coach_user_id, client_user_id));

revoke all on public.coach_client_relationships from anon;
revoke all on public.coach_client_relationships from authenticated;
grant select on public.coach_client_relationships to authenticated;
grant all on public.coach_client_relationships to service_role;

create or replace function public.coaching_pair_is_blocked(p_one uuid, p_two uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.social_connections connection
    where connection.status = 'blocked'
      and least(connection.requester_user_id, connection.addressee_user_id) = least(p_one, p_two)
      and greatest(connection.requester_user_id, connection.addressee_user_id) = greatest(p_one, p_two)
  );
$$;

revoke all on function public.coaching_pair_is_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function public.enable_coach_role()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (current_user_id, 'coach', current_user_id)
  on conflict (user_id, role) do nothing;
end;
$$;

create or replace function public.search_coaching_profiles(p_query text)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  relationship_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.username,
    coalesce(profile.display_name, profile.username),
    profile.avatar_url,
    relationship.status
  from public.profiles profile
  left join lateral (
    select candidate.status
    from public.coach_client_relationships candidate
    where candidate.coach_user_id = auth.uid()
      and candidate.client_user_id = profile.id
      and candidate.status in ('pending', 'active')
    order by candidate.created_at desc
    limit 1
  ) relationship on true
  where auth.uid() is not null
    and exists (
      select 1 from public.user_roles role
      where role.user_id = auth.uid() and role.role = 'coach'
    )
    and profile.id <> auth.uid()
    and profile.username is not null
    and length(trim(p_query)) >= 2
    and profile.username ilike trim(p_query) || '%'
    and not public.coaching_pair_is_blocked(auth.uid(), profile.id)
  order by
    case when lower(profile.username) = lower(trim(p_query)) then 0 else 1 end,
    profile.username
  limit 20;
$$;

create or replace function public.list_coaching_relationships()
returns table (
  relationship_id uuid,
  coach_user_id uuid,
  client_user_id uuid,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  viewer_role text,
  status text,
  can_view_planned_sessions boolean,
  can_view_completed_sessions boolean,
  can_view_history boolean,
  can_view_pbs boolean,
  can_assign_training boolean,
  can_provide_feedback boolean,
  created_at timestamptz,
  accepted_at timestamptz,
  ended_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    relationship.id,
    relationship.coach_user_id,
    relationship.client_user_id,
    other_profile.id,
    other_profile.username,
    coalesce(other_profile.display_name, other_profile.username),
    other_profile.avatar_url,
    case when relationship.coach_user_id = auth.uid() then 'coach' else 'client' end,
    relationship.status,
    relationship.can_view_planned_sessions,
    relationship.can_view_completed_sessions,
    relationship.can_view_history,
    relationship.can_view_pbs,
    relationship.can_assign_training,
    relationship.can_provide_feedback,
    relationship.created_at,
    relationship.accepted_at,
    relationship.ended_at
  from public.coach_client_relationships relationship
  join public.profiles other_profile
    on other_profile.id = case
      when relationship.coach_user_id = auth.uid() then relationship.client_user_id
      else relationship.coach_user_id
    end
  where auth.uid() in (relationship.coach_user_id, relationship.client_user_id)
  order by
    case relationship.status when 'pending' then 0 when 'active' then 1 else 2 end,
    relationship.created_at desc;
$$;

create or replace function public.send_coach_client_invite(p_client_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_client_user_id is null or p_client_user_id = current_user_id then
    raise exception 'You cannot invite yourself';
  end if;
  if not exists (select 1 from public.user_roles where user_id = current_user_id and role = 'coach') then
    raise exception 'A coach role is required';
  end if;
  if not exists (select 1 from public.profiles where id = p_client_user_id) then
    raise exception 'This Setra user is unavailable';
  end if;
  if public.coaching_pair_is_blocked(current_user_id, p_client_user_id) then
    raise exception 'This account is unavailable';
  end if;
  if exists (
    select 1 from public.coach_client_relationships
    where coach_user_id = current_user_id
      and client_user_id = p_client_user_id
      and status in ('pending', 'active')
  ) then
    raise exception 'A coaching relationship or invitation already exists';
  end if;

  insert into public.coach_client_relationships (coach_user_id, client_user_id)
  values (current_user_id, p_client_user_id)
  returning id into result_id;

  return result_id;
end;
$$;

create or replace function public.respond_coach_client_invite(p_relationship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  relationship public.coach_client_relationships;
begin
  select * into relationship
  from public.coach_client_relationships
  where id = p_relationship_id
    and client_user_id = current_user_id
    and status = 'pending'
  for update;

  if relationship.id is null then
    raise exception 'This coaching invitation is unavailable';
  end if;
  if p_accept and public.coaching_pair_is_blocked(relationship.coach_user_id, current_user_id) then
    raise exception 'This account is unavailable';
  end if;

  update public.coach_client_relationships
  set
    status = case when p_accept then 'active' else 'declined' end,
    responded_at = now(),
    accepted_at = case when p_accept then now() else null end,
    ended_at = case when p_accept then null else now() end,
    updated_at = now()
  where id = p_relationship_id;
end;
$$;

create or replace function public.cancel_coach_client_invite(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.coach_client_relationships
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_relationship_id
    and coach_user_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'This coaching invitation is unavailable';
  end if;
end;
$$;

create or replace function public.end_coach_client_relationship(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.coach_client_relationships
  set status = 'ended', ended_at = now(), updated_at = now()
  where id = p_relationship_id
    and status = 'active'
    and auth.uid() in (coach_user_id, client_user_id);

  if not found then
    raise exception 'This coaching relationship is unavailable';
  end if;
end;
$$;

-- The existing social block is account-wide safety state. Blocking a person
-- ends any open coaching relationship as well as the friendship connection.
create or replace function public.block_social_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or p_user is null or current_user_id = p_user then
    raise exception 'Invalid account';
  end if;

  update public.coach_client_relationships
  set status = 'ended', ended_at = now(), updated_at = now()
  where status in ('pending', 'active')
    and least(coach_user_id, client_user_id) = least(current_user_id, p_user)
    and greatest(coach_user_id, client_user_id) = greatest(current_user_id, p_user);

  delete from public.social_connections
  where least(requester_user_id, addressee_user_id) = least(current_user_id, p_user)
    and greatest(requester_user_id, addressee_user_id) = greatest(current_user_id, p_user);

  insert into public.social_connections (
    requester_user_id,
    addressee_user_id,
    status,
    blocked_by_user_id
  ) values (current_user_id, p_user, 'blocked', current_user_id);
end;
$$;

revoke all on function public.enable_coach_role() from public, anon;
revoke all on function public.search_coaching_profiles(text) from public, anon;
revoke all on function public.list_coaching_relationships() from public, anon;
revoke all on function public.send_coach_client_invite(uuid) from public, anon;
revoke all on function public.respond_coach_client_invite(uuid, boolean) from public, anon;
revoke all on function public.cancel_coach_client_invite(uuid) from public, anon;
revoke all on function public.end_coach_client_relationship(uuid) from public, anon;
revoke all on function public.block_social_user(uuid) from public, anon;

grant execute on function public.enable_coach_role() to authenticated;
grant execute on function public.search_coaching_profiles(text) to authenticated;
grant execute on function public.list_coaching_relationships() to authenticated;
grant execute on function public.send_coach_client_invite(uuid) to authenticated;
grant execute on function public.respond_coach_client_invite(uuid, boolean) to authenticated;
grant execute on function public.cancel_coach_client_invite(uuid) to authenticated;
grant execute on function public.end_coach_client_relationship(uuid) to authenticated;
grant execute on function public.block_social_user(uuid) to authenticated;

commit;
