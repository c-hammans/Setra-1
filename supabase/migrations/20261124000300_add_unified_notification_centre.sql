begin;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  training_enabled boolean not null default true,
  coaching_enabled boolean not null default true,
  social_enabled boolean not null default true,
  awards_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  category text not null check (category in ('training','coaching','social','awards')),
  notification_type text not null check (char_length(notification_type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body)<=500),
  target_type text,
  target_id text,
  target_path text check (target_path is null or (target_path like '/%' and char_length(target_path)<=500)),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 240),
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,dedupe_key)
);

create index if not exists app_notifications_user_feed_idx on public.app_notifications(user_id,dismissed_at,created_at desc,id desc);
create index if not exists app_notifications_user_unread_idx on public.app_notifications(user_id,created_at desc) where read_at is null and dismissed_at is null;
alter table public.app_notifications replica identity full;
do $$begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='app_notifications'
  ) then alter publication supabase_realtime add table public.app_notifications;end if;
end$$;

alter table public.notification_preferences enable row level security;
alter table public.app_notifications enable row level security;
drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists app_notifications_owner_select on public.app_notifications;
create policy app_notifications_owner_select on public.app_notifications for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists app_notifications_owner_update on public.app_notifications;
create policy app_notifications_owner_update on public.app_notifications for update to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

revoke all on public.notification_preferences,public.app_notifications from anon,authenticated;
grant select,insert,update on public.notification_preferences to authenticated;
grant select on public.app_notifications to authenticated;
grant update(read_at,dismissed_at) on public.app_notifications to authenticated;
grant all on public.notification_preferences,public.app_notifications to service_role;

create or replace function public.notification_category_enabled(p_user uuid,p_category text)
returns boolean language sql stable security definer set search_path='' as $$
  select case p_category when 'training' then coalesce(pref.training_enabled,true)
    when 'coaching' then coalesce(pref.coaching_enabled,true)
    when 'social' then coalesce(pref.social_enabled,true)
    when 'awards' then coalesce(pref.awards_enabled,true) else false end
  from (select 1) seed left join public.notification_preferences pref on pref.user_id=p_user;
$$;

