begin;

create extension if not exists pgcrypto;

create type public.workout_status as enum ('in_progress', 'completed');
create type public.load_mode as enum ('kg', 'text');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_unit text not null default 'kg' check (preferred_unit in ('kg', 'lb')),
  timezone text not null default 'Australia/Melbourne',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exercises (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  muscle_group text not null check (char_length(muscle_group) between 1 and 80),
  equipment text not null check (char_length(equipment) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  name text not null check (char_length(name) between 1 and 120),
  focus text not null default '',
  colour text not null default '#409ECE',
  icon text not null default '◆',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_id)
);

create table public.template_supersets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  client_group_key text not null,
  name text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (template_id, client_group_key),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id) on delete cascade
);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  exercise_id text not null references public.exercises(id) on delete restrict,
  superset_id uuid,
  position integer not null check (position >= 0),
  planned_sets integer not null default 3 check (planned_sets between 1 and 100),
  rep_target text not null default '8' check (char_length(rep_target) <= 30),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (template_id, position),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id) on delete cascade,
  foreign key (superset_id) references public.template_supersets(id) on delete set null
);

create table public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  scheduled_date date not null,
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, template_id, scheduled_date),
  foreign key (template_id, user_id) references public.workout_templates(id, user_id) on delete cascade
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text,
  template_id uuid,
  status public.workout_status not null default 'in_progress',
  name text not null check (char_length(name) between 1 and 120),
  workout_date date not null,
  started_at time,
  ended_at time,
  timezone text not null default 'Australia/Melbourne',
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, client_id),
  foreign key (template_id) references public.workout_templates(id) on delete set null,
  check ((status = 'completed' and completed_at is not null) or status = 'in_progress')
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise_id text not null references public.exercises(id) on delete restrict,
  position integer not null check (position >= 0),
  superset_key text,
  superset_name text,
  notes text not null default '',
  planning_notes text not null default '',
  rep_target text,
  load_mode public.load_mode not null default 'kg',
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (workout_id, position),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null,
  set_number integer not null check (set_number > 0),
  weight numeric(10,3) check (weight is null or weight >= 0),
  load_text varchar(12),
  reps text,
  rpe numeric(3,1) check (rpe is null or (rpe >= 0 and rpe <= 10)),
  notes text not null default '',
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_exercise_id, set_number),
  foreign key (workout_exercise_id, user_id) references public.workout_exercises(id, user_id) on delete cascade
);

create table public.data_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  source_version integer not null default 1,
  summary jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  unique (user_id, source)
);

create index exercises_owner_id_idx on public.exercises(owner_id);
create index workout_templates_user_id_idx on public.workout_templates(user_id);
create index template_supersets_user_id_idx on public.template_supersets(user_id);
create index template_supersets_template_id_idx on public.template_supersets(template_id);
create index template_exercises_user_id_idx on public.template_exercises(user_id);
create index template_exercises_template_id_idx on public.template_exercises(template_id);
create index template_exercises_exercise_id_idx on public.template_exercises(exercise_id);
create index scheduled_workouts_user_date_idx on public.scheduled_workouts(user_id, scheduled_date);
create index workouts_user_date_idx on public.workouts(user_id, workout_date desc);
create index workouts_user_status_idx on public.workouts(user_id, status);
create index workout_exercises_user_id_idx on public.workout_exercises(user_id);
create index workout_exercises_workout_id_idx on public.workout_exercises(workout_id);
create index workout_exercises_exercise_id_idx on public.workout_exercises(exercise_id);
create index workout_sets_user_id_idx on public.workout_sets(user_id);
create index workout_sets_workout_exercise_id_idx on public.workout_sets(workout_exercise_id);
create index data_imports_user_id_idx on public.data_imports(user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger exercises_set_updated_at before update on public.exercises for each row execute function public.set_updated_at();
create trigger workout_templates_set_updated_at before update on public.workout_templates for each row execute function public.set_updated_at();
create trigger workouts_set_updated_at before update on public.workouts for each row execute function public.set_updated_at();
create trigger workout_sets_set_updated_at before update on public.workout_sets for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_templates enable row level security;
alter table public.template_supersets enable row level security;
alter table public.template_exercises enable row level security;
alter table public.scheduled_workouts enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.data_imports enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy exercises_select_visible on public.exercises for select to authenticated using (owner_id is null or (select auth.uid()) = owner_id);
create policy exercises_insert_own on public.exercises for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy exercises_update_own on public.exercises for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy exercises_delete_own on public.exercises for delete to authenticated using ((select auth.uid()) = owner_id);

create policy workout_templates_select_own on public.workout_templates for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_templates_insert_own on public.workout_templates for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_templates_update_own on public.workout_templates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_templates_delete_own on public.workout_templates for delete to authenticated using ((select auth.uid()) = user_id);

create policy template_supersets_select_own on public.template_supersets for select to authenticated using ((select auth.uid()) = user_id);
create policy template_supersets_insert_own on public.template_supersets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy template_supersets_update_own on public.template_supersets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy template_supersets_delete_own on public.template_supersets for delete to authenticated using ((select auth.uid()) = user_id);

create policy template_exercises_select_own on public.template_exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy template_exercises_insert_own on public.template_exercises for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))) and (superset_id is null or exists (select 1 from public.template_supersets s where s.id = superset_id and s.user_id = (select auth.uid()) and s.template_id = template_id)));
create policy template_exercises_update_own on public.template_exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))) and (superset_id is null or exists (select 1 from public.template_supersets s where s.id = superset_id and s.user_id = (select auth.uid()) and s.template_id = template_id)));
create policy template_exercises_delete_own on public.template_exercises for delete to authenticated using ((select auth.uid()) = user_id);

create policy scheduled_workouts_select_own on public.scheduled_workouts for select to authenticated using ((select auth.uid()) = user_id);
create policy scheduled_workouts_insert_own on public.scheduled_workouts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy scheduled_workouts_update_own on public.scheduled_workouts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy scheduled_workouts_delete_own on public.scheduled_workouts for delete to authenticated using ((select auth.uid()) = user_id);

create policy workouts_select_own on public.workouts for select to authenticated using ((select auth.uid()) = user_id);
create policy workouts_insert_own on public.workouts for insert to authenticated with check ((select auth.uid()) = user_id and (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))));
create policy workouts_update_own on public.workouts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (template_id is null or exists (select 1 from public.workout_templates t where t.id = template_id and t.user_id = (select auth.uid()))));
create policy workouts_delete_own on public.workouts for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_exercises_select_own on public.workout_exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_exercises_insert_own on public.workout_exercises for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy workout_exercises_update_own on public.workout_exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and exists (select 1 from public.exercises e where e.id = exercise_id and (e.owner_id is null or e.owner_id = (select auth.uid()))));
create policy workout_exercises_delete_own on public.workout_exercises for delete to authenticated using ((select auth.uid()) = user_id);

create policy workout_sets_select_own on public.workout_sets for select to authenticated using ((select auth.uid()) = user_id);
create policy workout_sets_insert_own on public.workout_sets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workout_sets_update_own on public.workout_sets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workout_sets_delete_own on public.workout_sets for delete to authenticated using ((select auth.uid()) = user_id);

create policy data_imports_select_own on public.data_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy data_imports_insert_own on public.data_imports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy data_imports_update_own on public.data_imports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy data_imports_delete_own on public.data_imports for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.profiles, public.workout_templates, public.template_supersets, public.template_exercises, public.scheduled_workouts, public.workouts, public.workout_exercises, public.workout_sets, public.data_imports from anon;
grant select on public.exercises to authenticated;

commit;
