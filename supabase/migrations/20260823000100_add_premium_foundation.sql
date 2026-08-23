begin;

-- Restart-safe because some Supabase SQL Editor runs may have applied only a
-- portion of an earlier attempt.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'app_colour') then
    alter table public.profiles add column app_colour text not null default '#409ECE' check (app_colour in ('#409ECE','#FF6B6B','#F6C445','#55B96D','#8B72D9','#000000','#FFFFFF'));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_tier') then
    alter table public.profiles add column subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium'));
  end if;
end;
$$;

-- Subscription status is server-managed. Signed-in users may edit normal profile
-- preferences, but cannot grant themselves Premium access.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, preferred_unit, timezone, app_colour) on public.profiles to authenticated;

create table if not exists public.premium_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  source text not null default 'premium_page',
  created_at timestamptz not null default now(),
  constraint premium_waitlist_email_not_blank check (length(trim(email)) > 3),
  constraint premium_waitlist_email_unique unique (email),
  constraint premium_waitlist_user_unique unique (user_id)
);

create index if not exists premium_waitlist_created_at_idx on public.premium_waitlist(created_at desc);
create index if not exists premium_waitlist_user_id_idx on public.premium_waitlist(user_id);

alter table public.premium_waitlist enable row level security;

drop policy if exists premium_waitlist_select_own on public.premium_waitlist;
drop policy if exists "Users can view their own waitlist entry" on public.premium_waitlist;
create policy premium_waitlist_select_own
  on public.premium_waitlist for select to authenticated
  using (
    (select auth.uid()) = user_id
    or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

drop policy if exists premium_waitlist_insert_own on public.premium_waitlist;
drop policy if exists "Users can join the premium waitlist" on public.premium_waitlist;
create policy premium_waitlist_insert_own
  on public.premium_waitlist for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

revoke all on public.premium_waitlist from anon;
revoke all on public.premium_waitlist from authenticated;
grant select, insert on public.premium_waitlist to authenticated;

commit;
