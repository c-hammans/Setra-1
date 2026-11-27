begin;

-- Profile plans and role grants remain independent of provider billing.
create table public.billing_policy (
  singleton boolean primary key default true check(singleton),
  coach_subscription_required boolean not null default false
);
insert into public.billing_policy default values;
create table public.billing_beta_coaches (
  user_id uuid primary key references auth.users(id) on delete cascade
);
insert into public.billing_beta_coaches select user_id from public.user_roles where role='coach';

-- Separate customers stop a portal session for one product family from
-- modifying the other family, even if its portal configuration is wrong.
create table public.billing_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider='stripe_test'),
  kind text not null check(kind in ('individual','coaching')),
  customer_id text unique,
  checkout_token uuid,
  checkout_price text,
  checkout_until timestamptz,
  sync_token uuid,
  sync_until timestamptz,
  unique(user_id,provider,kind)
);
create table public.billing_subscriptions (
  account_id uuid primary key references public.billing_accounts(id) on delete cascade,
  subscription_id text unique,
  product_key text,
  price_id text,
  cadence text check(cadence in ('month','year')),
  status text not null check(status in ('active','trialing','past_due','unpaid','incomplete','incomplete_expired','paused','canceled','conflict','unmapped','pending_payment')),
  access_until timestamptz,
  cancel_at_end boolean not null default false,
  seats integer check(seats between 1 and 1000),
  updated_at timestamptz not null default now()
);
create table public.billing_webhook_events (
  provider text not null check(provider='stripe_test'),
  event_id text not null,
  account_id uuid not null references public.billing_accounts(id) on delete cascade,
  event_type text not null,
  event_created_at timestamptz not null,
  processed_at timestamptz not null default now(),
  primary key(provider,event_id)
);
alter table public.coach_client_relationships add column if not exists premium_funded boolean not null default false;

alter table public.billing_policy enable row level security;
alter table public.billing_beta_coaches enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
revoke all on public.billing_policy,public.billing_beta_coaches,public.billing_accounts,public.billing_subscriptions,public.billing_webhook_events from public,anon,authenticated;
grant all on public.billing_policy,public.billing_beta_coaches,public.billing_accounts,public.billing_subscriptions,public.billing_webhook_events to service_role;

create function public.billing_access_valid(p_status text,p_until timestamptz) returns boolean
language sql stable set search_path='' as $$ select coalesce(p_status in ('active','trialing') and p_until>now(),false) $$;

-- NULL capacity is the unmetered legacy/test workspace path. It cannot fund
-- Premium. Once a coach has a paid record, its seats govern prospectively.
create function public.coach_seat_limit(p_user uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
declare result integer; has_record boolean;
begin
  select case when public.billing_access_valid(s.status,s.access_until) then coalesce(s.seats,0) else 0 end,true
    into result,has_record from public.billing_subscriptions s join public.billing_accounts a on a.id=s.account_id
    where a.user_id=p_user and a.kind='coaching';
  if has_record then return result;end if;
  if exists(select 1 from public.billing_beta_coaches where user_id=p_user)
    or not (select coach_subscription_required from public.billing_policy)
  then return null;end if;
  return 0;
end;
$$;

create function public.effective_individual_plan(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
  select case
    when p.individual_plan='adaptive' or paid.product_key='adaptive' then 'adaptive'
    when p.individual_plan='premium' or paid.product_key='premium' or exists(
      select 1 from public.coach_client_relationships r
      join public.billing_accounts a on a.user_id=r.coach_user_id and a.kind='coaching'
      join public.billing_subscriptions s on s.account_id=a.id
      where r.client_user_id=p_user and r.status='active' and r.premium_funded
        and public.billing_access_valid(s.status,s.access_until) and s.seats>0
        and (select count(*) from public.coach_client_relationships peers where peers.coach_user_id=r.coach_user_id and peers.status='active')<=s.seats
    ) then 'premium' else 'free' end
  from public.profiles p left join lateral (
    select s.product_key from public.billing_accounts a join public.billing_subscriptions s on s.account_id=a.id
    where a.user_id=p_user and a.kind='individual' and public.billing_access_valid(s.status,s.access_until)
  ) paid on true where p.id=p_user;
$$;

create function public.my_effective_access() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('plan',public.effective_individual_plan(auth.uid()),
    'roles',coalesce((select jsonb_agg(role) from public.user_roles where user_id=auth.uid()),'[]'));
$$;

-- The Adaptive proposal transaction also needs the same effective plan check.
create or replace function public.adaptive_plan_today(p_user uuid) returns date
language sql stable set search_path='' as $$
  select (now() at time zone coalesce((select name from pg_timezone_names where name=p.timezone),'UTC'))::date
  from public.profiles p where p.id=p_user and public.effective_individual_plan(p_user)='adaptive';
$$;

create function public.my_billing_summary() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'plan',public.effective_individual_plan(auth.uid()),
    'required',(select coach_subscription_required from public.billing_policy),
    'manualPlan',(select individual_plan from public.profiles where id=auth.uid()),
    'subscriptions',coalesce((select jsonb_object_agg(a.kind,jsonb_build_object('hasCustomer',a.customer_id is not null,
      'product',s.product_key,'status',s.status,'cadence',s.cadence,'until',s.access_until,'cancelAtEnd',s.cancel_at_end,
      'funded',public.billing_access_valid(s.status,s.access_until)))
      from public.billing_accounts a left join public.billing_subscriptions s on s.account_id=a.id where a.user_id=auth.uid()),'{}'),
    'seats',jsonb_build_object('limit',public.coach_seat_limit(auth.uid()),
      'active',(select count(*) from public.coach_client_relationships where coach_user_id=auth.uid() and status='active'),
      'pending',(select count(*) from public.coach_client_relationships where coach_user_id=auth.uid() and status='pending')),
    'clients',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',coalesce(nullif(p.display_name,''),p.username,'Setra athlete'),'funded',r.premium_funded) order by p.display_name,r.id)
      from public.coach_client_relationships r join public.profiles p on p.id=r.client_user_id where r.coach_user_id=auth.uid() and r.status='active'),'[]'));
