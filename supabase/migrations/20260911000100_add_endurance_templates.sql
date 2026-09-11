begin;

create table if not exists public.endurance_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  activity_type text not null check (char_length(activity_type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  planned_duration_minutes numeric(10,2) check (planned_duration_minutes is null or planned_duration_minutes > 0),
  planned_distance_metres numeric(12,3) check (planned_distance_metres is null or planned_distance_metres >= 0),
  target_rpe numeric(3,1) check (target_rpe is null or target_rpe between 0 and 10),
  environment text,
  training_category text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id,user_id),
  unique (user_id,client_id)
);

create table if not exists public.endurance_template_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null,
  client_id text not null,
  block_type text not null check (block_type in ('warmup','main','interval','recovery','rest','cooldown','custom','repeat_group')),
  position integer not null check (position >= 0),
  title text not null default '' check (char_length(title) <= 120),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  repetitions integer check (repetitions is null or repetitions between 1 and 1000),
  planned_duration_seconds integer check (planned_duration_seconds is null or planned_duration_seconds >= 0),
  planned_distance_metres numeric(12,3) check (planned_distance_metres is null or planned_distance_metres >= 0),
  recovery_duration_seconds integer check (recovery_duration_seconds is null or recovery_duration_seconds >= 0),
  recovery_distance_metres numeric(12,3) check (recovery_distance_metres is null or recovery_distance_metres >= 0),
  intensity_target text not null default '' check (char_length(intensity_target) <= 160),
  completion_type text not null default 'open' check (completion_type in ('open','time','distance','lap_button')),
  target_metric text check (target_metric is null or target_metric in ('pace','speed','heart_rate','heart_rate_zone','power','power_zone','cadence','rpe','effort','custom')),
  target_min_value numeric(12,3) check (target_min_value is null or target_min_value >= 0),
  target_max_value numeric(12,3) check (target_max_value is null or target_max_value >= 0),
  target_unit text check (target_unit is null or char_length(target_unit) between 1 and 40),
  stroke text check (stroke is null or char_length(stroke) between 1 and 40),
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  parent_client_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id,position),
  unique (template_id,client_id),
  foreign key (template_id,user_id) references public.endurance_templates(id,user_id) on delete cascade,
  check (parent_client_id is null or (char_length(parent_client_id) between 1 and 160 and parent_client_id <> client_id))
);

alter table public.training_sessions add column if not exists endurance_template_id uuid;
alter table public.training_sessions drop constraint if exists training_sessions_endurance_template_user_fk;
alter table public.training_sessions add constraint training_sessions_endurance_template_user_fk
  foreign key (endurance_template_id,user_id) references public.endurance_templates(id,user_id) on delete set null (endurance_template_id);

create index if not exists endurance_templates_user_idx on public.endurance_templates(user_id,updated_at desc);
create index if not exists endurance_template_blocks_template_idx on public.endurance_template_blocks(template_id,position);
create index if not exists training_sessions_endurance_template_idx on public.training_sessions(user_id,endurance_template_id) where endurance_template_id is not null;

drop trigger if exists endurance_templates_set_updated_at on public.endurance_templates;
create trigger endurance_templates_set_updated_at before update on public.endurance_templates for each row execute function public.set_updated_at();
drop trigger if exists endurance_template_blocks_set_updated_at on public.endurance_template_blocks;
create trigger endurance_template_blocks_set_updated_at before update on public.endurance_template_blocks for each row execute function public.set_updated_at();

alter table public.endurance_templates enable row level security;
alter table public.endurance_template_blocks enable row level security;

drop policy if exists endurance_templates_own on public.endurance_templates;
create policy endurance_templates_own on public.endurance_templates for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists endurance_template_blocks_own on public.endurance_template_blocks;
create policy endurance_template_blocks_own on public.endurance_template_blocks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.endurance_templates template where template.id=template_id and template.user_id=(select auth.uid())));

revoke all on public.endurance_templates,public.endurance_template_blocks from anon;
grant select,insert,update,delete on public.endurance_templates,public.endurance_template_blocks to authenticated;

commit;
