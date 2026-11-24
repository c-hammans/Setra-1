begin;

create table if not exists public.client_training_availability (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_days smallint[] not null default '{}',
  unavailable_days smallint[] not null default '{}',
  rest_days smallint[] not null default '{}',
  preferred_session_times jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(notes)<=2000)
);

create table if not exists public.client_training_unavailable_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unavailable_date date not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,unavailable_date),
  check (char_length(note)<=240)
);

create index if not exists client_training_unavailable_dates_lookup_idx
  on public.client_training_unavailable_dates(user_id,unavailable_date);

alter table public.client_training_availability enable row level security;
alter table public.client_training_unavailable_dates enable row level security;

drop policy if exists client_training_availability_owner_select on public.client_training_availability;
create policy client_training_availability_owner_select on public.client_training_availability
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists client_training_availability_active_coach_select on public.client_training_availability;
create policy client_training_availability_active_coach_select on public.client_training_availability
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.client_user_id=user_id
        and relationship.coach_user_id=(select auth.uid())
        and relationship.status='active'
        and relationship.can_view_planned_sessions
    )
  );

drop policy if exists client_training_unavailable_dates_owner_select on public.client_training_unavailable_dates;
create policy client_training_unavailable_dates_owner_select on public.client_training_unavailable_dates
  for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists client_training_unavailable_dates_active_coach_select on public.client_training_unavailable_dates;
create policy client_training_unavailable_dates_active_coach_select on public.client_training_unavailable_dates
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.client_user_id=user_id
        and relationship.coach_user_id=(select auth.uid())
        and relationship.status='active'
        and relationship.can_view_planned_sessions
    )
  );

revoke all on public.client_training_availability,public.client_training_unavailable_dates from anon,authenticated;
grant select on public.client_training_availability,public.client_training_unavailable_dates to authenticated;
grant all on public.client_training_availability,public.client_training_unavailable_dates to service_role;

create or replace function public.validate_training_availability(
  p_preferred smallint[],p_unavailable smallint[],p_rest smallint[],p_times jsonb
)
returns void language plpgsql immutable set search_path='' as $$
declare all_days smallint[]:=coalesce(p_preferred,'{}')||coalesce(p_unavailable,'{}')||coalesce(p_rest,'{}');entry record;
begin
  if exists(select 1 from unnest(all_days) day where day<0 or day>6) then
    raise exception 'Weekdays must be between 0 and 6';
  end if;
  if (select count(*) from unnest(all_days))<>(select count(distinct day) from unnest(all_days) day) then
    raise exception 'Each weekday can have only one availability status';
  end if;
  if jsonb_typeof(coalesce(p_times,'{}'::jsonb))<>'object' then
    raise exception 'Preferred session times must be an object';
  end if;
  for entry in select key,value from jsonb_each_text(coalesce(p_times,'{}'::jsonb)) loop
    if entry.key!~'^[0-6]$' or char_length(entry.value)>80 then
      raise exception 'Preferred session times are invalid';
    end if;
  end loop;
end;$$;

create or replace function public.get_my_training_availability()
returns table(
  preferred_days smallint[],unavailable_days smallint[],rest_days smallint[],
  preferred_session_times jsonb,notes text,updated_at timestamptz,one_off_dates jsonb
)
language sql stable security definer set search_path='' as $$
  select coalesce(settings.preferred_days,'{}'::smallint[]),
    coalesce(settings.unavailable_days,'{}'::smallint[]),
    coalesce(settings.rest_days,'{}'::smallint[]),
    coalesce(settings.preferred_session_times,'{}'::jsonb),
    coalesce(settings.notes,''),settings.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',blocked.id,'date',blocked.unavailable_date,'note',blocked.note
    ) order by blocked.unavailable_date)
    from public.client_training_unavailable_dates blocked
    where blocked.user_id=auth.uid() and blocked.unavailable_date>=current_date),'[]'::jsonb)
  from (select auth.uid() user_id) viewer
  left join public.client_training_availability settings on settings.user_id=viewer.user_id;
$$;

