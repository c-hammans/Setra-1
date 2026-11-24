begin;

create table if not exists public.coach_groups (
  id uuid primary key default gen_random_uuid(),
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description)<=1000),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coach_group_members (
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  relationship_id uuid not null references public.coach_client_relationships(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key(group_id,relationship_id)
);

create index if not exists coach_groups_owner_idx
  on public.coach_groups(coach_user_id,archived_at,updated_at desc);
create index if not exists coach_group_members_relationship_idx
  on public.coach_group_members(relationship_id,group_id);

drop trigger if exists coach_groups_set_updated_at on public.coach_groups;
create trigger coach_groups_set_updated_at before update on public.coach_groups
  for each row execute function public.set_updated_at();

alter table public.coach_groups enable row level security;
alter table public.coach_group_members enable row level security;

drop policy if exists coach_groups_owner_select on public.coach_groups;
create policy coach_groups_owner_select on public.coach_groups for select to authenticated
  using ((select auth.uid())=coach_user_id);

drop policy if exists coach_group_members_owner_select on public.coach_group_members;
create policy coach_group_members_owner_select on public.coach_group_members for select to authenticated
  using (exists(
    select 1 from public.coach_groups coach_group
    where coach_group.id=group_id and coach_group.coach_user_id=(select auth.uid())
  ));

revoke all on public.coach_groups,public.coach_group_members from anon,authenticated;
grant select on public.coach_groups,public.coach_group_members to authenticated;
grant all on public.coach_groups,public.coach_group_members to service_role;

create or replace function public.list_coach_groups(p_include_archived boolean default false,p_today date default current_date)
returns table(
  group_id uuid,
  name text,
  description text,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb,
  upcoming jsonb
)
language sql stable security definer set search_path='' as $$
  select coach_group.id,coach_group.name,coach_group.description,coach_group.archived_at,
    coach_group.created_at,coach_group.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'relationshipId',relationship.id,
        'clientUserId',relationship.client_user_id,
        'displayName',coalesce(nullif(profile.display_name,''),profile.username,'Setra athlete'),
        'username',coalesce(profile.username,''),
        'assignTraining',relationship.can_assign_training
      ) order by coalesce(nullif(profile.display_name,''),profile.username,'Setra athlete'))
      from public.coach_group_members member
      join public.coach_client_relationships relationship on relationship.id=member.relationship_id
      join public.profiles profile on profile.id=relationship.client_user_id
      where member.group_id=coach_group.id and relationship.status='active'
        and relationship.coach_user_id=auth.uid()
    ),'[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignmentId',future.id,'relationshipId',future.relationship_id,'title',future.source_template_name,
        'date',future.assigned_date,'modality',future.modality
      ) order by future.assigned_date,future.source_template_name)
      from (
        select assignment.id,assignment.relationship_id,assignment.source_template_name,assignment.assigned_date,assignment.modality
        from public.coach_group_members member
        join public.coach_client_relationships relationship on relationship.id=member.relationship_id
        join public.coach_training_assignments assignment on assignment.relationship_id=relationship.id
        where member.group_id=coach_group.id and relationship.status='active'
          and relationship.coach_user_id=auth.uid() and assignment.assigned_date>=p_today
        order by assignment.assigned_date,assignment.source_template_name
        limit 5
      ) future
    ),'[]'::jsonb)
  from public.coach_groups coach_group
  where coach_group.coach_user_id=auth.uid()
    and (p_include_archived or coach_group.archived_at is null)
  order by coach_group.updated_at desc;
$$;

