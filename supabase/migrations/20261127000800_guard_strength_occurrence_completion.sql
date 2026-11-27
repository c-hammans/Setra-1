begin;

create or replace function public.save_strength_workout_v2(
  p_workout jsonb,p_status text,p_operation_id text,p_expected_version bigint
) returns bigint
language plpgsql security definer set search_path='' as $$
declare
  claim record;
  uid uuid:=auth.uid();
  linked_id text;
begin
  select * into claim from public.claim_client_write_v2(
    'workout:'||(p_workout->>'id'),p_operation_id,md5(p_workout::text||':'||p_status),
    p_expected_version,p_status='completed',false);
  if not claim.apply_write then return claim.server_version;end if;

  if p_status='completed' and nullif(p_workout->>'templateId','') is not null then
    -- Different clients may start separate draft IDs for the same planned session.
    -- Serialise completion on the occurrence, not just on the workout ID.
    select linked_completion_client_id into linked_id from public.training_plan_occurrences
      where user_id=uid and modality='strength'
        and occurrence_key='strength:'||(p_workout->>'templateId')||':'||((p_workout->>'date')::date)::text
      for update;
    if linked_id is distinct from p_workout->>'id' and exists(
      select 1 from public.workouts where user_id=uid and client_id=linked_id and status='completed'
    ) then
      raise exception 'WRITE_CONFLICT: this planned strength session already has a recorded completion';
    end if;
  end if;

  perform public.save_strength_workout_revisioned_body(p_workout,p_status);
  return claim.server_version;
end;
$$;

commit;
