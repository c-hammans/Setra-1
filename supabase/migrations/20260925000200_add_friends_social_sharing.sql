begin;

alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_username_format_check;
alter table public.profiles add constraint profiles_username_format_check
  check (username is null or username ~ '^[a-z0-9][a-z0-9_]{2,29}$');
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;
grant update (username,avatar_url) on public.profiles to authenticated;

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  addressee_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  blocked_by_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_user_id <> addressee_user_id),
  check ((status='blocked') = (blocked_by_user_id is not null)),
  unique (requester_user_id,addressee_user_id)
);
create unique index if not exists social_connections_pair_unique
  on public.social_connections (least(requester_user_id,addressee_user_id),greatest(requester_user_id,addressee_user_id));
create index if not exists social_connections_requester_idx on public.social_connections(requester_user_id,status);
create index if not exists social_connections_addressee_idx on public.social_connections(addressee_user_id,status);

create table if not exists public.friend_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  share_pbs boolean not null default false,
  share_completed_workouts boolean not null default false,
  share_training_summary boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_permission_overrides (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  friend_user_id uuid not null references auth.users(id) on delete cascade,
  share_pbs boolean,
  share_completed_workouts boolean,
  share_training_summary boolean,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id,friend_user_id),
  check (owner_user_id <> friend_user_id)
);

create table if not exists public.social_shared_items (
  id uuid primary key default gen_random_uuid(),
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('strength_workout','endurance_workout','strength_template','endurance_template')),
  source_client_id text,
  title text not null check (char_length(title) between 1 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  recipient_status text not null default 'new' check (recipient_status in ('new','viewed','saved','dismissed')),
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  saved_at timestamptz,
  check (sender_user_id <> recipient_user_id)
);
create index if not exists social_shared_items_recipient_idx on public.social_shared_items(recipient_user_id,created_at desc);
create index if not exists social_shared_items_sender_idx on public.social_shared_items(sender_user_id,created_at desc);

create table if not exists public.social_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (notification_type in ('friend_request','friend_accepted','workout_shared','template_shared')),
  connection_id uuid references public.social_connections(id) on delete cascade,
  shared_item_id uuid references public.social_shared_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_user_id <> actor_user_id)
);
create index if not exists social_notifications_recipient_idx on public.social_notifications(recipient_user_id,read_at,created_at desc);

alter table public.social_connections enable row level security;
alter table public.friend_privacy_settings enable row level security;
alter table public.friend_permission_overrides enable row level security;
alter table public.social_shared_items enable row level security;
alter table public.social_notifications enable row level security;

drop policy if exists social_connections_select_involved on public.social_connections;
create policy social_connections_select_involved on public.social_connections for select to authenticated
  using ((select auth.uid()) in (requester_user_id,addressee_user_id)
    and (status<>'blocked' or blocked_by_user_id=(select auth.uid())));
drop policy if exists friend_privacy_own on public.friend_privacy_settings;
create policy friend_privacy_own on public.friend_privacy_settings for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists friend_overrides_own on public.friend_permission_overrides;
create policy friend_overrides_own on public.friend_permission_overrides for all to authenticated
  using ((select auth.uid())=owner_user_id) with check ((select auth.uid())=owner_user_id);
drop policy if exists shared_items_participants_select on public.social_shared_items;
create policy shared_items_participants_select on public.social_shared_items for select to authenticated
  using ((select auth.uid()) in (sender_user_id,recipient_user_id));
drop policy if exists shared_items_recipient_update on public.social_shared_items;
create policy shared_items_recipient_update on public.social_shared_items for update to authenticated
  using ((select auth.uid())=recipient_user_id) with check ((select auth.uid())=recipient_user_id);
drop policy if exists social_notifications_recipient_select on public.social_notifications;
create policy social_notifications_recipient_select on public.social_notifications for select to authenticated
  using ((select auth.uid())=recipient_user_id);
drop policy if exists social_notifications_recipient_update on public.social_notifications;
create policy social_notifications_recipient_update on public.social_notifications for update to authenticated
  using ((select auth.uid())=recipient_user_id) with check ((select auth.uid())=recipient_user_id);