create or replace function public.save_coach_group(
  p_group_id uuid,
  p_name text,
  p_description text,
  p_relationship_ids uuid[]
)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();saved_id uuid;relationship_id uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if not exists(select 1 from public.user_roles where user_id=uid and role='coach') then raise exception 'Coach access is required';end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Group name is required';end if;
  if char_length(coalesce(p_description,''))>1000 then raise exception 'Group description is too long';end if;
  if coalesce(cardinality(p_relationship_ids),0)>50 then raise exception 'A group can contain up to 50 clients';end if;
  if coalesce((select count(distinct value) from unnest(coalesce(p_relationship_ids,'{}'::uuid[])) value),0)
      <>coalesce(cardinality(p_relationship_ids),0) then raise exception 'Each client can only appear once';end if;
  if exists(
    select 1 from unnest(coalesce(p_relationship_ids,'{}'::uuid[])) selected(relationship_id)
    left join public.coach_client_relationships relationship on relationship.id=selected.relationship_id
      and relationship.coach_user_id=uid and relationship.status='active'
    where relationship.id is null
  ) then raise exception 'Only active clients can be added to a group';end if;

  if p_group_id is null then
    insert into public.coach_groups(coach_user_id,name,description)
    values(uid,trim(p_name),trim(coalesce(p_description,''))) returning id into saved_id;
  else
    update public.coach_groups set name=trim(p_name),description=trim(coalesce(p_description,''))
    where id=p_group_id and coach_user_id=uid returning id into saved_id;
    if saved_id is null then raise exception 'Group is unavailable';end if;
  end if;
  delete from public.coach_group_members member where member.group_id=saved_id;
  for relationship_id in select unnest(coalesce(p_relationship_ids,'{}'::uuid[])) loop
    insert into public.coach_group_members(group_id,relationship_id) values(saved_id,relationship_id);
  end loop;
  return saved_id;
end;$$;

create or replace function public.set_coach_group_archived(p_group_id uuid,p_archived boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.coach_groups set archived_at=case when p_archived then now() else null end
  where id=p_group_id and coach_user_id=auth.uid();
  if not found then raise exception 'Group is unavailable';end if;
end;$$;

create or replace function public.assign_coach_group_item(
  p_group_id uuid,
  p_item_type text,
  p_item_id text,
  p_date date,
  p_note text default ''
)
returns uuid[] language plpgsql security definer set search_path='' as $$
declare relationship_ids uuid[];
begin
  select array_agg(relationship.id order by relationship.id) into relationship_ids
  from public.coach_groups coach_group
  join public.coach_group_members member on member.group_id=coach_group.id
  join public.coach_client_relationships relationship on relationship.id=member.relationship_id
  where coach_group.id=p_group_id and coach_group.coach_user_id=auth.uid()
    and coach_group.archived_at is null and relationship.status='active';
  if relationship_ids is null or cardinality(relationship_ids)=0 then raise exception 'This group has no active clients';end if;
  return public.assign_coach_library_item_bulk(p_item_type,p_item_id,relationship_ids,p_date,p_note);
end;$$;

create or replace function public.remove_ended_relationship_from_coach_groups()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status<>'active' then
    delete from public.coach_group_members where relationship_id=new.id;
  end if;
  return new;
end;$$;
drop trigger if exists coach_groups_remove_ended_relationship on public.coach_client_relationships;
create trigger coach_groups_remove_ended_relationship
  after update of status on public.coach_client_relationships
  for each row when (old.status is distinct from new.status)
  execute function public.remove_ended_relationship_from_coach_groups();

revoke all on function public.list_coach_groups(boolean,date) from public,anon;
revoke all on function public.save_coach_group(uuid,text,text,uuid[]) from public,anon;
revoke all on function public.set_coach_group_archived(uuid,boolean) from public,anon;
revoke all on function public.assign_coach_group_item(uuid,text,text,date,text) from public,anon;
revoke all on function public.remove_ended_relationship_from_coach_groups() from public,anon,authenticated;
grant execute on function public.list_coach_groups(boolean,date) to authenticated;
grant execute on function public.save_coach_group(uuid,text,text,uuid[]) to authenticated;
grant execute on function public.set_coach_group_archived(uuid,boolean) to authenticated;
grant execute on function public.assign_coach_group_item(uuid,text,text,date,text) to authenticated;

commit;
