-- Run only on an isolated, migrated test database. No rows are retained.
begin;
do $test$
declare
  uid uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); rid uuid;
  run_id uuid; strength_id uuid; coach_id uuid; ride_id uuid; coach_user uuid:=gen_random_uuid(); sample date:=current_date+5;
  p jsonb; strength jsonb; run jsonb; a jsonb; b jsonb; result jsonb; changed jsonb; initial jsonb; kind text; value jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(uid,'adaptive-test@example.com','{}'),(outsider,'free-test@example.com','{}'),(coach_user,'coach-test@example.com','{}');
  update public.profiles set individual_plan='adaptive',timezone='UTC' where id=uid;
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  insert into public.exercises(id,owner_id,name,muscle_group,equipment) values('test-back-squat',uid,'Test Back Squat','Quads','Barbell');
  perform public.save_strength_template_v2('{"id":"test-strength","name":"Test squat","exercises":[{"exerciseId":"test-back-squat","sets":4,"reps":"6","plannedLoad":{"mode":"kg","value":"80"}}]}','test-template',0);
  perform public.replace_strength_schedule_v2(jsonb_build_array(jsonb_build_object('templateId','test-strength','date',sample)),'test-schedule',0);
  initial:=jsonb_build_object('id','test-run','activityType','run','status','planned','title','Nested intervals','date',sample+1,'blocks',
    '[{"id":"outer","type":"repeat_group","title":"Main repeat","repetitions":4},{"id":"inner","parentId":"outer","type":"repeat_group","title":"Inner repeat","repetitions":2},{"id":"step","parentId":"inner","type":"interval","title":"400 m","completionType":"distance","distanceMetres":400}]'::jsonb);
  perform public.save_endurance_session_v2(initial,'test-run-write',0);
  select id into strength_id from public.training_plan_occurrences where user_id=uid and modality='strength';
  select id into run_id from public.training_plan_occurrences where user_id=uid and modality='endurance';
  strength:=public.adaptive_plan_snapshot(uid,strength_id); run:=public.adaptive_plan_snapshot(uid,run_id);
  if strength is null or run is null then raise exception 'Expected canonical snapshots';end if;
  if public.adaptive_plan_snapshot(outsider,run_id) is not null then raise exception 'Foreign snapshot leaked';end if;
  if public.adaptive_plan_today(outsider) is not null then raise exception 'Free access leaked';end if;
  if has_function_privilege('authenticated','public.change_adaptive_plan(uuid,uuid,text,jsonb)','EXECUTE') then raise exception 'Browser can execute mutation RPC';end if;
  if has_table_privilege('authenticated','public.adaptive_plan_proposals','UPDATE') then raise exception 'Browser can edit proposals';end if;

  a:=jsonb_build_object('id','strength','session',strength-'payload','field',(select x from jsonb_array_elements(strength->'fields') x where x->>'key'='exercise:0:load'), 'proposed',82.5,'min',80.25,'max',82.5,'step',0.25);
  b:=jsonb_build_object('id','intervals','session',run-'payload','field',(select x from jsonb_array_elements(run->'fields') x where x->>'key'='block:0:repetitions'), 'proposed',3,'min',3,'max',3,'step',1);
  p:=public.claim_adaptive_plan_proposal(uid,'review',gen_random_uuid(),'atomic','Check in','["Existing training evidence"]');
  rid:=(p->'proposal'->>'id')::uuid;
  update public.adaptive_plan_proposals set status='proposed',options=jsonb_build_array(a,b) where id=rid;
  changed:=jsonb_build_array(jsonb_build_object('option',a,'value',81.25),jsonb_build_object('option',b,'value',3));
  result:=public.change_adaptive_plan(uid,rid,'apply',changed);
  if result->>'status'<>'applied' or result->'outcomes'->0 is null then raise exception 'Atomic application failed';end if;
  if public.adaptive_plan_snapshot(uid,run_id)#>>'{payload,blocks,2,parentId}'<>'inner'
    or public.adaptive_plan_snapshot(uid,run_id)#>>'{payload,blocks,1,parentId}'<>'outer'
    or public.adaptive_plan_snapshot(uid,run_id)#>>'{payload,blocks,0,repetitions}'<>'3' then raise exception 'Nested structure changed';end if;
  if not exists(select 1 from public.template_exercises e join public.workout_templates t on t.id=e.template_id where t.user_id=uid and e.planned_load_value=80) then raise exception 'Reusable template was edited';end if;
  if public.adaptive_plan_snapshot(uid,strength_id)#>>'{payload,values,exercise:0:load}'<>'81.25' then raise exception 'Accepted edit was lost';end if;
  if public.change_adaptive_plan(uid,rid,'apply','[]')->>'applied_at'<>result->>'applied_at' then raise exception 'Application was not idempotent';end if;
  result:=public.change_adaptive_plan(uid,rid,'undo','[]');
  if result->>'status'<>'reverted' or public.adaptive_plan_snapshot(uid,run_id)#>>'{payload,blocks,0,repetitions}'<>'4' then raise exception 'Undo failed';end if;

  run:=public.adaptive_plan_snapshot(uid,run_id);
  b:=jsonb_build_object('id','move','session',run-'payload','field',jsonb_build_object('key','date','value',sample+1),'proposed',sample+8);
  insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence,options)
    values(uid,'ask',gen_random_uuid(),'move','proposed','Move the run','[]',jsonb_build_array(b)) returning id into rid;
  changed:=jsonb_build_array(jsonb_build_object('option',b,'value',sample+9));
  result:=public.change_adaptive_plan(uid,rid,'apply',changed);
  if result->>'status'<>'applied' or public.adaptive_plan_snapshot(uid,run_id)->>'date'<>(sample+9)::text then raise exception 'Move did not preserve session ID';end if;
  perform public.save_endurance_session_v2(initial||jsonb_build_object('date',sample+9,'title','Later manual change'),'manual-edit',
    (public.adaptive_plan_snapshot(uid,run_id)->>'version')::bigint);
  begin
    perform public.change_adaptive_plan(uid,rid,'undo','[]');
    raise exception 'Undo overwrote a later edit';
  exception when sqlstate 'P0409' then null;end;

  insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence,options)
    values(uid,'ask',gen_random_uuid(),'stale','proposed','Old preview','[]',jsonb_build_array(b)) returning id into rid;
  begin
    perform public.change_adaptive_plan(uid,rid,'apply',changed);
    raise exception 'Accepted stale prescription';
  exception when sqlstate 'P0409' then null;end;
  if public.change_adaptive_plan(uid,rid,'decline','[]')->>'status'<>'declined' then raise exception 'Decline did not persist';end if;
  begin
    perform public.change_adaptive_plan(outsider,rid,'decline','[]');
    raise exception 'Unauthorised user changed a proposal';
  exception when raise_exception then if sqlerrm<>'Adaptive access is required' then raise;end if;end;

  strength:=public.adaptive_plan_snapshot(uid,strength_id);
  a:=jsonb_build_object('id','strength-move','session',strength-'payload','field',jsonb_build_object('key','date','value',sample),'proposed',sample+2);
  insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence,options)
    values(uid,'ask',gen_random_uuid(),'strength-move','proposed','Move strength','[]',jsonb_build_array(a)) returning id into rid;
  result:=public.change_adaptive_plan(uid,rid,'apply',jsonb_build_array(jsonb_build_object('option',a,'value',sample+2)));
  if public.adaptive_plan_snapshot(uid,strength_id)->>'date'<>(sample+2)::text then raise exception 'Strength move lost occurrence ID';end if;
  result:=public.change_adaptive_plan(uid,rid,'undo','[]');
  if public.adaptive_plan_snapshot(uid,strength_id)->>'date'<>sample::text then raise exception 'Strength move undo failed';end if;

  perform public.save_endurance_session_v2(jsonb_build_object('id','test-ride','activityType','bike','status','planned','title','Easy bike',
    'date',sample+12,'plannedDurationMinutes',30,'targetRpe',4,'blocks','[]'::jsonb),'new-ride',0);
  select id into ride_id from public.training_plan_occurrences where user_id=uid and occurrence_key='endurance:test-ride';
  foreach kind in array array['replace','remove','add'] loop
    run:=public.adaptive_plan_snapshot(uid,ride_id);
    value:=case kind when 'replace' then to_jsonb('Short easy ride'::text) when 'remove' then to_jsonb('Cancel session'::text) else to_jsonb(sample+16) end;
    b:=jsonb_build_object('id',kind,'session',run-'payload','field',jsonb_build_object('key',kind,'value','Before'),'proposed',value);
    insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence,options)
      values(uid,'ask',gen_random_uuid(),kind,'proposed','Test ride change','[]',jsonb_build_array(b)) returning id into rid;
    result:=public.change_adaptive_plan(uid,rid,'apply',jsonb_build_array(jsonb_build_object('option',b,'value',value)));
    if result->>'status'<>'applied'
      or kind='replace' and (public.adaptive_plan_snapshot(uid,ride_id)#>>'{payload,plannedDurationMinutes}')::numeric<>15
      or kind='remove' and public.adaptive_plan_snapshot(uid,ride_id)->>'state'<>'cancelled'
      or kind='add' and (result#>>'{outcomes,0,after,id}' is null or result#>>'{outcomes,0,after,id}'=ride_id::text)
    then raise exception 'Endurance % failed',kind;end if;
    result:=public.change_adaptive_plan(uid,rid,'undo','[]');
    if result->>'status'<>'reverted' or public.adaptive_plan_snapshot(uid,ride_id)->>'state'<>'planned'
      or (public.adaptive_plan_snapshot(uid,ride_id)#>>'{payload,plannedDurationMinutes}')::numeric<>30 then raise exception 'Endurance % undo failed',kind;end if;
  end loop;

  run:=public.adaptive_plan_snapshot(uid,run_id);
  b:=jsonb_build_object('id','cancel','session',run-'payload','field',jsonb_build_object('key','remove','value','Planned'),'proposed','Cancel session');
  insert into public.adaptive_plan_proposals(user_id,source_kind,source_id,source_hash,status,reason,evidence,options)
    values(uid,'review',gen_random_uuid(),'coach-protected','proposed','Cancel run','[]',jsonb_build_array(b)) returning id into rid;
  insert into public.coach_client_relationships(coach_user_id,client_user_id,status) values(coach_user,uid,'active') returning id into coach_id;
  insert into public.coach_training_assignments(relationship_id,coach_user_id,client_user_id,modality,source_template_client_id,source_template_name,assigned_date,coach_display_name,occurrence_key)
    values(coach_id,coach_user,uid,'endurance','coach-template','Coach run',sample+9,'Test Coach','endurance:test-run');
  if not (public.adaptive_plan_snapshot(uid,run_id)->>'coach')::boolean then raise exception 'Coach-assigned session not detected';end if;
  begin
    perform public.change_adaptive_plan(uid,rid,'apply',jsonb_build_array(jsonb_build_object('option',b,'value','Cancel session')));
    raise exception 'Coach-assigned session was changed';
  exception when sqlstate 'P0409' then null;end;

  perform public.save_strength_workout_v2(jsonb_build_object('id','live','templateId','test-strength','name','Live squat','date',sample,'startedAt','08:00','exercises','[]'::jsonb),'in_progress','live-init',0);
  if not (public.adaptive_plan_snapshot(uid,strength_id)->>'blocked')::boolean then raise exception 'Live strength workout was not protected';end if;
  perform public.save_endurance_session_v2(initial||jsonb_build_object('id','test-completed','date',current_date,'status','completed','plannedSessionId','test-run','durationSeconds',1800),'completed-write',0);
  if not (public.adaptive_plan_snapshot(uid,run_id)->>'blocked')::boolean then raise exception 'Completed endurance session was not protected';end if;
end
$test$;
rollback;
