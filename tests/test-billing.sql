-- Only run on an isolated migrated database. All fixtures roll back.
begin;
do $test$
declare
  coach uuid:=gen_random_uuid(); client_a uuid:=gen_random_uuid(); client_b uuid:=gen_random_uuid(); client_c uuid:=gen_random_uuid();
  individual uuid; coaching uuid; a uuid; b uuid; lease jsonb; checkout jsonb; snapshot jsonb; limited boolean;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (coach,'coach-billing-test@example.com','{}'),(client_a,'client-a-billing@example.com','{}'),
    (client_b,'client-b-billing@example.com','{}'),(client_c,'client-c-billing@example.com','{}');
  update public.profiles set individual_plan='premium' where id=coach;
  update public.billing_policy set coach_subscription_required=true;
  perform set_config('request.jwt.claim.sub',coach::text,true);
  begin
    perform public.enable_coach_role();
    raise exception 'Paid seat policy was bypassed';
  exception when raise_exception then if sqlerrm<>'An active coaching subscription is required' then raise;end if;end;
  if public.effective_individual_plan(coach)<>'premium' or public.effective_individual_plan(client_a)<>'free' then raise exception 'Wrong manual entitlements';end if;
  if has_function_privilege('authenticated','public.commit_billing_event(uuid,uuid,text,text,timestamptz,jsonb)','EXECUTE')
      or has_table_privilege('authenticated','public.billing_subscriptions','UPDATE')
      or has_column_privilege('authenticated','public.profiles','individual_plan','UPDATE')
  then raise exception 'An authenticated client can grant paid access';end if;

  insert into public.billing_accounts(user_id,provider,kind,customer_id) values(coach,'stripe_test','individual','cus_BillingTestPersonal') returning id into individual;
  insert into public.billing_accounts(user_id,provider,kind,customer_id) values(coach,'stripe_test','coaching','cus_BillingTestCoach') returning id into coaching;
  checkout:=public.reserve_billing_checkout(individual,'price_TestYear');
  if checkout<>public.reserve_billing_checkout(individual,'price_TestYear') then raise exception 'Lost checkout idempotency';end if;
  begin
    perform public.reserve_billing_checkout(individual,'price_Other');
    raise exception 'A second checkout slot was granted';
  exception when sqlstate 'P0602' then null;end;
  if public.effective_individual_plan(coach)<>'premium' then raise exception 'Checkout reservation changed access';end if;

  lease:=public.claim_billing_event(individual,'evt_PaidPersonal');
  if not (public.claim_billing_event(individual,'evt_OtherEvent')->>'busy')::boolean then raise exception 'Billing reads may race';end if;
  snapshot:=jsonb_build_object('product','adaptive','cadence','year','status','active','until',now()+interval '1 year','subscriptionId','sub_TestYear','priceId','price_TestYear');
  perform public.commit_billing_event(individual,(lease->>'token')::uuid,'evt_PaidPersonal','invoice.paid',now(),snapshot);
  if public.effective_individual_plan(coach)<>'adaptive' or not (public.claim_billing_event(individual,'evt_PaidPersonal')->>'duplicate')::boolean
  then raise exception 'Verified entitlement or webhook dedupe failed';end if;
  begin
    perform public.commit_billing_event(individual,(lease->>'token')::uuid,'evt_Old','invoice.payment_failed',now()-interval '1 day','{"status":"past_due"}');
    raise exception 'Stale lease could overwrite entitlements';
  exception when raise_exception then if sqlerrm<>'Billing sync lease expired' then raise;end if;end;

  lease:=public.claim_billing_event(coaching,'evt_PaidCoach');
  perform public.commit_billing_event(coaching,(lease->>'token')::uuid,'evt_PaidCoach','invoice.paid',now(),
    jsonb_build_object('product','coach_starter','cadence','month','status','active','until',now()+interval '1 month','seats',2,'subscriptionId','sub_TestCoach'));
  if public.effective_individual_plan(coach)<>'adaptive' or public.coach_seat_limit(coach)<>2 then raise exception 'Subscriptions do not stack';end if;
  a:=public.send_coach_client_invite(client_a);
  b:=public.send_coach_client_invite(client_b);
  begin
    perform public.send_coach_client_invite(client_c);
    raise exception 'Pending invite did not reserve a seat';
  exception when sqlstate 'P0601' then null;end;
  perform set_config('request.jwt.claim.sub',client_a::text,true);
  perform public.respond_coach_client_invite(a,true);
  update public.billing_subscriptions set seats=1 where account_id=coaching;
  perform set_config('request.jwt.claim.sub',client_b::text,true);
  begin
    perform public.respond_coach_client_invite(b,true);
    raise exception 'Downgrade was bypassed by accepting an older invite';
  exception when sqlstate 'P0601' then null;end;
  begin
    perform public.set_coach_funded_access(a,false);
    raise exception 'Unrelated user wrote coach-funded entitlements';
  exception when raise_exception then if sqlerrm<>'Active coaching relationship not found' then raise;end if;end;
  update public.billing_subscriptions set seats=2 where account_id=coaching;
  perform public.respond_coach_client_invite(b,true);
  perform set_config('request.jwt.claim.sub',coach::text,true);
  perform public.set_coach_funded_access(a,true);
  perform public.set_coach_funded_access(b,true);
  if public.effective_individual_plan(client_a)<>'premium' or (select individual_plan from public.profiles where id=client_a)<>'free' then
    raise exception 'Coach-funded access overwrote the personal plan';
  end if;
  update public.profiles set individual_plan='adaptive' where id=client_b;

  insert into public.workouts(user_id,workout_date,name,status,completed_at) values(client_a,current_date,'Keep this training history','completed',now());
  lease:=public.claim_billing_event(coaching,'evt_Downgrade');
  perform public.commit_billing_event(coaching,(lease->>'token')::uuid,'evt_Downgrade','customer.subscription.updated',now(),
    jsonb_build_object('product','coach_starter','cadence','month','status','active','until',now()+interval '1 month','seats',1,'subscriptionId','sub_TestCoach'));
  if (select count(*) from public.coach_client_relationships where coach_user_id=coach and status='active')<>2
    or public.effective_individual_plan(client_a)<>'free' or public.effective_individual_plan(client_b)<>'adaptive'
    or not exists(select 1 from public.workouts where user_id=client_a and name='Keep this training history')
  then raise exception 'Downgrade removed relationships, history or independent access';end if;
  perform public.end_coach_client_relationship(b);
  if public.effective_individual_plan(client_a)<>'premium' then raise exception 'Reducing client count did not restore funding';end if;

  lease:=public.claim_billing_event(individual,'evt_Failed');
  perform public.commit_billing_event(individual,(lease->>'token')::uuid,'evt_Failed','invoice.payment_failed',now(),snapshot||'{"status":"past_due"}');
  if public.effective_individual_plan(coach)<>'premium' or public.coach_seat_limit(coach)<>1 then raise exception 'Failed personal payment affected beta or coaching';end if;
  lease:=public.claim_billing_event(individual,'evt_RetryPaid');
  perform public.commit_billing_event(individual,(lease->>'token')::uuid,'evt_RetryPaid','invoice.paid',now(),snapshot||'{"cancelAtEnd":true}');
  if public.effective_individual_plan(coach)<>'adaptive' then raise exception 'Cancellation at period end revoked current access';end if;
  update public.billing_subscriptions set access_until=now()-interval '1 second' where account_id=individual;
  if public.effective_individual_plan(coach)<>'premium' then raise exception 'Expiry requires an unavailable scheduler';end if;

  lease:=public.claim_billing_event(coaching,'evt_CoachRetry');
  perform public.commit_billing_event(coaching,(lease->>'token')::uuid,'evt_CoachRetry','invoice.payment_failed',now(),
    '{"product":"coach_starter","seats":1,"status":"past_due","subscriptionId":"sub_TestCoach"}');
  if public.coach_seat_limit(coach)<>0 or public.effective_individual_plan(client_a)<>'free'
    or (select status from public.coach_client_relationships where id=a)<>'active'
  then raise exception 'Failed coach payment handling is incorrect';end if;
end
$test$;
rollback;
