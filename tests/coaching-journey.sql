-- Only run on an isolated database. All fixtures roll back.
begin;
do $test$
declare
  coach uuid:=gen_random_uuid();
  athlete uuid:=gen_random_uuid();
  stranger uuid:=gen_random_uuid();
  relationship uuid;
  assignment uuid;
  saved_feedback uuid;
  planned_key text;
  strength_assignment uuid;
  assigned_strength_template text;
  week_start date:=current_date-extract(dow from current_date)::integer;
  template jsonb:='{"id":"coach-audit-repeats","title":"Run repeats","activityType":"run","blocks":[{"id":"repeat","type":"repeat_group","title":"Work","repetitions":4},{"id":"interval","parentId":"repeat","type":"interval","title":"Fast","completionType":"distance","distanceMetres":400}]}';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (coach,'audit-coach@example.com','{}'),(athlete,'audit-athlete@example.com','{}'),(stranger,'audit-other@example.com','{}');
  update public.profiles set week_starts_on=0,individual_plan='premium' where id=athlete;
  perform set_config('request.jwt.claim.sub',coach::text,true);
  perform public.enable_coach_role();
  relationship:=public.send_coach_client_invite(athlete);
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform public.respond_coach_client_invite(relationship,true);
  perform set_config('request.jwt.claim.sub',coach::text,true);
  if exists(select 1 from public.list_coach_client_programs(relationship,week_start)) then
    raise exception 'A newly accepted client unexpectedly has a program';
  end if;
  insert into public.exercises(id,owner_id,name,muscle_group,equipment)
    values('audit-coach-press',coach,'Audit shoulder press','Shoulders','Dumbbell');
  perform public.save_strength_template_v2('{"id":"audit-coach-strength","name":"Strength audit","exercises":[{"exerciseId":"audit-coach-press","sets":1,"reps":"8"}]}', 'audit-strength-template',0);
  strength_assignment := (public.coach_assign_week(relationship,week_start,
    jsonb_build_array(jsonb_build_object('date',week_start,'modality','strength','templateId','audit-coach-strength'))))[1];
  select copied.client_id into assigned_strength_template
    from public.coach_training_assignments assigned
    join public.training_sessions planned on planned.id=assigned.client_planned_session_id
    join public.workout_templates copied on copied.id=assigned.client_strength_template_id
    join public.template_exercises item on item.template_id=copied.id
    join public.exercises exercise on exercise.id=item.exercise_id
    where assigned.id=strength_assignment and planned.coach_assignment_id=strength_assignment
      and copied.user_id=athlete and exercise.owner_id=athlete;
  if assigned_strength_template is null then raise exception 'Strength week assignment did not preserve the linked client session and exercise'; end if;
  perform public.save_endurance_template_v2(template,'audit-coach-template',0);
  assignment:=public.coach_assign_template(relationship,'endurance','coach-audit-repeats',week_start,'Preserve easy recoveries');
  perform public.coach_move_assignment(assignment,week_start+1);
  perform public.save_endurance_template_v2(template||'{"title":"Changed original"}','audit-coach-template-edit',1);
  select session.client_id into planned_key
    from public.coach_training_assignments assigned join public.training_sessions session on session.id=assigned.client_planned_session_id
    where assigned.id=assignment and session.user_id=athlete and session.title='Run repeats' and session.session_date=week_start+1;
  if planned_key is null or not exists(
    select 1 from public.training_session_blocks block join public.training_sessions session on session.id=block.session_id
    where session.client_id=planned_key and session.user_id=athlete and block.client_id='interval' and block.parent_client_id='repeat'
  ) then raise exception 'Reschedule, repeat structure, or snapshot ownership was lost';end if;

  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform public.save_endurance_session_v2(jsonb_build_object('id','audit-coached-run','status','completed','title','Run repeats',
    'activityType','run','date',week_start+1,'durationSeconds',1400,'distanceMetres',3000,'plannedSessionId',planned_key,'blocks','[]'::jsonb),'audit-coached-completion',0);
  perform public.save_athlete_session_checkin('endurance','audit-coached-run',9,'harder','Hard but steady');
  perform set_config('request.jwt.claim.sub',coach::text,true);
  saved_feedback:=public.save_coach_session_feedback(assignment,'Keep the recovery easy');
  if saved_feedback is null or saved_feedback is distinct from public.save_coach_session_feedback(assignment,'Keep the recovery easy') then
    raise exception 'Coach feedback retry did not preserve a single record';
  end if;
  perform public.save_coach_weekly_review_note(relationship,week_start,'Keep the next week steady');
  perform public.save_coach_comment(relationship,'session','How did it feel?',assignment);

  perform set_config('request.jwt.claim.sub',stranger::text,true);
  begin
    perform public.list_coach_comments(relationship,'session',assignment);
    raise exception 'Unrelated user could view discussion';
  exception when raise_exception then if sqlerrm<>'This coaching conversation is unavailable' then raise;end if;end;
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform public.save_coach_comment(relationship,'session','All good',assignment);
  if not exists(select 1 from public.list_client_weekly_review_notes() note where note.relationship_id=relationship)
     or (select count(*) from public.app_notifications where user_id=athlete and notification_type='coach_feedback')<>1 then
    raise exception 'Weekly note or feedback notification was not delivered to the athlete';
  end if;
  perform public.end_coach_client_relationship(relationship);
  perform set_config('request.jwt.claim.sub',coach::text,true);
  if exists(select 1 from public.get_coach_weekly_review_note(relationship,week_start)) then raise exception 'Ended coach retained review access';end if;
  begin
    perform public.save_coach_comment(relationship,'session','This must not send',assignment);
    raise exception 'Ended coach could post';
  exception when raise_exception then if sqlerrm<>'Active coaching is required to comment' then raise;end if;end;
  perform set_config('request.jwt.claim.sub',athlete::text,true);
  if public.effective_individual_plan(athlete)<>'premium'
     or not exists(select 1 from public.list_client_weekly_review_notes() note where note.relationship_id=relationship)
     or (select count(*) from public.list_coach_comments(relationship,'session',assignment))<>2 then
    raise exception 'Ending relationship removed historical records or personal access';
  end if;
end;
$test$;
rollback;
