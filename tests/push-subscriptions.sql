-- Only run on an isolated database. Uses dummy endpoints and does not send push.
begin;
do $test$
declare
  subscriber uuid:=gen_random_uuid();
  stranger uuid:=gen_random_uuid();
  subscription_id uuid;
  endpoint constant text:='https://web.push.apple.com/audit-fixture';
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (subscriber,'push-subscriber@example.com','{}'),(stranger,'push-stranger@example.com','{}');
  perform set_config('request.jwt.claim.sub',subscriber::text,true);
  subscription_id:=public.register_push_subscription(endpoint,repeat('a',65),repeat('b',16));
  if public.register_push_subscription(endpoint,repeat('a',65),repeat('b',16))<>subscription_id then
    raise exception 'Device renewal created a duplicate';
  end if;
  begin
    perform public.register_push_subscription('https://example.invalid/push',repeat('a',65),repeat('b',16));
    raise exception 'Unsupported endpoint was accepted';
  exception when raise_exception then
    if sqlerrm<>'Invalid push subscription' then raise;end if;
  end;
  perform set_config('request.jwt.claim.sub',stranger::text,true);
  begin
    perform public.register_push_subscription(endpoint,repeat('c',65),repeat('d',16));
    raise exception 'A different user claimed an existing device';
  exception when raise_exception then
    if sqlerrm<>'This device subscription belongs to another account' then raise;end if;
  end;
  perform public.revoke_push_subscription(endpoint);
  if not exists(select 1 from public.push_subscriptions where id=subscription_id and user_id=subscriber and enabled) then
    raise exception 'The other user disabled the original subscription';
  end if;
end;
$test$;
rollback;
