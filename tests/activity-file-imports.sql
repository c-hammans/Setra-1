-- Run only against an isolated database after all Setra migrations.
begin;
do $test$
declare
  owner_id uuid:='171a6e53-0141-4a31-8fe4-acde11990101'; other_id uuid:='171a6e53-0141-4a31-8fe4-acde11990102';
  activity_day date:=current_date-2; start_at timestamptz; plan_id uuid; outsider_plan uuid; manual_id uuid; linked_id uuid;
  parsed jsonb; payload jsonb; result jsonb; outcome jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values(owner_id,'activity-owner@example.com','{}'),(other_id,'activity-other@example.com','{}');
  start_at:=(activity_day+time '08:00') at time zone 'UTC';
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  perform public.save_endurance_session_v2(jsonb_build_object('id','test-plan','title','Plan 5K','status','planned',
    'activityType','run','date',activity_day,'plannedDurationMinutes',40,'plannedDistanceMetres',5000,
    'blocks','[{"id":"one","type":"main","title":"5K","completionType":"distance","distanceMetres":5000}]'::jsonb),'save-file-test-plan',0);
  select id into plan_id from public.training_sessions where client_id='test-plan' and user_id=owner_id;
  perform set_config('request.jwt.claim.sub',other_id::text,true);
  perform public.save_endurance_session_v2(jsonb_build_object('id','other-plan','title','Private plan','status','planned',
    'activityType','run','date',activity_day,'blocks','[]'::jsonb),'save-file-other-plan',0);
  select id into outsider_plan from public.training_sessions where client_id='other-plan' and user_id=other_id;

  parsed:=jsonb_build_object('format','fit','start',start_at,'finish',start_at+interval '30 min','sport','run','date',activity_day,
    'metrics','{"distanceMetres":5000,"activeSeconds":1630,"elapsedSeconds":1800}'::jsonb,'laps','[{"distanceMetres":1000,"activeSeconds":310}]'::jsonb);
  payload:=jsonb_build_object('date',activity_day,'localToday',current_date,'title','5K file','activityType','run','startedAt',start_at,
    'endedAt',start_at+interval '30 min','durationSeconds',1630,'distanceMetres',5000);
  begin
    perform public.import_reviewed_activity(owner_id,repeat('b',64),'start:2000',parsed,payload,outsider_plan,null,false);
    raise exception 'Cross-account plan write allowed';
  exception when sqlstate 'P0409' then null;end;
  outcome:=public.import_reviewed_activity(owner_id,repeat('a',64),'start:1000',parsed,payload,plan_id,null,false);
  if outcome->>'status'<>'imported' then raise exception 'Import failed';end if;
  select id into linked_id from public.training_sessions where user_id=owner_id and planned_session_id=plan_id and status='completed' and distance_metres=5000 and duration_seconds=1630;
  if linked_id is null then raise exception 'Canonical completed activity not created';end if;
  if not exists(select 1 from public.training_plan_occurrences where user_id=owner_id and occurrence_key='endurance:test-plan' and status='completed')
    or not exists(select 1 from public.training_session_blocks where session_id=plan_id and client_id='one')
    or exists(select 1 from public.training_session_blocks where session_id=linked_id) then
      raise exception 'Prescription and recorded laps were not kept separate';
  end if;
  if not exists(select 1 from public.activity_import_receipts where session_id=linked_id and jsonb_array_length(recorded_result->'laps')=1) then raise exception 'Actual laps missing';end if;
  if public.import_reviewed_activity(owner_id,repeat('a',64),'start:1000',parsed,payload,plan_id,null,false)->>'status'<>'duplicate'
    or public.import_reviewed_activity(owner_id,repeat('c',64),'start:1000',parsed,payload,null,null,false)->>'status'<>'duplicate'
  then raise exception 'Idempotency failed';end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  if not exists(select 1 from jsonb_array_elements(public.get_adaptive_weekly_personal_bests(owner_id,activity_day)) pb where pb->>'label'='5K')
  then raise exception 'Imported distance/time did not feed existing PB source';end if;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    perform public.save_endurance_session_v2(payload||jsonb_build_object('id','other-completion','status','completed','plannedSessionId','test-plan'),
      'duplicate-plan-completion',0);
    raise exception 'Manual save created a second linked completion';
  exception when sqlstate 'P0409' then null;end;

  perform public.save_endurance_session_v2(payload||jsonb_build_object('id','hand-log','status','completed','title','Manual ride','activityType','bike','notes','Keep these notes'),
    'hand-log-op',0);
  select id into manual_id from public.training_sessions where client_id='hand-log' and user_id=owner_id;
  payload:=payload||'{"activityType":"bike","distanceMetres":8100}'::jsonb;
  parsed:=parsed||'{"format":"tcx","sport":"bike"}'::jsonb;
  begin
    perform public.import_reviewed_activity(owner_id,repeat('d',64),'start:2001',parsed,payload,null,null,false);
    raise exception 'Possible duplicate was not flagged';
  exception when sqlstate 'P0409' then null;end;
  result:=public.import_reviewed_activity(owner_id,repeat('d',64),'start:2001',parsed,payload,null,manual_id,false);
  if result->>'status'<>'reconciled' or not exists(select 1 from public.training_sessions where id=manual_id and title='Manual ride' and notes='Keep these notes' and distance_metres=5000)
    or (select count(*) from public.training_sessions where user_id=owner_id and status='completed')<>2 then raise exception 'Manual reconciliation changed or duplicated results';end if;

  begin
    insert into public.activity_import_receipts(user_id,session_id,source_channel,provider,external_activity_id,sync_status,recorded_result)
      values(owner_id,linked_id,'connector','strava','restricted','restricted','{}');
    raise exception 'Restricted source entered canonical training';
  exception when check_violation then null;end;
  if has_function_privilege('authenticated','public.import_reviewed_activity(uuid,text,text,jsonb,jsonb,uuid,uuid,boolean)','EXECUTE')
    or has_table_privilege('authenticated','public.activity_import_receipts','INSERT') then raise exception 'Client can forge import provenance';end if;
end
$test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','171a6e53-0141-4a31-8fe4-acde11990102',true);
do $test$
begin
  if exists(select 1 from public.activity_import_receipts) then raise exception 'Cross-account import history readable';end if;
end
$test$;
select set_config('request.jwt.claim.sub','171a6e53-0141-4a31-8fe4-acde11990101',true);
do $test$
begin
  if (select count(*) from public.activity_import_receipts)<>2 then raise exception 'Owner history unavailable';end if;
end
$test$;
rollback;
