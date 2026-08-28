begin;

create table if not exists public.template_warmup_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  client_id text not null,
  item_type text not null check (item_type in ('exercise','instruction')),
  exercise_id text references public.exercises(id) on delete restrict,
  instructions text not null default '' check (char_length(instructions) <= 500),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (template_id, position),
  unique (template_id, client_id),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id) on delete cascade,
  check ((item_type = 'exercise' and exercise_id is not null) or (item_type = 'instruction' and exercise_id is null))
);

create table if not exists public.workout_warmup_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  client_id text not null,
  item_type text not null check (item_type in ('exercise','instruction')),
  exercise_id text references public.exercises(id) on delete restrict,
  instructions text not null default '' check (char_length(instructions) <= 500),
  position integer not null check (position >= 0),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workout_id, position),
  unique (workout_id, client_id),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade,
  check ((item_type = 'exercise' and exercise_id is not null) or (item_type = 'instruction' and exercise_id is null))
);

create index if not exists template_warmup_items_user_id_idx on public.template_warmup_items(user_id);
create index if not exists template_warmup_items_template_id_idx on public.template_warmup_items(template_id);
create index if not exists workout_warmup_items_user_id_idx on public.workout_warmup_items(user_id);
create index if not exists workout_warmup_items_workout_id_idx on public.workout_warmup_items(workout_id);

alter table public.template_warmup_items enable row level security;
alter table public.workout_warmup_items enable row level security;

drop policy if exists template_warmup_items_select_own on public.template_warmup_items;
create policy template_warmup_items_select_own on public.template_warmup_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists template_warmup_items_insert_own on public.template_warmup_items;
create policy template_warmup_items_insert_own on public.template_warmup_items for insert to authenticated
  with check ((select auth.uid()) = user_id and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))));
drop policy if exists template_warmup_items_update_own on public.template_warmup_items;
create policy template_warmup_items_update_own on public.template_warmup_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))));
drop policy if exists template_warmup_items_delete_own on public.template_warmup_items;
create policy template_warmup_items_delete_own on public.template_warmup_items for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists workout_warmup_items_select_own on public.workout_warmup_items;
create policy workout_warmup_items_select_own on public.workout_warmup_items for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists workout_warmup_items_insert_own on public.workout_warmup_items;
create policy workout_warmup_items_insert_own on public.workout_warmup_items for insert to authenticated
  with check ((select auth.uid()) = user_id and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))));
drop policy if exists workout_warmup_items_update_own on public.workout_warmup_items;
create policy workout_warmup_items_update_own on public.workout_warmup_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and (exercise_id is null or exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid())))));
drop policy if exists workout_warmup_items_delete_own on public.workout_warmup_items;
create policy workout_warmup_items_delete_own on public.workout_warmup_items for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.template_warmup_items, public.workout_warmup_items from anon;
revoke all on public.template_warmup_items, public.workout_warmup_items from authenticated;
grant select,insert,update,delete on public.template_warmup_items, public.workout_warmup_items to authenticated;

commit;
