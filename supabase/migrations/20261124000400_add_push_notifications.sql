begin;

alter table public.notification_preferences
  add column if not exists push_training_enabled boolean not null default false,
  add column if not exists push_coaching_enabled boolean not null default false,
  add column if not exists push_social_enabled boolean not null default false,
  add column if not exists session_reminder_offset_minutes integer;
alter table public.notification_preferences drop constraint if exists notification_preferences_reminder_offset_check;
alter table public.notification_preferences add constraint notification_preferences_reminder_offset_check
  check (session_reminder_offset_minutes is null or session_reminder_offset_minutes in (0,30,60));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint)<=2048),
  p256dh text not null check (char_length(p256dh) between 20 and 500),
  auth_secret text not null check (char_length(auth_secret) between 8 and 200),
  expiration_time timestamptz,
  user_agent text not null default '' check (char_length(user_agent)<=500),
  enabled boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_active_idx on public.push_subscriptions(user_id,enabled) where enabled;

create table if not exists public.push_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count>=0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,subscription_id)
);
create index if not exists push_delivery_jobs_due_idx on public.push_delivery_jobs(status,next_attempt_at) where status in ('pending','processing');

create table if not exists public.planned_session_push_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  scheduled_for timestamptz not null,
  notification_id uuid references public.app_notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(training_session_id)
);
create index if not exists planned_session_push_reminders_due_idx on public.planned_session_push_reminders(scheduled_for) where notification_id is null;

alter table public.push_subscriptions enable row level security;
alter table public.push_delivery_jobs enable row level security;
alter table public.planned_session_push_reminders enable row level security;
revoke all on public.push_subscriptions,public.push_delivery_jobs,public.planned_session_push_reminders from anon,authenticated;
grant all on public.push_subscriptions,public.push_delivery_jobs,public.planned_session_push_reminders to service_role;

create or replace function public.register_push_subscription(p_endpoint text,p_p256dh text,p_auth text,p_expiration_time timestamptz default null,p_user_agent text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required';end if;
  if p_endpoint not like 'https://%' or char_length(p_endpoint)>2048 or char_length(p_p256dh) not between 20 and 500 or char_length(p_auth) not between 8 and 200 then raise exception 'Invalid push subscription';end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret,expiration_time,user_agent,enabled,updated_at)
  values(auth.uid(),p_endpoint,p_p256dh,p_auth,p_expiration_time,left(coalesce(p_user_agent,''),500),true,now())
  on conflict(endpoint) do update set user_id=auth.uid(),p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,
    expiration_time=excluded.expiration_time,user_agent=excluded.user_agent,enabled=true,updated_at=now()
  returning id into result_id;
  return result_id;
end;$$;

create or replace function public.revoke_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required';end if;
  update public.push_subscriptions set enabled=false,updated_at=now() where user_id=auth.uid() and endpoint=p_endpoint;
  delete from public.push_delivery_jobs job using public.push_subscriptions subscription
    where job.subscription_id=subscription.id and subscription.user_id=auth.uid() and subscription.endpoint=p_endpoint and job.status in ('pending','processing');
end;$$;
revoke all on function public.register_push_subscription(text,text,text,timestamptz,text) from public,anon;
revoke all on function public.revoke_push_subscription(text) from public,anon;
grant execute on function public.register_push_subscription(text,text,text,timestamptz,text) to authenticated;
grant execute on function public.revoke_push_subscription(text) to authenticated;

create or replace function public.notification_category_enabled(p_user uuid,p_category text)
returns boolean language sql stable security definer set search_path='' as $$
  select case p_category when 'training' then coalesce(pref.training_enabled,true) or coalesce(pref.push_training_enabled,false)
    when 'coaching' then coalesce(pref.coaching_enabled,true) or coalesce(pref.push_coaching_enabled,false)
    when 'social' then coalesce(pref.social_enabled,true) or coalesce(pref.push_social_enabled,false)
    when 'awards' then coalesce(pref.awards_enabled,true) else false end
  from (select 1) seed left join public.notification_preferences pref on pref.user_id=p_user;
$$;