$$;

create or replace function public.enable_coach_role() returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Authentication is required';end if;
  if public.coach_seat_limit(uid)=0 then raise exception 'An active coaching subscription is required';end if;
  insert into public.user_roles(user_id,role,granted_by) values(uid,'coach',uid) on conflict do nothing;
end;
$$;

create function public.guard_coach_seats() returns trigger
language plpgsql security definer set search_path='' as $$
declare capacity integer; reserved integer;
begin
  if tg_op='UPDATE' and new.status=old.status then return new;end if;
  if new.status not in ('pending','active') then return new;end if;
  perform pg_advisory_xact_lock(hashtextextended('coach-seats:'||new.coach_user_id,0));
  capacity:=public.coach_seat_limit(new.coach_user_id);
  if capacity is null then return new;end if;
  select count(*) into reserved from public.coach_client_relationships r
    where r.coach_user_id=new.coach_user_id and r.id is distinct from new.id
    and (r.status='active' or (new.status='pending' and r.status='pending'));
  if reserved>=capacity then
    raise exception 'No coaching seat is available. The coach can manage seats or upgrade in Coaching.' using errcode='P0601';
  end if;
  return new;
end;
$$;
create trigger guard_coach_seats before insert or update of status on public.coach_client_relationships
  for each row execute function public.guard_coach_seats();

create function public.guard_billed_coach_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare capacity integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('coach-seats:'||new.coach_user_id,0));
  capacity:=public.coach_seat_limit(new.coach_user_id);
  if capacity is not null and (capacity=0 or (select count(*) from public.coach_client_relationships where coach_user_id=new.coach_user_id and status='active')>capacity) then
    raise exception 'Resolve coaching capacity before assigning new training.' using errcode='P0601';
  end if;
  return new;
end;
$$;
create trigger guard_billed_coach_assignment before insert on public.coach_training_assignments
  for each row execute function public.guard_billed_coach_assignment();

create function public.set_coach_funded_access(p_relationship uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); capacity integer;
begin
  if uid is null or p_enabled is null then raise exception 'Authentication is required';end if;
  perform 1 from public.coach_client_relationships where id=p_relationship and coach_user_id=uid and status='active' for update;
  if not found then raise exception 'Active coaching relationship not found';end if;
  perform pg_advisory_xact_lock(hashtextextended('coach-seats:'||uid,0));
  capacity:=public.coach_seat_limit(uid);
  if p_enabled and (capacity is null or capacity=0 or
    (select count(*) from public.coach_client_relationships where coach_user_id=uid and status='active')>capacity)
  then raise exception 'An active paid coaching plan within capacity is required';end if;
  update public.coach_client_relationships set premium_funded=p_enabled,updated_at=now()
    where id=p_relationship and coach_user_id=uid and status='active';
  if not found then raise exception 'Active coaching relationship not found';end if;
end;
$$;