revoke all on public.social_connections,public.friend_privacy_settings,public.friend_permission_overrides,public.social_shared_items,public.social_notifications from anon;
revoke insert,update,delete on public.social_connections,public.social_shared_items,public.social_notifications from authenticated;
grant select on public.social_connections,public.social_shared_items,public.social_notifications to authenticated;
grant select,insert,update,delete on public.friend_privacy_settings,public.friend_permission_overrides to authenticated;
grant update (recipient_status,viewed_at,saved_at) on public.social_shared_items to authenticated;
grant update (read_at) on public.social_notifications to authenticated;

create or replace function public.social_are_friends(p_one uuid,p_two uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.social_connections c where c.status='accepted'
    and least(c.requester_user_id,c.addressee_user_id)=least(p_one,p_two)
    and greatest(c.requester_user_id,c.addressee_user_id)=greatest(p_one,p_two));
$$;
revoke all on function public.social_are_friends(uuid,uuid) from public,anon;

create or replace function public.search_social_profiles(p_query text)
returns table(user_id uuid,username text,display_name text,avatar_url text,connection_status text)
language sql stable security definer set search_path=public,pg_temp as $$
  select p.id,p.username,coalesce(p.display_name,p.username),p.avatar_url,c.status
  from public.profiles p
  left join public.social_connections c on least(c.requester_user_id,c.addressee_user_id)=least(auth.uid(),p.id)
    and greatest(c.requester_user_id,c.addressee_user_id)=greatest(auth.uid(),p.id)
  where auth.uid() is not null and p.id<>auth.uid() and p.username is not null
    and length(trim(p_query))>=2
    and (p.username ilike trim(p_query)||'%' or p.display_name ilike '%'||trim(p_query)||'%')
    and not exists(select 1 from public.social_connections b where b.status='blocked'
      and least(b.requester_user_id,b.addressee_user_id)=least(auth.uid(),p.id)
      and greatest(b.requester_user_id,b.addressee_user_id)=greatest(auth.uid(),p.id))
  order by case when lower(p.username)=lower(trim(p_query)) then 0 else 1 end,p.username limit 20;
$$;
revoke all on function public.search_social_profiles(text) from public,anon;
grant execute on function public.search_social_profiles(text) to authenticated;

