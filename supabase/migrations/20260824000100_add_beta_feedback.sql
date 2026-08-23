begin;

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug','idea','general')),
  message text not null check (char_length(trim(message)) between 5 and 2000),
  source text not null default 'today_page' check (char_length(source) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_user_created_idx
  on public.beta_feedback(user_id,created_at desc);

alter table public.beta_feedback enable row level security;

drop policy if exists beta_feedback_insert_own on public.beta_feedback;
create policy beta_feedback_insert_own
  on public.beta_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists beta_feedback_select_own on public.beta_feedback;
create policy beta_feedback_select_own
  on public.beta_feedback for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.beta_feedback from anon;
revoke all on public.beta_feedback from authenticated;
grant select,insert on public.beta_feedback to authenticated;

commit;