create function public.reserve_billing_checkout(p_account uuid,p_price text) returns jsonb
language plpgsql set search_path='' as $$
declare a public.billing_accounts;
begin
  select * into a from public.billing_accounts where id=p_account for update;
  if not found or a.customer_id is null then raise exception 'Billing account unavailable';end if;
  if exists(select 1 from public.billing_subscriptions where account_id=a.id and status not in ('canceled','incomplete_expired')) then
    raise exception 'A subscription already exists. Use Manage subscription to change it.' using errcode='P0602';
  end if;
  if a.checkout_until>now() and a.checkout_price is distinct from p_price then
    raise exception 'A checkout is open for a different option. Finish it or wait for it to expire.' using errcode='P0602';
  end if;
  if a.checkout_until is null or a.checkout_until<=now() then
    update public.billing_accounts set checkout_price=p_price,checkout_token=gen_random_uuid(),
      checkout_until=date_trunc('second',now()+interval '45 minutes') where id=a.id returning * into a;
  end if;
  return jsonb_build_object('token',a.checkout_token,'expires',a.checkout_until);
end;
$$;

-- A short lease serializes authoritative Stripe reads for a customer.
-- Failures aren't acknowledged; Stripe can replay and the lease also expires.
create function public.claim_billing_event(p_account uuid,p_event text) returns jsonb
language plpgsql set search_path='' as $$
declare a public.billing_accounts; token uuid;
begin
  select * into a from public.billing_accounts where id=p_account for update;
  if not found then raise exception 'Billing account unavailable';end if;
  if exists(select 1 from public.billing_webhook_events where provider=a.provider and event_id=p_event) then return jsonb_build_object('duplicate',true);end if;
  if a.sync_until>now() then return jsonb_build_object('busy',true);end if;
  token:=gen_random_uuid();
  update public.billing_accounts set sync_token=token,sync_until=now()+interval '90 seconds' where id=a.id;
  return jsonb_build_object('token',token);
end;
$$;

create function public.commit_billing_event(p_account uuid,p_token uuid,p_event text,p_type text,p_event_at timestamptz,p_snapshot jsonb) returns void
language plpgsql set search_path='' as $$
declare a public.billing_accounts;
begin
  select * into a from public.billing_accounts where id=p_account for update;
  if not found or a.sync_token is distinct from p_token or a.sync_until<=now() then raise exception 'Billing sync lease expired';end if;
  if a.kind='coaching' then perform pg_advisory_xact_lock(hashtextextended('coach-seats:'||a.user_id,0));end if;
  if p_snapshot is not null then
    insert into public.billing_subscriptions(account_id,subscription_id,product_key,price_id,cadence,status,access_until,cancel_at_end,seats)
      values(a.id,p_snapshot->>'subscriptionId',p_snapshot->>'product',p_snapshot->>'priceId',p_snapshot->>'cadence',p_snapshot->>'status',
        (p_snapshot->>'until')::timestamptz,coalesce((p_snapshot->>'cancelAtEnd')::boolean,false),(p_snapshot->>'seats')::integer)
    on conflict(account_id) do update set subscription_id=excluded.subscription_id,product_key=excluded.product_key,price_id=excluded.price_id,
      cadence=excluded.cadence,status=excluded.status,access_until=excluded.access_until,cancel_at_end=excluded.cancel_at_end,seats=excluded.seats,updated_at=now();
    if a.kind='coaching' and public.billing_access_valid(p_snapshot->>'status',(p_snapshot->>'until')::timestamptz) and (p_snapshot->>'seats')::integer>0 then
      insert into public.user_roles(user_id,role) values(a.user_id,'coach') on conflict do nothing;
    end if;
  end if;
  insert into public.billing_webhook_events(provider,event_id,account_id,event_type,event_created_at) values(a.provider,p_event,a.id,p_type,p_event_at);
  update public.billing_accounts set sync_token=null,sync_until=null,
    checkout_token=case when a.checkout_token::text=p_snapshot->>'checkoutToken' then null else a.checkout_token end,
    checkout_until=case when a.checkout_token::text=p_snapshot->>'checkoutToken' then null else a.checkout_until end,
    checkout_price=case when a.checkout_token::text=p_snapshot->>'checkoutToken' then null else a.checkout_price end where id=a.id;
end;
$$;

revoke all on function public.billing_access_valid(text,timestamptz),public.coach_seat_limit(uuid),public.effective_individual_plan(uuid),public.guard_coach_seats(),
  public.guard_billed_coach_assignment(),public.my_effective_access(),public.my_billing_summary(),public.set_coach_funded_access(uuid,boolean),
  public.reserve_billing_checkout(uuid,text),public.claim_billing_event(uuid,text),public.commit_billing_event(uuid,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.my_effective_access(),public.my_billing_summary(),public.set_coach_funded_access(uuid,boolean) to authenticated;
grant execute on function public.effective_individual_plan(uuid),public.reserve_billing_checkout(uuid,text),public.claim_billing_event(uuid,text),public.commit_billing_event(uuid,uuid,text,text,timestamptz,jsonb) to service_role;

commit;
