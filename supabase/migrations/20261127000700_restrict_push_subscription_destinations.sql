begin;

create or replace function public.register_push_subscription(
  p_endpoint text,p_p256dh text,p_auth text,p_expiration_time timestamptz default null,p_user_agent text default ''
) returns uuid language plpgsql security definer set search_path='' as $register$
declare
  owner_id uuid:=auth.uid();
  result_id uuid;
begin
  if owner_id is null then raise exception 'Authentication is required';end if;
  if p_endpoint is null or char_length(p_endpoint)>2048
     or p_endpoint !~* $endpoint$^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.(notify|wns)\.windows\.com)/[^[:space:]\\#]+$$endpoint$
     or coalesce(char_length(p_p256dh),0) not between 20 and 500
     or coalesce(char_length(p_auth),0) not between 8 and 200 then
    raise exception 'Invalid push subscription';
  end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret,expiration_time,user_agent,enabled,updated_at)
    values(owner_id,p_endpoint,p_p256dh,p_auth,p_expiration_time,left(coalesce(p_user_agent,''),500),true,now())
    on conflict(endpoint) do update set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,
      expiration_time=excluded.expiration_time,user_agent=excluded.user_agent,enabled=true,updated_at=now()
    where public.push_subscriptions.user_id=owner_id
    returning id into result_id;
  if result_id is null then raise exception 'This device subscription belongs to another account';end if;
  return result_id;
end;
$register$;

commit;
