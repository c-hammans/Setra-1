begin;

-- Additive metadata for the Setra canonical endurance prescription. Existing
-- sessions remain valid and retain their current client IDs and block rows.
alter table public.training_sessions
  add column if not exists environment text,
  add column if not exists training_category text,
  add column if not exists planned_session_id uuid,
  add column if not exists completion_metadata jsonb not null default '{}'::jsonb;

alter table public.training_sessions
  drop constraint if exists training_sessions_environment_check,
  drop constraint if exists training_sessions_training_category_check,
  drop constraint if exists training_sessions_planned_session_user_fk,
  drop constraint if exists training_sessions_completion_metadata_check;

alter table public.training_sessions
  add constraint training_sessions_environment_check
    check (environment is null or environment in ('unspecified','outdoor','indoor','treadmill','track','pool','open_water','trainer','erg')),
  add constraint training_sessions_training_category_check
    check (training_category is null or training_category in ('easy','long','tempo','threshold','intervals','recovery','race','technique','custom')),
  add constraint training_sessions_planned_session_user_fk
    foreign key (planned_session_id,user_id)
    references public.training_sessions(id,user_id)
    on delete set null (planned_session_id),
  add constraint training_sessions_completion_metadata_check
    check (jsonb_typeof(completion_metadata) = 'object');

create index if not exists training_sessions_planned_session_idx
  on public.training_sessions(user_id,planned_session_id)
  where planned_session_id is not null;

comment on column public.training_sessions.planned_session_id is
  'Links an actual/completed endurance activity to the unchanged planned prescription it fulfilled.';
comment on column public.training_sessions.completion_metadata is
  'Provider-neutral actual activity details such as future splits; external provider payloads remain in external_metadata.';

-- The ordered block table is the canonical workout tree. parent_client_id may
-- now point to another repeat group, allowing nested repeats without a schema
-- redesign. Existing flat and one-level sessions remain unchanged.
alter table public.training_session_blocks
  add column if not exists stroke text;

alter table public.training_session_blocks
  drop constraint if exists training_session_blocks_block_type_check,
  drop constraint if exists training_session_blocks_target_metric_check,
  drop constraint if exists training_session_blocks_parent_client_id_check,
  drop constraint if exists training_session_blocks_stroke_check;

alter table public.training_session_blocks
  add constraint training_session_blocks_block_type_check
    check (block_type in ('warmup','main','interval','recovery','rest','cooldown','custom','repeat_group')),
  add constraint training_session_blocks_target_metric_check
    check (
      target_metric is null
      or target_metric in ('pace','speed','heart_rate','heart_rate_zone','power','power_zone','cadence','rpe','effort','custom')
    ),
  add constraint training_session_blocks_parent_client_id_check
    check (
      parent_client_id is null
      or (
        char_length(parent_client_id) between 1 and 160
        and client_id is not null
        and parent_client_id <> client_id
      )
    ),
  add constraint training_session_blocks_stroke_check
    check (stroke is null or char_length(stroke) between 1 and 40);

comment on column public.training_session_blocks.parent_client_id is
  'Canonical tree parent. Repeat groups can contain executable steps or nested repeat groups in the same session.';
comment on column public.training_session_blocks.stroke is
  'Optional swim stroke or activity-specific technique label.';

commit;
