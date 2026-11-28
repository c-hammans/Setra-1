begin;

create or replace function public.save_coach_session_feedback(p_assignment_id uuid,p_feedback text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  assignment public.coach_training_assignments;
  relationship public.coach_client_relationships;
  occurrence public.training_plan_occurrences;
  saved_feedback_id uuid;
  coach_name text;
  clean_feedback text:=trim(coalesce(p_feedback,''));
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if char_length(clean_feedback) not between 1 and 2000 then raise exception 'Feedback must be between 1 and 2000 characters';end if;
  select * into assignment from public.coach_training_assignments where id=p_assignment_id and coach_user_id=uid;
  if assignment.id is null then raise exception 'This assigned session is unavailable';end if;
  select * into relationship from public.coach_client_relationships
    where id=assignment.relationship_id and coach_user_id=uid and client_user_id=assignment.client_user_id
      and status='active' and can_view_completed_sessions and can_provide_feedback for share;
  if relationship.id is null then raise exception 'Active feedback permission is required';end if;
  select * into occurrence from public.training_plan_occurrences
    where user_id=assignment.client_user_id and occurrence_key=assignment.occurrence_key
      and status in ('completed','partial') and linked_completion_client_id is not null;
  if occurrence.id is null then raise exception 'Feedback is only available after this session is completed';end if;
  select coalesce(nullif(display_name,''),username,'Setra coach') into coach_name from public.profiles where id=uid;

  insert into public.coach_session_feedback(assignment_id,relationship_id,coach_user_id,client_user_id,modality,completed_client_id,coach_display_name,feedback)
    values(assignment.id,relationship.id,uid,assignment.client_user_id,assignment.modality,occurrence.linked_completion_client_id,coach_name,clean_feedback)
    on conflict(assignment_id) do update set feedback=excluded.feedback,completed_client_id=excluded.completed_client_id,
      coach_display_name=excluded.coach_display_name,updated_at=now()
    where public.coach_session_feedback.coach_user_id=uid and public.coach_session_feedback.feedback is distinct from excluded.feedback
    returning id into saved_feedback_id;
  if saved_feedback_id is null then
    select id into saved_feedback_id from public.coach_session_feedback where assignment_id=assignment.id and coach_user_id=uid;
    return saved_feedback_id;
  end if;

  insert into public.coach_feedback_notifications(feedback_id,recipient_user_id,actor_user_id)
    values(saved_feedback_id,assignment.client_user_id,uid)
    on conflict(feedback_id) do update set created_at=now(),read_at=null,actor_user_id=excluded.actor_user_id;
  return saved_feedback_id;
end;
$$;

commit;