create or replace function public.list_social_connections()
returns table(connection_id uuid,other_user_id uuid,username text,display_name text,avatar_url text,status text,direction text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select c.id,case when c.requester_user_id=auth.uid() then c.addressee_user_id else c.requester_user_id end,
    p.username,coalesce(p.display_name,p.username),p.avatar_url,c.status,
    case when c.requester_user_id=auth.uid() then 'outgoing' else 'incoming' end,c.created_at
  from public.social_connections c join public.profiles p on p.id=case when c.requester_user_id=auth.uid() then c.addressee_user_id else c.requester_user_id end
  where auth.uid() in (c.requester_user_id,c.addressee_user_id)
    and (c.status<>'blocked' or c.blocked_by_user_id=auth.uid())
  order by c.created_at desc;
$$;
revoke all on function public.list_social_connections() from public,anon;
grant execute on function public.list_social_connections() to authenticated;

create or replace function public.send_friend_request(p_addressee uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); existing public.social_connections; result_id uuid;
begin
  if uid is null or p_addressee is null or uid=p_addressee then raise exception 'Invalid friend request'; end if;
  select * into existing from public.social_connections c where least(c.requester_user_id,c.addressee_user_id)=least(uid,p_addressee) and greatest(c.requester_user_id,c.addressee_user_id)=greatest(uid,p_addressee);
  if existing.status='blocked' then raise exception 'This account is unavailable'; end if;
  if existing.id is not null then return existing.id; end if;
  insert into public.social_connections(requester_user_id,addressee_user_id) values(uid,p_addressee) returning id into result_id;
  insert into public.social_notifications(recipient_user_id,actor_user_id,notification_type,connection_id) values(p_addressee,uid,'friend_request',result_id);
  return result_id;
end;$$;

create or replace function public.respond_friend_request(p_connection uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); requester uuid;
begin
  select requester_user_id into requester from public.social_connections where id=p_connection and addressee_user_id=uid and status='pending' for update;
  if requester is null then raise exception 'Friend request is unavailable'; end if;
  if p_accept then
    update public.social_connections set status='accepted',accepted_at=now(),updated_at=now() where id=p_connection;
    insert into public.social_notifications(recipient_user_id,actor_user_id,notification_type,connection_id) values(requester,uid,'friend_accepted',p_connection);
  else delete from public.social_connections where id=p_connection; end if;
end;$$;

create or replace function public.cancel_friend_request(p_connection uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.social_connections where id=p_connection and requester_user_id=auth.uid() and status='pending';
$$;
create or replace function public.remove_friend(p_connection uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.social_connections where id=p_connection and status='accepted' and auth.uid() in (requester_user_id,addressee_user_id);
$$;
create or replace function public.block_social_user(p_user uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); result_id uuid;
begin
  if uid is null or p_user is null or uid=p_user then raise exception 'Invalid account'; end if;
  delete from public.social_connections where least(requester_user_id,addressee_user_id)=least(uid,p_user) and greatest(requester_user_id,addressee_user_id)=greatest(uid,p_user);
  insert into public.social_connections(requester_user_id,addressee_user_id,status,blocked_by_user_id) values(uid,p_user,'blocked',uid) returning id into result_id;
end;$$;
create or replace function public.unblock_social_user(p_connection uuid)
returns void language sql security definer set search_path=public,pg_temp as $$
  delete from public.social_connections where id=p_connection and status='blocked' and blocked_by_user_id=auth.uid();
$$;

create or replace function public.social_strip_private(value jsonb)
returns jsonb language plpgsql immutable set search_path=public,pg_temp as $$
declare result jsonb; item jsonb; key text; child jsonb;
begin
  if jsonb_typeof(value)='object' then
    result='{}'::jsonb;
    for key,child in select * from jsonb_each(value) loop
      if lower(key) not in ('note','notes','planningnote','planningnotes','email','sourcefile','uploadedfile') then result=result||jsonb_build_object(key,public.social_strip_private(child)); end if;
    end loop; return result;
  elsif jsonb_typeof(value)='array' then
    result='[]'::jsonb; for item in select * from jsonb_array_elements(value) loop result=result||jsonb_build_array(public.social_strip_private(item)); end loop; return result;
  end if; return value;
end;$$;

create or replace function public.share_social_item(p_recipient uuid,p_item_type text,p_source_client_id text,p_title text,p_snapshot jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); result_id uuid; kind text;
begin
  if not public.social_are_friends(uid,p_recipient) then raise exception 'Only accepted friends can receive shared training'; end if;
  if p_item_type not in ('strength_workout','endurance_workout','strength_template','endurance_template') then raise exception 'Unsupported share type'; end if;
  insert into public.social_shared_items(sender_user_id,recipient_user_id,item_type,source_client_id,title,snapshot)
    values(uid,p_recipient,p_item_type,p_source_client_id,left(trim(p_title),120),public.social_strip_private(p_snapshot)) returning id into result_id;
  kind:=case when p_item_type like '%template' then 'template_shared' else 'workout_shared' end;
  insert into public.social_notifications(recipient_user_id,actor_user_id,notification_type,shared_item_id) values(p_recipient,uid,kind,result_id);
  return result_id;
end;$$;

create or replace function public.get_friend_profile(p_friend uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); privacy public.friend_privacy_settings; override_row public.friend_permission_overrides; result jsonb; pbs jsonb:='[]'::jsonb; endurance_pbs jsonb:='[]'::jsonb; recent_workouts jsonb:='[]'::jsonb; summary jsonb:='{}'::jsonb;
begin
  if not public.social_are_friends(uid,p_friend) then raise exception 'Friend profile is unavailable'; end if;
  select * into privacy from public.friend_privacy_settings where user_id=p_friend;
  select * into override_row from public.friend_permission_overrides where owner_user_id=p_friend and friend_user_id=uid;
  if coalesce(override_row.share_pbs,privacy.share_pbs,false) then
    select coalesce(jsonb_agg(to_jsonb(best) order by best.exercise_name),'[]'::jsonb) into pbs from (
      select distinct on (we.exercise_id) we.exercise_id,e.name exercise_name,ws.weight,ws.reps,w.workout_date
      from public.workouts w join public.workout_exercises we on we.workout_id=w.id join public.workout_sets ws on ws.workout_exercise_id=we.id join public.exercises e on e.id=we.exercise_id
      where w.user_id=p_friend and w.status='completed' and ws.completed and ws.weight is not null and ws.weight>0 and not we.skipped
      order by we.exercise_id,ws.weight desc,w.workout_date asc
    ) best;
    select coalesce(jsonb_agg(to_jsonb(best) order by best.distance_metres),'[]'::jsonb) into endurance_pbs from (
      select distinct on (round(ts.distance_metres)) round(ts.distance_metres)::integer distance_metres,ts.activity_type,ts.duration_seconds,ts.session_date
      from public.training_sessions ts
      where ts.user_id=p_friend and ts.status='completed' and ts.duration_seconds>0
        and round(ts.distance_metres) in (5000,10000,21098)
      order by round(ts.distance_metres),ts.duration_seconds asc,ts.session_date asc
    ) best;
  end if;
  if coalesce(override_row.share_completed_workouts,privacy.share_completed_workouts,false) then
    select coalesce(jsonb_agg(item order by (item->>'date') desc),'[]'::jsonb) into recent_workouts from (
      select jsonb_build_object('type','strength','title',w.name,'date',w.workout_date,'durationMinutes',case when w.started_at is not null and w.ended_at is not null then extract(epoch from (w.ended_at-w.started_at))/60 else null end) item
      from public.workouts w where w.user_id=p_friend and w.status='completed'
      union all
      select jsonb_build_object('type','endurance','title',ts.title,'date',ts.session_date,'activityType',ts.activity_type,'durationMinutes',ts.duration_seconds/60.0,'distanceKm',ts.distance_metres/1000.0) item
      from public.training_sessions ts where ts.user_id=p_friend and ts.status='completed'
      order by (item->>'date') desc limit 10
    ) recent;
  end if;
  if coalesce(override_row.share_training_summary,privacy.share_training_summary,false) then
    select jsonb_build_object('strengthSessions',(select count(*) from public.workouts where user_id=p_friend and status='completed' and workout_date>=current_date-6),
      'enduranceSessions',(select count(*) from public.training_sessions where user_id=p_friend and status='completed' and session_date>=current_date-6),
      'trainingMinutes',coalesce((select sum(extract(epoch from (ended_at-started_at))/60) from public.training_sessions where user_id=p_friend and status='completed' and session_date>=current_date-6),0)) into summary;
  end if;
  select jsonb_build_object('userId',p.id,'username',p.username,'displayName',coalesce(p.display_name,p.username),'avatarUrl',p.avatar_url,
    'permissions',jsonb_build_object('pbs',coalesce(override_row.share_pbs,privacy.share_pbs,false),'completedWorkouts',coalesce(override_row.share_completed_workouts,privacy.share_completed_workouts,false),'trainingSummary',coalesce(override_row.share_training_summary,privacy.share_training_summary,false)),
    'strengthPbs',pbs,'endurancePbs',endurance_pbs,'recentWorkouts',recent_workouts,'trainingSummary',summary) into result from public.profiles p where p.id=p_friend;
  return result;
end;$$;

create or replace function public.list_social_notifications()
returns table(notification_id uuid,notification_type text,actor_user_id uuid,actor_username text,actor_display_name text,shared_item_id uuid,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select n.id,n.notification_type,n.actor_user_id,p.username,coalesce(p.display_name,p.username),n.shared_item_id,n.created_at,n.read_at
  from public.social_notifications n join public.profiles p on p.id=n.actor_user_id where n.recipient_user_id=auth.uid() order by n.created_at desc limit 50;
$$;

do $$ declare fn text; begin
  foreach fn in array array['send_friend_request(uuid)','respond_friend_request(uuid,boolean)','cancel_friend_request(uuid)','remove_friend(uuid)','block_social_user(uuid)','unblock_social_user(uuid)','share_social_item(uuid,text,text,text,jsonb)','get_friend_profile(uuid)','list_social_notifications()'] loop
    execute 'revoke all on function public.'||fn||' from public,anon';
    execute 'grant execute on function public.'||fn||' to authenticated';
  end loop;
end $$;

commit;
