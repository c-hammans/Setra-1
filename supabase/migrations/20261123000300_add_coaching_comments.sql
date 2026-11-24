begin;

create table if not exists public.coach_comments (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.coach_client_relationships(id) on delete restrict,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('session','weekly_review')),
  assignment_id uuid references public.coach_training_assignments(id) on delete cascade,
  week_start date,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (target_type='session' and assignment_id is not null and week_start is null)
    or (target_type='weekly_review' and assignment_id is null and week_start is not null)
  )
);

create table if not exists public.coach_comment_notifications (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null unique references public.coach_comments(id) on delete cascade,
  relationship_id uuid not null references public.coach_client_relationships(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_user_id<>actor_user_id)
);

create index if not exists coach_comments_session_idx
  on public.coach_comments(relationship_id,assignment_id,created_at);
create index if not exists coach_comments_week_idx
  on public.coach_comments(relationship_id,week_start,created_at);
create index if not exists coach_comment_notifications_recipient_idx
  on public.coach_comment_notifications(recipient_user_id,read_at,created_at desc);

alter table public.coach_comments enable row level security;
alter table public.coach_comment_notifications enable row level security;

drop policy if exists coach_comments_participant_select on public.coach_comments;
create policy coach_comments_participant_select on public.coach_comments
  for select to authenticated using (
    exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.id=relationship_id
        and (select auth.uid()) in (relationship.coach_user_id,relationship.client_user_id)
    )
  );

drop policy if exists coach_comment_notifications_recipient_select on public.coach_comment_notifications;
create policy coach_comment_notifications_recipient_select on public.coach_comment_notifications
  for select to authenticated using ((select auth.uid())=recipient_user_id);
drop policy if exists coach_comment_notifications_recipient_update on public.coach_comment_notifications;
create policy coach_comment_notifications_recipient_update on public.coach_comment_notifications
  for update to authenticated using ((select auth.uid())=recipient_user_id)
  with check ((select auth.uid())=recipient_user_id);

revoke all on public.coach_comments,public.coach_comment_notifications from anon,authenticated;
grant select on public.coach_comments,public.coach_comment_notifications to authenticated;
grant update(read_at) on public.coach_comment_notifications to authenticated;
grant all on public.coach_comments,public.coach_comment_notifications to service_role;

create or replace function public.list_coach_comments(
  p_relationship_id uuid,
  p_target_type text,
  p_assignment_id uuid default null,
  p_week_start date default null
)
returns table(
  comment_id uuid,
  author_user_id uuid,
  author_name text,
  author_avatar_url text,
  author_role text,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  can_edit boolean,
  relationship_active boolean
)
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid();relationship public.coach_client_relationships;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and uid in (coach_user_id,client_user_id);
  if relationship.id is null then raise exception 'This coaching conversation is unavailable';end if;
  if p_target_type not in ('session','weekly_review') then raise exception 'Invalid comment target';end if;
  if p_target_type='session' and not exists (
    select 1 from public.coach_training_assignments assignment
    where assignment.id=p_assignment_id and assignment.relationship_id=relationship.id
  ) then raise exception 'This coached session is unavailable';end if;
  if p_target_type='weekly_review' and p_week_start is null then raise exception 'A review week is required';end if;

  return query
  select comment.id,comment.author_user_id,
    coalesce(nullif(profile.display_name,''),profile.username,'Setra user'),
    profile.avatar_url,
    case when comment.author_user_id=relationship.coach_user_id then 'coach' else 'client' end,
    comment.body,comment.created_at,comment.updated_at,
    comment.author_user_id=uid and relationship.status='active',
    relationship.status='active'
  from public.coach_comments comment
  join public.profiles profile on profile.id=comment.author_user_id
  where comment.relationship_id=relationship.id
    and comment.target_type=p_target_type
    and (p_target_type<>'session' or comment.assignment_id=p_assignment_id)
    and (p_target_type<>'weekly_review' or comment.week_start=p_week_start)
  order by comment.created_at,comment.id;
end;$$;