create or replace function public.upsert_app_notification(
  p_user uuid,p_actor uuid,p_category text,p_type text,p_title text,p_body text,
  p_target_type text,p_target_id text,p_target_path text,p_dedupe_key text,p_event_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;actor_label text;
begin
  if p_user is null or p_category not in ('training','coaching','social','awards') or not public.notification_category_enabled(p_user,p_category) then return null;end if;
  select coalesce(nullif(profile.display_name,''),profile.username,'Setra user') into actor_label from public.profiles profile where profile.id=p_actor;
  insert into public.app_notifications(user_id,actor_user_id,actor_name,category,notification_type,title,body,target_type,target_id,target_path,dedupe_key,created_at,updated_at)
  values(p_user,p_actor,actor_label,p_category,left(p_type,80),left(p_title,160),left(coalesce(p_body,''),500),p_target_type,p_target_id,p_target_path,left(p_dedupe_key,240),coalesce(p_event_at,now()),coalesce(p_event_at,now()))
  on conflict(user_id,dedupe_key) do update set actor_user_id=excluded.actor_user_id,actor_name=excluded.actor_name,
    category=excluded.category,notification_type=excluded.notification_type,title=excluded.title,body=excluded.body,
    target_type=excluded.target_type,target_id=excluded.target_id,target_path=excluded.target_path,
    created_at=case when (public.app_notifications.title,public.app_notifications.body,public.app_notifications.target_path)
      is distinct from (excluded.title,excluded.body,excluded.target_path) then excluded.created_at else public.app_notifications.created_at end,
    updated_at=excluded.updated_at,dismissed_at=null,
    read_at=case when (public.app_notifications.title,public.app_notifications.body,public.app_notifications.target_path)
      is distinct from (excluded.title,excluded.body,excluded.target_path) then null else public.app_notifications.read_at end
  returning id into result_id;
  return result_id;
end;$$;

revoke all on function public.notification_category_enabled(uuid,text) from public,anon,authenticated;
revoke all on function public.upsert_app_notification(uuid,uuid,text,text,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;

create or replace function public.list_app_notifications(p_before timestamptz default null,p_limit integer default 30)
returns table(notification_id uuid,category text,notification_type text,title text,body text,target_type text,target_id text,target_path text,actor_name text,created_at timestamptz,updated_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
  select notice.id,notice.category,notice.notification_type,notice.title,notice.body,notice.target_type,notice.target_id,notice.target_path,notice.actor_name,notice.created_at,notice.updated_at,notice.read_at
  from public.app_notifications notice where notice.user_id=auth.uid() and notice.dismissed_at is null
    and (p_before is null or notice.created_at<p_before)
  order by notice.created_at desc,notice.id desc limit greatest(1,least(coalesce(p_limit,30),50));
$$;
create or replace function public.count_unread_app_notifications()
returns bigint language sql stable security definer set search_path='' as $$
  select count(*) from public.app_notifications where user_id=auth.uid() and read_at is null and dismissed_at is null;
$$;
create or replace function public.mark_app_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.app_notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
$$;
create or replace function public.mark_all_app_notifications_read()
returns void language sql security definer set search_path='' as $$
  update public.app_notifications set read_at=now() where user_id=auth.uid() and read_at is null and dismissed_at is null;
$$;
create or replace function public.dismiss_app_notification(p_notification_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.app_notifications set dismissed_at=now(),read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid();
$$;
create or replace function public.get_notification_preferences()
returns table(training_enabled boolean,coaching_enabled boolean,social_enabled boolean,awards_enabled boolean)
language sql stable security definer set search_path='' as $$
  select coalesce(pref.training_enabled,true),coalesce(pref.coaching_enabled,true),coalesce(pref.social_enabled,true),coalesce(pref.awards_enabled,true)
  from (select 1) seed left join public.notification_preferences pref on pref.user_id=auth.uid();
$$;
create or replace function public.save_notification_preferences(p_training boolean,p_coaching boolean,p_social boolean,p_awards boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Authentication is required';end if;
  insert into public.notification_preferences(user_id,training_enabled,coaching_enabled,social_enabled,awards_enabled)
  values(auth.uid(),coalesce(p_training,true),coalesce(p_coaching,true),coalesce(p_social,true),coalesce(p_awards,true))
  on conflict(user_id) do update set training_enabled=excluded.training_enabled,coaching_enabled=excluded.coaching_enabled,
    social_enabled=excluded.social_enabled,awards_enabled=excluded.awards_enabled,updated_at=now();
end;$$;

do $$ declare signature text;begin
  foreach signature in array array['list_app_notifications(timestamptz,integer)','count_unread_app_notifications()','mark_app_notification_read(uuid)','mark_all_app_notifications_read()','dismiss_app_notification(uuid)','get_notification_preferences()','save_notification_preferences(boolean,boolean,boolean,boolean)'] loop
    execute 'revoke all on function public.'||signature||' from public,anon';
    execute 'grant execute on function public.'||signature||' to authenticated';
  end loop;
end$$;

-- Preserve existing social, feedback and comment notices without creating duplicates.
insert into public.app_notifications(user_id,actor_user_id,actor_name,category,notification_type,title,body,target_type,target_id,target_path,dedupe_key,read_at,created_at,updated_at)
select notice.recipient_user_id,notice.actor_user_id,coalesce(nullif(profile.display_name,''),profile.username,'Setra user'),'social',notice.notification_type,
  case notice.notification_type when 'friend_request' then 'New friend request' when 'friend_accepted' then 'Friend request accepted' when 'template_shared' then 'Template shared with you' else 'Workout shared with you' end,
  coalesce(nullif(profile.display_name,''),profile.username,'A Setra user'),case when notice.shared_item_id is null then 'friend_request' else 'shared_item' end,
  coalesce(notice.shared_item_id,notice.connection_id)::text,case when notice.notification_type in ('workout_shared','template_shared') then '/friends?tab=shared' else '/friends?tab=requests' end,
  'social:'||notice.id,notice.read_at,notice.created_at,notice.created_at
from public.social_notifications notice join public.profiles profile on profile.id=notice.actor_user_id
on conflict(user_id,dedupe_key) do nothing;

insert into public.app_notifications(user_id,actor_user_id,actor_name,category,notification_type,title,body,target_type,target_id,target_path,dedupe_key,read_at,created_at,updated_at)
select notice.recipient_user_id,notice.actor_user_id,feedback.coach_display_name,'coaching','coach_feedback','Coach feedback on '||assignment.source_template_name,left(feedback.feedback,500),
  'coach_feedback',feedback.id::text,'/?coachedSession='||feedback.completed_client_id||'&coachedModality='||feedback.modality,
  'coach-feedback:'||feedback.id,notice.read_at,notice.created_at,notice.created_at
from public.coach_feedback_notifications notice join public.coach_session_feedback feedback on feedback.id=notice.feedback_id
join public.coach_training_assignments assignment on assignment.id=feedback.assignment_id
on conflict(user_id,dedupe_key) do nothing;

insert into public.app_notifications(user_id,actor_user_id,actor_name,category,notification_type,title,body,target_type,target_id,target_path,dedupe_key,read_at,created_at,updated_at)
select notice.recipient_user_id,notice.actor_user_id,coalesce(nullif(profile.display_name,''),profile.username,'Setra user'),'coaching','coach_comment',
  'New comment on '||case when comment.target_type='weekly_review' then 'Weekly review' else coalesce(assignment.source_template_name,'coached session') end,left(comment.body,500),
  comment.target_type,comment.id::text,
  case when notice.recipient_user_id=relationship.client_user_id then '/coaching/progress'||case when comment.week_start is not null then '?week='||comment.week_start else '' end
    else '/coaching/'||comment.relationship_id||case when occurrence.id is not null then '?week='||occurrence.planned_date||'&session='||occurrence.id else '' end end,
  'coach-comment:'||comment.id,notice.read_at,notice.created_at,notice.created_at
from public.coach_comment_notifications notice join public.coach_comments comment on comment.id=notice.comment_id
join public.coach_client_relationships relationship on relationship.id=comment.relationship_id
join public.profiles profile on profile.id=notice.actor_user_id left join public.coach_training_assignments assignment on assignment.id=comment.assignment_id
left join public.training_plan_occurrences occurrence on occurrence.user_id=relationship.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
on conflict(user_id,dedupe_key) do nothing;

create or replace function public.sync_social_app_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare profile_name text;begin
  select coalesce(nullif(display_name,''),username,'Setra user') into profile_name from public.profiles where id=new.actor_user_id;
  perform public.upsert_app_notification(new.recipient_user_id,new.actor_user_id,'social',new.notification_type,
    case new.notification_type when 'friend_request' then 'New friend request' when 'friend_accepted' then 'Friend request accepted' when 'template_shared' then 'Template shared with you' else 'Workout shared with you' end,
    profile_name,case when new.shared_item_id is null then 'friend_request' else 'shared_item' end,coalesce(new.shared_item_id,new.connection_id)::text,
    case when new.notification_type in ('workout_shared','template_shared') then '/friends?tab=shared' else '/friends?tab=requests' end,'social:'||new.id,new.created_at);return new;end;$$;
drop trigger if exists social_notifications_sync_app on public.social_notifications;
create trigger social_notifications_sync_app after insert on public.social_notifications for each row execute function public.sync_social_app_notification();

create or replace function public.sync_feedback_app_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare feedback public.coach_session_feedback;assignment public.coach_training_assignments;begin
  select * into feedback from public.coach_session_feedback where id=new.feedback_id;select * into assignment from public.coach_training_assignments where id=feedback.assignment_id;
  perform public.upsert_app_notification(new.recipient_user_id,new.actor_user_id,'coaching','coach_feedback','Coach feedback on '||assignment.source_template_name,left(feedback.feedback,500),
    'coach_feedback',feedback.id::text,'/?coachedSession='||feedback.completed_client_id||'&coachedModality='||feedback.modality,'coach-feedback:'||feedback.id,new.created_at);return new;end;$$;
drop trigger if exists coach_feedback_notifications_sync_app on public.coach_feedback_notifications;
create trigger coach_feedback_notifications_sync_app after insert or update of created_at on public.coach_feedback_notifications for each row execute function public.sync_feedback_app_notification();

create or replace function public.sync_comment_app_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare comment public.coach_comments;relationship public.coach_client_relationships;assignment public.coach_training_assignments;occurrence public.training_plan_occurrences;path text;begin
  select * into comment from public.coach_comments where id=new.comment_id;select * into relationship from public.coach_client_relationships where id=comment.relationship_id;
  if comment.assignment_id is not null then select * into assignment from public.coach_training_assignments where id=comment.assignment_id;select * into occurrence from public.training_plan_occurrences where user_id=relationship.client_user_id and occurrence_key=assignment.occurrence_key;end if;
  path:=case when new.recipient_user_id=relationship.client_user_id then '/coaching/progress'||case when comment.week_start is not null then '?week='||comment.week_start else '' end
    else '/coaching/'||comment.relationship_id||case when occurrence.id is not null then '?week='||occurrence.planned_date||'&session='||occurrence.id else '' end end;
  perform public.upsert_app_notification(new.recipient_user_id,new.actor_user_id,'coaching','coach_comment','New comment on '||case when comment.target_type='weekly_review' then 'Weekly review' else coalesce(assignment.source_template_name,'coached session') end,left(comment.body,500),
    comment.target_type,comment.id::text,path,'coach-comment:'||comment.id,new.created_at);return new;end;$$;
drop trigger if exists coach_comment_notifications_sync_app on public.coach_comment_notifications;
create trigger coach_comment_notifications_sync_app after insert on public.coach_comment_notifications for each row execute function public.sync_comment_app_notification();

create or replace function public.notify_coaching_relationship() returns trigger language plpgsql security definer set search_path='' as $$
declare coach_name text;client_name text;begin
  select coalesce(nullif(display_name,''),username,'A coach') into coach_name from public.profiles where id=new.coach_user_id;
  select coalesce(nullif(display_name,''),username,'Your athlete') into client_name from public.profiles where id=new.client_user_id;
  if tg_op='INSERT' and new.status='pending' then perform public.upsert_app_notification(new.client_user_id,new.coach_user_id,'coaching','coach_invite','Coaching invitation',coach_name||' invited you to connect','coach_relationship',new.id::text,'/coaching','coach-invite:'||new.id,new.created_at);
  elsif tg_op='UPDATE' and old.status='pending' and new.status='active' then perform public.upsert_app_notification(new.coach_user_id,new.client_user_id,'coaching','coach_relationship_accepted','Coaching invitation accepted',client_name||' is now an active client','coach_relationship',new.id::text,'/coaching','coach-accepted:'||new.id,new.updated_at);end if;return new;end;$$;
drop trigger if exists coach_relationship_notify_app on public.coach_client_relationships;
create trigger coach_relationship_notify_app after insert or update of status on public.coach_client_relationships for each row execute function public.notify_coaching_relationship();

create or replace function public.notify_coach_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and old.client_program_id is null and new.client_program_id is not null then delete from public.app_notifications where user_id=new.client_user_id and dedupe_key='coach-assignment:'||new.id;return new;end if;
  if new.client_program_id is not null then return new;end if;
  if tg_op='INSERT' or new.assigned_date is distinct from old.assigned_date or new.source_template_name is distinct from old.source_template_name then
    perform public.upsert_app_notification(new.client_user_id,new.coach_user_id,'training',case when tg_op='INSERT' then 'workout_assigned' else 'planned_session_changed' end,
      case when tg_op='INSERT' then 'Workout assigned' else 'Planned session updated' end,new.source_template_name||' · '||to_char(new.assigned_date,'Dy DD Mon'),
      'coach_assignment',new.id::text,'/?coachedDate='||new.assigned_date,'coach-assignment:'||new.id,case when tg_op='INSERT' then new.created_at else now() end);end if;return new;end;$$;
drop trigger if exists coach_assignment_notify_app on public.coach_training_assignments;
create trigger coach_assignment_notify_app after insert or update of assigned_date,source_template_name,client_program_id on public.coach_training_assignments for each row execute function public.notify_coach_assignment();

create or replace function public.notify_client_program() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or (tg_op='UPDATE' and (new.name,new.start_date,new.end_date,new.status) is distinct from (old.name,old.start_date,old.end_date,old.status)) then
    perform public.upsert_app_notification(new.client_user_id,new.coach_user_id,'training',case when tg_op='INSERT' then 'program_assigned' else 'program_updated' end,
      case when tg_op='INSERT' then 'Training program assigned' else 'Training program updated' end,new.name||' · '||new.duration_weeks||' weeks',
      'client_program',new.id::text,'/coaching/progress','client-program:'||new.id,case when tg_op='INSERT' then new.created_at else now() end);end if;return new;end;$$;
drop trigger if exists client_program_notify_app on public.client_programs;
create trigger client_program_notify_app after insert or update of name,start_date,end_date,status on public.client_programs for each row execute function public.notify_client_program();

create or replace function public.notify_weekly_review() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.upsert_app_notification(new.client_user_id,new.coach_user_id,'training','weekly_review','Weekly review available',left(new.note,500),'weekly_review',new.id::text,
  '/coaching/progress?week='||new.week_start,'weekly-review:'||new.relationship_id||':'||new.week_start,coalesce(new.updated_at,new.created_at));return new;end;$$;
drop trigger if exists weekly_review_notify_app on public.coach_weekly_review_notes;
create trigger weekly_review_notify_app after insert or update of note on public.coach_weekly_review_notes for each row execute function public.notify_weekly_review();

create or replace function public.notify_athlete_checkin() returns trigger language plpgsql security definer set search_path='' as $$
declare relationship public.coach_client_relationships;occurrence public.training_plan_occurrences;assignment public.coach_training_assignments;athlete_name text;rpe numeric;begin
  select coalesce(nullif(display_name,''),username,'Your athlete') into athlete_name from public.profiles where id=new.user_id;
  select * into occurrence from public.training_plan_occurrences where user_id=new.user_id and linked_completion_client_id=new.completed_client_id order by completed_at desc nulls last limit 1;
  select * into assignment from public.coach_training_assignments where client_user_id=new.user_id and occurrence_key=occurrence.occurrence_key;
  rpe:=new.session_rpe;if rpe is null and new.modality='endurance' then select completed_rpe into rpe from public.training_sessions where user_id=new.user_id and client_id=new.completed_client_id;end if;
  for relationship in select * from public.coach_client_relationships where client_user_id=new.user_id and status='active' and can_view_completed_sessions loop
    perform public.upsert_app_notification(relationship.coach_user_id,new.user_id,'coaching',case when new.session_feel='harder' or rpe>=9 then 'client_attention' else 'athlete_checkin' end,
      case when new.session_feel='harder' or rpe>=9 then 'Athlete check-in to review' else 'Athlete check-in submitted' end,athlete_name||case when new.session_feel='harder' then ' · Harder than expected' when rpe is not null then ' · RPE '||rpe else '' end,
      'athlete_checkin',new.id::text,'/coaching/'||relationship.id||case when occurrence.id is not null then '?week='||occurrence.planned_date||'&session='||occurrence.id else '' end,
      'athlete-checkin:'||relationship.id||':'||new.id,new.updated_at);end loop;return new;end;$$;
drop trigger if exists athlete_checkin_notify_app on public.athlete_session_checkins;
create trigger athlete_checkin_notify_app after insert or update of session_rpe,session_feel,athlete_comment on public.athlete_session_checkins for each row execute function public.notify_athlete_checkin();

create or replace function public.notify_achievement() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.upsert_app_notification(new.user_id,null,'awards','award_earned','New award earned',replace(initcap(replace(new.achievement_id,'_',' ')),'Km','km'),'achievement',new.achievement_id,'/awards','achievement:'||new.achievement_id,new.earned_at);return new;end;$$;
drop trigger if exists achievement_notify_app on public.user_achievements;
create trigger achievement_notify_app after insert on public.user_achievements for each row execute function public.notify_achievement();

revoke all on function public.sync_social_app_notification() from public,anon,authenticated;
revoke all on function public.sync_feedback_app_notification() from public,anon,authenticated;
revoke all on function public.sync_comment_app_notification() from public,anon,authenticated;
revoke all on function public.notify_coaching_relationship() from public,anon,authenticated;
revoke all on function public.notify_coach_assignment() from public,anon,authenticated;
revoke all on function public.notify_client_program() from public,anon,authenticated;
revoke all on function public.notify_weekly_review() from public,anon,authenticated;
revoke all on function public.notify_athlete_checkin() from public,anon,authenticated;
revoke all on function public.notify_achievement() from public,anon,authenticated;

commit;
