begin;

-- Atomically replaces one user's strength schedule. The advisory lock prevents
-- two tabs/devices from interleaving delete/insert cycles for the same account.
create or replace function public.replace_strength_schedule(p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb)) <> 'array' then raise exception 'Schedule must be an array'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text,0));

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) item
    left join public.workout_templates template
      on template.user_id=current_user_id and template.client_id=item->>'templateId'
    where template.id is null or coalesce(item->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ) then raise exception 'Schedule contains an invalid template or date'; end if;

  update public.training_plan_occurrences occurrence
  set status='cancelled',updated_at=now()
  where occurrence.user_id=current_user_id
    and occurrence.modality='strength'
    and occurrence.status='planned'
    and occurrence.planned_date>current_date
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) item
      where occurrence.occurrence_key='strength:'||(item->>'templateId')||':'||(item->>'date')
    );

  delete from public.scheduled_workouts where user_id=current_user_id;

  insert into public.scheduled_workouts(user_id,template_id,scheduled_date,skipped)
  select current_user_id,template.id,(item->>'date')::date,coalesce((item->>'skipped')::boolean,false)
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) item
  join public.workout_templates template on template.user_id=current_user_id and template.client_id=item->>'templateId'
  on conflict(user_id,template_id,scheduled_date) do update set skipped=excluded.skipped;

  insert into public.training_plan_occurrences(user_id,occurrence_key,modality,source_client_id,planned_date,status)
  select current_user_id,'strength:'||(item->>'templateId')||':'||(item->>'date'),'strength',item->>'templateId',(item->>'date')::date,
    case when coalesce((item->>'skipped')::boolean,false) then 'skipped' else 'planned' end
  from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) item
  on conflict(user_id,occurrence_key) do update set
    planned_date=excluded.planned_date,
    status=excluded.status,
    updated_at=now()
  where public.training_plan_occurrences.status<>'completed';
end;
$$;

revoke all on function public.replace_strength_schedule(jsonb) from public,anon;
grant execute on function public.replace_strength_schedule(jsonb) to authenticated;

commit;