create or replace function public.save_coach_comment(
  p_relationship_id uuid,
  p_target_type text,
  p_body text,
  p_assignment_id uuid default null,
  p_week_start date default null,
  p_comment_id uuid default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();relationship public.coach_client_relationships;
  clean_body text:=trim(coalesce(p_body,''));result_id uuid;recipient uuid;
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if char_length(clean_body)<1 or char_length(clean_body)>1200 then
    raise exception 'Comments must be between 1 and 1200 characters';
  end if;
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and status='active' and uid in (coach_user_id,client_user_id);
  if relationship.id is null then raise exception 'Active coaching is required to comment';end if;
  if p_target_type not in ('session','weekly_review') then raise exception 'Invalid comment target';end if;
  if p_target_type='session' and not exists (
    select 1 from public.coach_training_assignments assignment
    where assignment.id=p_assignment_id and assignment.relationship_id=relationship.id
  ) then raise exception 'This coached session is unavailable';end if;
  if p_target_type='weekly_review' and p_week_start is null then raise exception 'A review week is required';end if;

  if p_comment_id is null then
    insert into public.coach_comments(
      relationship_id,author_user_id,target_type,assignment_id,week_start,body
    ) values(
      relationship.id,uid,p_target_type,
      case when p_target_type='session' then p_assignment_id else null end,
      case when p_target_type='weekly_review' then p_week_start else null end,
      clean_body
    ) returning id into result_id;
    recipient:=case when uid=relationship.coach_user_id then relationship.client_user_id else relationship.coach_user_id end;
    insert into public.coach_comment_notifications(comment_id,relationship_id,recipient_user_id,actor_user_id)
    values(result_id,relationship.id,recipient,uid)
    on conflict(comment_id) do nothing;
  else
    update public.coach_comments comment set body=clean_body,updated_at=now()
    where comment.id=p_comment_id and comment.relationship_id=relationship.id
      and comment.author_user_id=uid and comment.target_type=p_target_type
      and (p_target_type<>'session' or comment.assignment_id=p_assignment_id)
      and (p_target_type<>'weekly_review' or comment.week_start=p_week_start)
      and comment.body is distinct from clean_body
    returning comment.id into result_id;
    if result_id is null then raise exception 'This comment could not be updated';end if;
  end if;
  return result_id;
end;$$;

create or replace function public.delete_coach_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.coach_comments comment
  using public.coach_client_relationships relationship
  where comment.id=p_comment_id and comment.author_user_id=auth.uid()
    and relationship.id=comment.relationship_id and relationship.status='active'
    and auth.uid() in (relationship.coach_user_id,relationship.client_user_id);
  if not found then raise exception 'This comment cannot be deleted';end if;
end;$$;

create or replace function public.list_coach_comment_notifications()
returns table(
  notification_id uuid,
  comment_id uuid,
  relationship_id uuid,
  actor_name text,
  actor_role text,
  target_type text,
  assignment_id uuid,
  week_start date,
  target_title text,
  occurrence_id uuid,
  created_at timestamptz,
  read_at timestamptz
)
language sql stable security definer set search_path='' as $$
  select notification.id,comment.id,comment.relationship_id,
    coalesce(nullif(profile.display_name,''),profile.username,'Setra user'),
    case when comment.author_user_id=relationship.coach_user_id then 'coach' else 'client' end,
    comment.target_type,comment.assignment_id,comment.week_start,
    case when comment.target_type='session' then coalesce(assignment.source_template_name,'Coached session') else 'Weekly review' end,
    occurrence.id,
    notification.created_at,notification.read_at
  from public.coach_comment_notifications notification
  join public.coach_comments comment on comment.id=notification.comment_id
  join public.coach_client_relationships relationship on relationship.id=comment.relationship_id
  join public.profiles profile on profile.id=comment.author_user_id
  left join public.coach_training_assignments assignment on assignment.id=comment.assignment_id
  left join public.training_plan_occurrences occurrence
    on occurrence.user_id=relationship.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
  where notification.recipient_user_id=auth.uid()
  order by notification.created_at desc
  limit 30;
$$;

revoke all on function public.list_coach_comments(uuid,text,uuid,date) from public,anon;
revoke all on function public.save_coach_comment(uuid,text,text,uuid,date,uuid) from public,anon;
revoke all on function public.delete_coach_comment(uuid) from public,anon;
revoke all on function public.list_coach_comment_notifications() from public,anon;
grant execute on function public.list_coach_comments(uuid,text,uuid,date) to authenticated;
grant execute on function public.save_coach_comment(uuid,text,text,uuid,date,uuid) to authenticated;
grant execute on function public.delete_coach_comment(uuid) to authenticated;
grant execute on function public.list_coach_comment_notifications() to authenticated;

commit;
