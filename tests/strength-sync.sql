-- Only run on an isolated database. All fixtures roll back.
begin;
do $test$
declare
  athlete uuid:=gen_random_uuid();
  template jsonb:='{"id":"sync-strength-template","name":"Sync strength","exercises":[]}';
  draft jsonb;
  planned_key text:='strength:sync-strength-template:'||current_date::text;
  duplicate_rejected boolean:=false;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(athlete,'strength-sync@example.com','{}');
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform public.save_strength_template_v2(template,'audit-template-operation',0);
  perform public.replace_strength_schedule_v2(
    jsonb_build_array(jsonb_build_object('templateId','sync-strength-template','date',current_date)),
    'audit-schedule-operation',0);
  draft:=jsonb_build_object('id','training-device-a','templateId','sync-strength-template',
    'date',current_date,'name','Sync strength','exercises','[]'::jsonb);
  if public.save_strength_workout_v2(draft,'completed','audit-operation-a',0)<>1
     or public.save_strength_workout_v2(draft,'completed','audit-operation-a',0)<>1 then
    raise exception 'Completion replay no longer idempotent';
  end if;
  begin
    perform public.save_strength_workout_v2(draft||'{"id":"training-device-b"}','completed','audit-operation-b',0);
  exception when raise_exception then
    if sqlerrm not like 'WRITE_CONFLICT:%' then raise;end if;
    duplicate_rejected:=true;
  end;
  if not duplicate_rejected
     or (select count(*) from public.workouts where user_id=athlete and status='completed')<>1
     or (select linked_completion_client_id from public.training_plan_occurrences where user_id=athlete and occurrence_key=planned_key)<>'training-device-a'
     or exists(select 1 from public.client_write_operations where user_id=athlete and operation_id='audit-operation-b') then
    raise exception 'Duplicate completion was written, changed the occurrence or acknowledged the losing operation';
  end if;
  if public.save_strength_workout_v2(draft||'{"note":"Real edit"}','completed','audit-operation-edit',1)<>2 then
    raise exception 'Editing the winning completion was blocked';
  end if;
end;
$test$;
rollback;
