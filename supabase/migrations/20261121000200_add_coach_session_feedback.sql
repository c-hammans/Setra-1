begin;

create table if not exists public.coach_session_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.coach_training_assignments(id) on delete cascade,
  relationship_id uuid not null references public.coach_client_relationships(id) on delete restrict,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  client_user_id uuid not null references auth.users(id) on delete cascade,
  modality text not null check (modality in ('strength','endurance')),
  completed_client_id text not null check (char_length(completed_client_id) between 1 and 220),
  coach_display_name text not null check (char_length(coach_display_name) between 1 and 120),
  feedback text not null check (char_length(trim(feedback)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id),
  check (coach_user_id <> client_user_id)
);

create table if not exists public.coach_feedback_notifications (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null unique references public.coach_session_feedback(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_user_id <> actor_user_id)
);

create index if not exists coach_session_feedback_client_idx
  on public.coach_session_feedback(client_user_id,updated_at desc);
create index if not exists coach_session_feedback_coach_idx
  on public.coach_session_feedback(coach_user_id,updated_at desc);
create index if not exists coach_feedback_notifications_recipient_idx
  on public.coach_feedback_notifications(recipient_user_id,read_at,created_at desc);

alter table public.coach_session_feedback enable row level security;
alter table public.coach_feedback_notifications enable row level security;

-- Existing Coach MVP relationships already consented to assigned training and
-- completed-session access. Extend that same active permission set to feedback.
update public.coach_client_relationships
set can_provide_feedback=true,updated_at=now()
where status='active'
  and can_view_completed_sessions
  and can_assign_training
  and not can_provide_feedback;

drop policy if exists coach_session_feedback_client_select on public.coach_session_feedback;
create policy coach_session_feedback_client_select on public.coach_session_feedback
  for select to authenticated using ((select auth.uid())=client_user_id);
drop policy if exists coach_session_feedback_active_coach_select on public.coach_session_feedback;
create policy coach_session_feedback_active_coach_select on public.coach_session_feedback
  for select to authenticated using (
    (select auth.uid())=coach_user_id and exists (
      select 1 from public.coach_client_relationships relationship
      where relationship.id=relationship_id
        and relationship.status='active'
        and relationship.coach_user_id=(select auth.uid())
        and relationship.client_user_id=client_user_id
        and relationship.can_view_completed_sessions
    )
  );
drop policy if exists coach_feedback_notifications_recipient_select on public.coach_feedback_notifications;
create policy coach_feedback_notifications_recipient_select on public.coach_feedback_notifications
  for select to authenticated using ((select auth.uid())=recipient_user_id);
drop policy if exists coach_feedback_notifications_recipient_update on public.coach_feedback_notifications;
create policy coach_feedback_notifications_recipient_update on public.coach_feedback_notifications
  for update to authenticated using ((select auth.uid())=recipient_user_id)
  with check ((select auth.uid())=recipient_user_id);

revoke all on public.coach_session_feedback,public.coach_feedback_notifications from anon,authenticated;
grant select on public.coach_session_feedback,public.coach_feedback_notifications to authenticated;
grant update(read_at) on public.coach_feedback_notifications to authenticated;
grant all on public.coach_session_feedback,public.coach_feedback_notifications to service_role;

