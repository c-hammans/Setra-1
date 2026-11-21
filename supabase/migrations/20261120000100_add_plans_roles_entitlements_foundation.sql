begin;

-- Individual commercial access is independent from product roles. Keep the
-- legacy subscription_tier column during the transition, but use this field as
-- the source of truth for all new entitlement decisions.
alter table public.profiles
  add column if not exists individual_plan text not null default 'free';

update public.profiles
set individual_plan = 'premium'
where subscription_tier = 'premium'
  and individual_plan = 'free';

alter table public.profiles
  drop constraint if exists profiles_individual_plan_check;
alter table public.profiles
  add constraint profiles_individual_plan_check
  check (individual_plan in ('free', 'premium', 'adaptive'));

comment on column public.profiles.individual_plan is
  'Server-managed individual Setra plan. Independent from athlete or coach roles.';

-- Profile updates already use explicit column grants. This explicit revoke
-- documents and enforces that a signed-in browser cannot upgrade its own plan.
revoke update (individual_plan) on public.profiles from authenticated;
revoke update (individual_plan) on public.profiles from anon;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('athlete', 'coach')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  primary key (user_id, role)
);

comment on table public.user_roles is
  'Server-managed product roles. Roles do not grant or replace an individual plan.';

insert into public.user_roles (user_id, role)
select id, 'athlete' from public.profiles
on conflict (user_id, role) do nothing;

create or replace function public.assign_default_user_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role)
  values (new.id, 'athlete')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_assign_default_user_role on public.profiles;
create trigger profiles_assign_default_user_role
after insert on public.profiles
for each row execute function public.assign_default_user_role();

revoke all on function public.assign_default_user_role() from public;
revoke all on function public.assign_default_user_role() from anon;
revoke all on function public.assign_default_user_role() from authenticated;

alter table public.user_roles enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
  on public.user_roles for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_roles from anon;
revoke all on public.user_roles from authenticated;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

commit;
