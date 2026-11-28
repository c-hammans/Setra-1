-- Only run on an isolated database. All fixtures roll back.
begin;
do $test$
declare
  athlete uuid:=gen_random_uuid();
  free_user uuid:=gen_random_uuid();
  local_day date:=(now() at time zone 'Australia/Melbourne')::date;
  week_start date:=local_day-((extract(dow from local_day)::int-3+7)%7)-7;
  rejected boolean:=false;
  source_hash text:=repeat('a',64);
  note_id uuid;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (athlete,'review-adaptive@example.com','{}'),(free_user,'review-free@example.com','{}');
  update public.profiles set individual_plan='adaptive',timezone='Australia/Melbourne',week_starts_on=3 where id=athlete;
  if has_function_privilege('authenticated','public.claim_adaptive_weekly_review_generation(uuid,date,text,boolean)','EXECUTE')
     or has_function_privilege('authenticated','public.upsert_app_notification(uuid,uuid,text,text,text,text,text,text,text,text,timestamptz)','EXECUTE') then
    raise exception 'Clients must not be able to claim review generation or write notifications';
  end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  if public.claim_adaptive_weekly_review_generation(free_user,week_start,source_hash,false)
     or public.claim_adaptive_weekly_review_generation(athlete,week_start-7,source_hash,false) then
    raise exception 'Free or older-week review claim accepted';
  end if;
  if not public.claim_adaptive_weekly_review_generation(athlete,week_start,source_hash,false) then
    raise exception 'First eligible review not claimed';
  end if;
  if public.claim_adaptive_weekly_review_generation(athlete,week_start,repeat('b',64),true) then
    raise exception 'Duplicate while another generation is in flight';
  end if;
  for attempt in 2..4 loop
    update public.adaptive_weekly_reviews set status='failed' where user_id=athlete;
    if public.claim_adaptive_weekly_review_generation(athlete,week_start,source_hash,false) then
      raise exception 'Failed review retried automatically';
    end if;
    if not public.claim_adaptive_weekly_review_generation(athlete,week_start,source_hash,true) then
      raise exception 'Explicit retry did not claim';
    end if;
  end loop;
  update public.adaptive_weekly_reviews set status='failed' where user_id=athlete;
  begin
    perform public.claim_adaptive_weekly_review_generation(athlete,week_start,repeat('c',64),true);
  exception when sqlstate 'P0429' then rejected:=true;
  end;
  if not rejected then raise exception 'A fifth AI attempt was accepted';end if;

  perform set_config('request.jwt.claim.sub',athlete::text,true);
  perform public.save_notification_preferences(false,true,true,true,false,false,false,null);
  if public.upsert_app_notification(athlete,null,'training','adaptive_weekly_review','A review','',null,null,'/notifications','audit-week') is not null
     or exists(select 1 from public.app_notifications where user_id=athlete) then
    raise exception 'Weekly training notification ignored the disabled preference';
  end if;
  perform public.save_notification_preferences(true,true,true,true,false,false,false,null);
  note_id:=public.upsert_app_notification(athlete,null,'training','adaptive_weekly_review','A review','',null,null,'/notifications','audit-week');
  if note_id is null or note_id is distinct from public.upsert_app_notification(athlete,null,'training','adaptive_weekly_review','A review','',null,null,'/notifications','audit-week') then
    raise exception 'Weekly training notification did not use a stable record';
  end if;
end;
$test$;
rollback;