create or replace function public.set_coaching_mvp_permissions(p_relationship_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.coach_client_relationships
  set can_view_planned_sessions=p_enabled,
      can_view_completed_sessions=p_enabled,
      can_assign_training=p_enabled,
      can_provide_feedback=p_enabled,
      updated_at=now()
  where id=p_relationship_id and client_user_id=auth.uid() and status='active';
  if not found then raise exception 'This coaching relationship is unavailable';end if;
end;$$;

create or replace function public.respond_coach_client_invite(p_relationship_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid();relationship public.coach_client_relationships;
begin
  select * into relationship from public.coach_client_relationships
  where id=p_relationship_id and client_user_id=current_user_id and status='pending' for update;
  if relationship.id is null then raise exception 'This coaching invitation is unavailable';end if;
  if p_accept and public.coaching_pair_is_blocked(relationship.coach_user_id,current_user_id) then raise exception 'This account is unavailable';end if;
  update public.coach_client_relationships set
    status=case when p_accept then 'active' else 'declined' end,
    responded_at=now(),accepted_at=case when p_accept then now() else null end,
    ended_at=case when p_accept then null else now() end,
    can_view_planned_sessions=p_accept,
    can_view_completed_sessions=p_accept,
    can_assign_training=p_accept,
    can_provide_feedback=p_accept,
    updated_at=now()
  where id=p_relationship_id;
end;$$;

create or replace function public.save_coach_session_feedback(p_assignment_id uuid,p_feedback text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();assignment public.coach_training_assignments;relationship public.coach_client_relationships;
  occurrence public.training_plan_occurrences;feedback_id uuid;coach_name text;clean_feedback text:=trim(coalesce(p_feedback,''));
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if char_length(clean_feedback)<1 or char_length(clean_feedback)>2000 then raise exception 'Feedback must be between 1 and 2000 characters';end if;
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  select * into relationship from public.coach_client_relationships
  where id=assignment.relationship_id and coach_user_id=uid and client_user_id=assignment.client_user_id
    and status='active' and can_view_completed_sessions and can_provide_feedback;
  if relationship.id is null then raise exception 'Active feedback permission is required';end if;
  select * into occurrence from public.training_plan_occurrences
  where user_id=assignment.client_user_id and occurrence_key=assignment.occurrence_key
    and status in ('completed','partial') and linked_completion_client_id is not null;
  if occurrence.id is null then raise exception 'Feedback is only available after this session is completed';end if;
  select coalesce(nullif(display_name,''),username,'Setra coach') into coach_name from public.profiles where id=uid;

  insert into public.coach_session_feedback(assignment_id,relationship_id,coach_user_id,client_user_id,modality,completed_client_id,coach_display_name,feedback)
  values(assignment.id,relationship.id,uid,assignment.client_user_id,assignment.modality,occurrence.linked_completion_client_id,coach_name,clean_feedback)
  on conflict(assignment_id) do update set
    feedback=excluded.feedback,
    completed_client_id=excluded.completed_client_id,
    coach_display_name=excluded.coach_display_name,
    updated_at=now()
  where public.coach_session_feedback.coach_user_id=uid
    and public.coach_session_feedback.feedback is distinct from excluded.feedback
  returning id into feedback_id;

  if feedback_id is null then
    select id into feedback_id from public.coach_session_feedback where assignment_id=assignment.id and coach_user_id=uid;
    return feedback_id;
  end if;

  insert into public.coach_feedback_notifications(feedback_id,recipient_user_id,actor_user_id)
  values(feedback_id,assignment.client_user_id,uid)
  on conflict(feedback_id) do update set created_at=now(),read_at=null,actor_user_id=excluded.actor_user_id;
  return feedback_id;
end;$$;

create or replace function public.delete_coach_session_feedback(p_feedback_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.coach_session_feedback feedback
  using public.coach_client_relationships relationship
  where feedback.id=p_feedback_id
    and feedback.coach_user_id=auth.uid()
    and relationship.id=feedback.relationship_id
    and relationship.status='active'
    and relationship.coach_user_id=auth.uid()
    and relationship.client_user_id=feedback.client_user_id
    and relationship.can_view_completed_sessions
    and relationship.can_provide_feedback;
  if not found then raise exception 'This feedback cannot be deleted';end if;
end;$$;

create or replace function public.list_coach_feedback_notifications()
returns table(notification_id uuid,feedback_id uuid,coach_display_name text,session_title text,session_date date,modality text,completed_client_id text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
  select notification.id,feedback.id,feedback.coach_display_name,assignment.source_template_name,assignment.assigned_date,
    feedback.modality,feedback.completed_client_id,notification.created_at,notification.read_at
  from public.coach_feedback_notifications notification
  join public.coach_session_feedback feedback on feedback.id=notification.feedback_id
  join public.coach_training_assignments assignment on assignment.id=feedback.assignment_id
  where notification.recipient_user_id=auth.uid()
  order by notification.created_at desc limit 20;
$$;

create or replace function public.list_coach_client_session_feedback(p_relationship_id uuid,p_anchor date default current_date)
returns table(occurrence_id uuid,assignment_id uuid,feedback_id uuid,feedback text,coach_display_name text,created_at timestamptz,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare active_relationship public.coach_client_relationships;week_start date;
begin
  select * into active_relationship from public.coach_client_relationships
  where id=p_relationship_id and coach_user_id=auth.uid() and status='active' and can_view_completed_sessions;
  if active_relationship.id is null then raise exception 'Active completed-session permission is required';end if;
  select p_anchor-(((extract(dow from p_anchor)::integer-coalesce(profile.week_starts_on,1)+7)%7))
  into week_start from public.profiles profile where profile.id=active_relationship.client_user_id;
  return query
    select occurrence.id,assignment.id,session_feedback.id,session_feedback.feedback,session_feedback.coach_display_name,session_feedback.created_at,session_feedback.updated_at
    from public.coach_training_assignments assignment
    join public.training_plan_occurrences occurrence
      on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
    left join public.coach_session_feedback session_feedback on session_feedback.assignment_id=assignment.id
    where assignment.relationship_id=active_relationship.id
      and occurrence.status in ('completed','partial')
      and occurrence.planned_date between week_start and week_start+6;
end;$$;

revoke all on function public.set_coaching_mvp_permissions(uuid,boolean) from public,anon;
revoke all on function public.respond_coach_client_invite(uuid,boolean) from public,anon;
revoke all on function public.save_coach_session_feedback(uuid,text) from public,anon;
revoke all on function public.delete_coach_session_feedback(uuid) from public,anon;
revoke all on function public.list_coach_feedback_notifications() from public,anon;
revoke all on function public.list_coach_client_session_feedback(uuid,date) from public,anon;
grant execute on function public.set_coaching_mvp_permissions(uuid,boolean) to authenticated;
grant execute on function public.respond_coach_client_invite(uuid,boolean) to authenticated;
grant execute on function public.save_coach_session_feedback(uuid,text) to authenticated;
grant execute on function public.delete_coach_session_feedback(uuid) to authenticated;
grant execute on function public.list_coach_feedback_notifications() to authenticated;
grant execute on function public.list_coach_client_session_feedback(uuid,date) to authenticated;

commit;
