begin;

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'requested' check (status in ('requested','reviewing','cancelled','completed')),
  updated_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;
drop policy if exists "Users can view own deletion request" on public.account_deletion_requests;
create policy "Users can view own deletion request" on public.account_deletion_requests for select to authenticated using (auth.uid()=user_id);
drop policy if exists "Users can create own deletion request" on public.account_deletion_requests;
create policy "Users can create own deletion request" on public.account_deletion_requests for insert to authenticated with check (auth.uid()=user_id and status='requested');
drop policy if exists "Users can refresh own deletion request" on public.account_deletion_requests;
create policy "Users can refresh own deletion request" on public.account_deletion_requests for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id and status='requested');
grant select,insert on public.account_deletion_requests to authenticated;
grant update (requested_at,status) on public.account_deletion_requests to authenticated;

comment on table public.account_deletion_requests is 'User-initiated deletion requests. A trusted operator or future server workflow performs the actual deletion.';

commit;
