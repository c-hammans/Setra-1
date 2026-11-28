begin;

-- Qualify the relationship status to distinguish it from the returned status column.
create or replace function public.list_coach_client_programs(p_relationship_id uuid,p_anchor date default current_date)
returns table(client_program_id uuid,name text,description text,focus text,duration_weeks smallint,start_date date,end_date date,status text,note text,current_week integer,total_sessions bigint,completed_sessions bigint,planned_sessions bigint)
language plpgsql security definer set search_path='' as $$
declare relationship public.coach_client_relationships;
begin
  select client_relationship.* into relationship
    from public.coach_client_relationships as client_relationship
    where client_relationship.id=p_relationship_id
      and client_relationship.coach_user_id=auth.uid()
      and client_relationship.status='active'
      and (client_relationship.can_view_planned_sessions or client_relationship.can_view_completed_sessions);
  if relationship.id is null then raise exception 'Active client permission is required';end if;
  update public.client_programs instance set status='completed'
    where instance.relationship_id=relationship.id and instance.status='active' and p_anchor>instance.end_date
      and not exists(select 1 from public.coach_training_assignments assignment join public.training_plan_occurrences occurrence on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key where assignment.client_program_id=instance.id and occurrence.status='planned');
  return query
    select instance.id,instance.name,instance.description,instance.focus,instance.duration_weeks,instance.start_date,instance.end_date,instance.status,instance.note,
      least(instance.duration_weeks::integer,greatest(1,((p_anchor-instance.start_date)/7)+1)),
      count(assignment.id),count(assignment.id) filter(where occurrence.status in ('completed','partial')),
      count(assignment.id) filter(where occurrence.status='planned')
    from public.client_programs instance
    left join public.coach_training_assignments assignment on assignment.client_program_id=instance.id
    left join public.training_plan_occurrences occurrence on occurrence.user_id=assignment.client_user_id and occurrence.occurrence_key=assignment.occurrence_key
    where instance.relationship_id=relationship.id
    group by instance.id order by case instance.status when 'active' then 0 when 'completed' then 1 else 2 end,instance.start_date desc;
end;$$;

commit;