create or replace function public.save_my_training_availability(
  p_preferred_days smallint[],p_unavailable_days smallint[],p_rest_days smallint[],
  p_preferred_session_times jsonb,p_notes text
)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();clean_notes text:=trim(coalesce(p_notes,''));
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if char_length(clean_notes)>2000 then raise exception 'Availability notes are too long';end if;
  perform public.validate_training_availability(p_preferred_days,p_unavailable_days,p_rest_days,p_preferred_session_times);
  insert into public.client_training_availability(
    user_id,preferred_days,unavailable_days,rest_days,preferred_session_times,notes
  ) values(
    uid,coalesce(p_preferred_days,'{}'),coalesce(p_unavailable_days,'{}'),coalesce(p_rest_days,'{}'),
    coalesce(p_preferred_session_times,'{}'::jsonb),clean_notes
  ) on conflict(user_id) do update set
    preferred_days=excluded.preferred_days,
    unavailable_days=excluded.unavailable_days,
    rest_days=excluded.rest_days,
    preferred_session_times=excluded.preferred_session_times,
    notes=excluded.notes,
    updated_at=now();
end;$$;

create or replace function public.save_my_unavailable_date(p_date date,p_note text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();result_id uuid;clean_note text:=trim(coalesce(p_note,''));
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if p_date<current_date then raise exception 'One-off unavailable dates must be today or later';end if;
  if char_length(clean_note)>240 then raise exception 'The date note is too long';end if;
  insert into public.client_training_unavailable_dates(user_id,unavailable_date,note)
  values(uid,p_date,clean_note)
  on conflict(user_id,unavailable_date) do update set note=excluded.note,updated_at=now()
  returning id into result_id;
  return result_id;
end;$$;

create or replace function public.delete_my_unavailable_date(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.client_training_unavailable_dates where id=p_id and user_id=auth.uid();
  if not found then raise exception 'This unavailable date could not be removed';end if;
end;$$;

create or replace function public.get_coach_client_availability(
  p_relationship_id uuid,p_start date,p_end date
)
returns table(
  preferred_days smallint[],unavailable_days smallint[],rest_days smallint[],
  preferred_session_times jsonb,notes text,updated_at timestamptz,one_off_dates jsonb
)
language plpgsql stable security definer set search_path='' as $$
declare relationship public.coach_client_relationships;
begin
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=auth.uid() and status='active' and can_view_planned_sessions;
  if relationship.id is null then raise exception 'Active planned-training permission is required';end if;
  return query
  select coalesce(settings.preferred_days,'{}'::smallint[]),
    coalesce(settings.unavailable_days,'{}'::smallint[]),
    coalesce(settings.rest_days,'{}'::smallint[]),
    coalesce(settings.preferred_session_times,'{}'::jsonb),
    coalesce(settings.notes,''),settings.updated_at,
    coalesce((select jsonb_agg(jsonb_build_object(
      'id',blocked.id,'date',blocked.unavailable_date,'note',blocked.note
    ) order by blocked.unavailable_date)
    from public.client_training_unavailable_dates blocked
    where blocked.user_id=relationship.client_user_id
      and blocked.unavailable_date between p_start and p_end),'[]'::jsonb)
  from (select relationship.client_user_id user_id) client
  left join public.client_training_availability settings on settings.user_id=client.user_id;
end;$$;

revoke all on function public.validate_training_availability(smallint[],smallint[],smallint[],jsonb) from public,anon,authenticated;
revoke all on function public.get_my_training_availability() from public,anon;
revoke all on function public.save_my_training_availability(smallint[],smallint[],smallint[],jsonb,text) from public,anon;
revoke all on function public.save_my_unavailable_date(date,text) from public,anon;
revoke all on function public.delete_my_unavailable_date(uuid) from public,anon;
revoke all on function public.get_coach_client_availability(uuid,date,date) from public,anon;
grant execute on function public.get_my_training_availability() to authenticated;
grant execute on function public.save_my_training_availability(smallint[],smallint[],smallint[],jsonb,text) to authenticated;
grant execute on function public.save_my_unavailable_date(date,text) to authenticated;
grant execute on function public.delete_my_unavailable_date(uuid) to authenticated;
grant execute on function public.get_coach_client_availability(uuid,date,date) to authenticated;

commit;
