begin;

-- Extend the existing ordered session blocks into portable workout steps.
-- Existing warm-up/main/cool-down text blocks remain valid because every new
-- column is nullable or has a backwards-compatible default.
alter table public.training_session_blocks
  add column if not exists completion_type text not null default 'open',
  add column if not exists target_metric text,
  add column if not exists target_min_value numeric(12,3),
  add column if not exists target_max_value numeric(12,3),
  add column if not exists target_unit text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.training_session_blocks
  drop constraint if exists training_session_blocks_completion_type_check,
  drop constraint if exists training_session_blocks_target_metric_check,
  drop constraint if exists training_session_blocks_target_values_check,
  drop constraint if exists training_session_blocks_target_unit_check,
  drop constraint if exists training_session_blocks_provider_metadata_check;

alter table public.training_session_blocks
  add constraint training_session_blocks_completion_type_check
    check (completion_type in ('open','time','distance','lap_button')),
  add constraint training_session_blocks_target_metric_check
    check (
      target_metric is null
      or target_metric in ('pace','speed','heart_rate','power','cadence','rpe','effort')
    ),
  add constraint training_session_blocks_target_values_check
    check (
      (target_min_value is null or target_min_value >= 0)
      and (target_max_value is null or target_max_value >= 0)
      and (
        target_min_value is null
        or target_max_value is null
        or target_min_value <= target_max_value
      )
    ),
  add constraint training_session_blocks_target_unit_check
    check (target_unit is null or char_length(target_unit) between 1 and 40),
  add constraint training_session_blocks_provider_metadata_check
    check (jsonb_typeof(provider_metadata) = 'object');

comment on column public.training_session_blocks.completion_type is
  'How the step ends: open, elapsed time, distance, or a manual lap-button press.';
comment on column public.training_session_blocks.target_metric is
  'Portable workout target such as pace, speed, heart rate, power, cadence, RPE, or effort.';
comment on column public.training_session_blocks.target_min_value is
  'Lower numeric target in target_unit. Pace values are stored as seconds per configured distance unit.';
comment on column public.training_session_blocks.target_max_value is
  'Upper numeric target in target_unit. Equal min/max values represent a single target.';
comment on column public.training_session_blocks.provider_metadata is
  'Reserved provider-specific step metadata for future watch and training-platform exports.';

commit;