create or replace function public.list_app_notifications(p_before timestamptz default null,p_limit integer default 30)
returns table(notification_id uuid,category text,notification_type text,title text,body text,target_type text,target_id text,target_path text,actor_name text,created_at timestamptz,updated_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
  select notice.id,notice.category,notice.notification_type,notice.title,notice.body,notice.target_type,notice.target_id,notice.target_path,notice.actor_name,notice.created_at,notice.updated_at,notice.read_at
  from public.app_notifications notice left join public.notification_preferences pref on pref.user_id=notice.user_id
  where notice.user_id=auth.uid() and notice.dismissed_at is null and case notice.category
    when 'training' then coalesce(pref.training_enabled,true) when 'coaching' then coalesce(pref.coaching_enabled,true)
    when 'social' then coalesce(pref.social_enabled,true) when 'awards' then coalesce(pref.awards_enabled,true) else false end
    and (p_before is null or notice.created_at<p_before)
  order by notice.created_at desc,notice.id desc limit greatest(1,least(coalesce(p_limit,30),50));
$$;
create or replace function public.count_unread_app_notifications()
returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from public.app_notifications notice left join public.notification_preferences pref on pref.user_id=notice.user_id
  where notice.user_id=auth.uid() and notice.read_at is null and notice.dismissed_at is null and case notice.category
    when 'training' then coalesce(pref.training_enabled,true) when 'coaching' then coalesce(pref.coaching_enabled,true)
    when 'social' then coalesce(pref.social_enabled,true) when 'awards' then coalesce(pref.awards_enabled,true) else false end;
$$;

drop function if exists public.get_notification_preferences();
create function public.get_notification_preferences()
returns table(training_enabled boolean,coaching_enabled boolean,social_enabled boolean,awards_enabled boolean,push_training_enabled boolean,push_coaching_enabled boolean,push_social_enabled boolean,session_reminder_offset_minutes integer)
language sql stable security definer set search_path='' as $$
  select coalesce(pref.training_enabled,true),coalesce(pref.coaching_enabled,true),coalesce(pref.social_enabled,true),coalesce(pref.awards_enabled,true),
    coalesce(pref.push_training_enabled,false),coalesce(pref.push_coaching_enabled,false),coalesce(pref.push_social_enabled,false),pref.session_reminder_offset_minutes
  from (select 1) seed left join public.notification_preferences pref on pref.user_id=auth.uid();
$$;
revoke all on function public.get_notification_preferences() from public,anon;
grant execute on function public.get_notification_preferences() to authenticated;

create or replace function public.refresh_planned_session_push_reminder(p_session_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare session public.training_sessions;offset_minutes integer;scheduled_time timestamptz;old_notification uuid;
begin
  select * into session from public.training_sessions where id=p_session_id;
  if not found then return;end if;
  select case when push_training_enabled then session_reminder_offset_minutes else null end into offset_minutes from public.notification_preferences where user_id=session.user_id;
  select notification_id into old_notification from public.planned_session_push_reminders where training_session_id=session.id;
  if old_notification is not null then update public.app_notifications set dismissed_at=now(),updated_at=now() where id=old_notification;end if;
  if offset_minutes is null or session.status<>'planned' or session.skipped or session.planned_start_time is null then
    delete from public.planned_session_push_reminders where training_session_id=session.id;return;
  end if;
  scheduled_time:=((session.session_date+session.planned_start_time) at time zone coalesce(nullif(session.timezone,''),'UTC'))-make_interval(mins=>offset_minutes);
  if scheduled_time<=now() then delete from public.planned_session_push_reminders where training_session_id=session.id;return;end if;
  insert into public.planned_session_push_reminders(user_id,training_session_id,scheduled_for,notification_id,updated_at)
  values(session.user_id,session.id,scheduled_time,null,now()) on conflict(training_session_id) do update
    set user_id=excluded.user_id,scheduled_for=excluded.scheduled_for,notification_id=null,updated_at=now();
end;$$;

create or replace function public.sync_planned_session_push_reminder()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    update public.app_notifications set dismissed_at=now(),updated_at=now() where id=(select notification_id from public.planned_session_push_reminders where training_session_id=old.id);
    delete from public.planned_session_push_reminders where training_session_id=old.id;return old;
  end if;
  perform public.refresh_planned_session_push_reminder(new.id);return new;
end;$$;
drop trigger if exists training_session_sync_push_reminder on public.training_sessions;
create trigger training_session_sync_push_reminder after insert or update of session_date,planned_start_time,status,skipped,timezone on public.training_sessions
for each row execute function public.sync_planned_session_push_reminder();
drop trigger if exists training_session_delete_push_reminder on public.training_sessions;
create trigger training_session_delete_push_reminder before delete on public.training_sessions
for each row execute function public.sync_planned_session_push_reminder();

drop function if exists public.save_notification_preferences(boolean,boolean,boolean,boolean);
create or replace function public.save_notification_preferences(p_training boolean,p_coaching boolean,p_social boolean,p_awards boolean,p_push_training boolean,p_push_coaching boolean,p_push_social boolean,p_session_reminder_offset integer)
returns void language plpgsql security definer set search_path='' as $$
declare session_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required';end if;
  if p_session_reminder_offset is not null and p_session_reminder_offset not in (0,30,60) then raise exception 'Invalid reminder time';end if;
  insert into public.notification_preferences(user_id,training_enabled,coaching_enabled,social_enabled,awards_enabled,push_training_enabled,push_coaching_enabled,push_social_enabled,session_reminder_offset_minutes)
  values(auth.uid(),coalesce(p_training,true),coalesce(p_coaching,true),coalesce(p_social,true),coalesce(p_awards,true),coalesce(p_push_training,false),coalesce(p_push_coaching,false),coalesce(p_push_social,false),p_session_reminder_offset)
  on conflict(user_id) do update set training_enabled=excluded.training_enabled,coaching_enabled=excluded.coaching_enabled,social_enabled=excluded.social_enabled,
    awards_enabled=excluded.awards_enabled,push_training_enabled=excluded.push_training_enabled,push_coaching_enabled=excluded.push_coaching_enabled,
    push_social_enabled=excluded.push_social_enabled,session_reminder_offset_minutes=excluded.session_reminder_offset_minutes,updated_at=now();
  delete from public.push_delivery_jobs job using public.app_notifications notice
    where job.notification_id=notice.id and notice.user_id=auth.uid() and job.status in ('pending','processing') and
      ((notice.category='training' and not coalesce(p_push_training,false)) or (notice.category='coaching' and not coalesce(p_push_coaching,false)) or (notice.category='social' and not coalesce(p_push_social,false)));
  for session_id in select id from public.training_sessions where user_id=auth.uid() and status='planned' loop perform public.refresh_planned_session_push_reminder(session_id);end loop;
end;$$;
revoke all on function public.save_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,integer) from public,anon;
grant execute on function public.save_notification_preferences(boolean,boolean,boolean,boolean,boolean,boolean,boolean,integer) to authenticated;

create or replace function public.queue_push_delivery_jobs()
returns trigger language plpgsql security definer set search_path='' as $$
declare push_enabled boolean;eligible boolean;
begin
  if tg_op='UPDATE' and (new.title,new.body,new.target_path,new.dismissed_at) is not distinct from (old.title,old.body,old.target_path,old.dismissed_at) then return new;end if;
  eligible:=new.notification_type in ('workout_assigned','program_assigned','program_updated','planned_session_changed','coach_feedback','weekly_review','coach_comment','coach_invite','coach_relationship_accepted','friend_request','workout_shared','template_shared','planned_session_reminder');
  if not eligible or new.dismissed_at is not null then return new;end if;
  select case new.category when 'training' then push_training_enabled when 'coaching' then push_coaching_enabled when 'social' then push_social_enabled else false end
    into push_enabled from public.notification_preferences where user_id=new.user_id;
  if not coalesce(push_enabled,false) then return new;end if;
  insert into public.push_delivery_jobs(notification_id,subscription_id)
  select new.id,subscription.id from public.push_subscriptions subscription where subscription.user_id=new.user_id and subscription.enabled
  on conflict(notification_id,subscription_id) do update set status='pending',attempt_count=0,next_attempt_at=now(),last_error=null,delivered_at=null,updated_at=now();
  return new;
exception when others then return new;
end;$$;
drop trigger if exists app_notification_queue_push on public.app_notifications;
create trigger app_notification_queue_push after insert or update on public.app_notifications for each row execute function public.queue_push_delivery_jobs();

create or replace function public.materialize_due_session_reminders()
returns integer language plpgsql security definer set search_path='' as $$
declare reminder public.planned_session_push_reminders;notice_id uuid;created_count integer:=0;session_date date;
begin
  for reminder in select * from public.planned_session_push_reminders where notification_id is null and scheduled_for<=now() order by scheduled_for for update skip locked loop
    select session.session_date into session_date from public.training_sessions session where session.id=reminder.training_session_id;
    notice_id:=public.upsert_app_notification(reminder.user_id,null,'training','planned_session_reminder','Upcoming planned session','You have a planned session coming up.','training_session',reminder.training_session_id::text,'/?coachedDate='||session_date,'session-reminder:'||reminder.training_session_id||':'||extract(epoch from reminder.scheduled_for)::bigint,reminder.scheduled_for);
    update public.planned_session_push_reminders set notification_id=notice_id,updated_at=now() where id=reminder.id;
    if notice_id is not null then created_count:=created_count+1;end if;
  end loop;
  return created_count;
end;$$;

create or replace function public.claim_push_delivery_jobs(p_limit integer default 100)
returns table(job_id uuid,endpoint text,p256dh text,auth_secret text,notification_id uuid,notification_type text,target_path text)
language plpgsql security definer set search_path='' as $$
begin
  return query with claimed as (
    select job.id from public.push_delivery_jobs job join public.app_notifications notice on notice.id=job.notification_id
    join public.push_subscriptions subscription on subscription.id=job.subscription_id
    where (job.status='pending' and job.next_attempt_at<=now() or job.status='processing' and job.updated_at<now()-interval '5 minutes')
      and notice.dismissed_at is null and subscription.enabled
    order by job.next_attempt_at limit greatest(1,least(coalesce(p_limit,100),500)) for update of job skip locked
  ),updated as (
    update public.push_delivery_jobs job set status='processing',attempt_count=attempt_count+1,updated_at=now() from claimed where job.id=claimed.id returning job.*
  ) select updated.id,subscription.endpoint,subscription.p256dh,subscription.auth_secret,notice.id,notice.notification_type,notice.target_path
    from updated join public.push_subscriptions subscription on subscription.id=updated.subscription_id join public.app_notifications notice on notice.id=updated.notification_id;
end;$$;

create or replace function public.finish_push_delivery_job(p_job_id uuid,p_delivered boolean,p_permanent_failure boolean,p_error text default null)
returns void language plpgsql security definer set search_path='' as $$
declare subscription_id uuid;attempts integer;
begin
  select job.subscription_id,job.attempt_count into subscription_id,attempts from public.push_delivery_jobs job where job.id=p_job_id;
  if p_delivered then
    update public.push_delivery_jobs set status='sent',delivered_at=now(),last_error=null,updated_at=now() where id=p_job_id;
    update public.push_subscriptions set last_success_at=now(),updated_at=now() where id=subscription_id;
  else
    update public.push_delivery_jobs set status=case when p_permanent_failure or attempts>=5 then 'failed' else 'pending' end,
      next_attempt_at=now()+make_interval(mins=>least(60,power(2,greatest(1,attempts))::integer)),last_error=left(coalesce(p_error,'Push delivery failed'),500),updated_at=now() where id=p_job_id;
    update public.push_subscriptions set enabled=case when p_permanent_failure then false else enabled end,last_failure_at=now(),updated_at=now() where id=subscription_id;
  end if;
end;$$;

revoke all on function public.refresh_planned_session_push_reminder(uuid) from public,anon,authenticated;
revoke all on function public.sync_planned_session_push_reminder() from public,anon,authenticated;
revoke all on function public.queue_push_delivery_jobs() from public,anon,authenticated;
revoke all on function public.materialize_due_session_reminders() from public,anon,authenticated;
revoke all on function public.claim_push_delivery_jobs(integer) from public,anon,authenticated;
revoke all on function public.finish_push_delivery_job(uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.materialize_due_session_reminders() to service_role;
grant execute on function public.claim_push_delivery_jobs(integer) to service_role;
grant execute on function public.finish_push_delivery_job(uuid,boolean,boolean,text) to service_role;

commit;
