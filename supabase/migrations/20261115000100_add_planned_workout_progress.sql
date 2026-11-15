alter table public.profiles
  add column if not exists planned_workout_progress text not null default 'sets';

alter table public.profiles
  drop constraint if exists profiles_planned_workout_progress_check;

alter table public.profiles
  add constraint profiles_planned_workout_progress_check
  check (planned_workout_progress in ('sets', 'percentage'));

comment on column public.profiles.planned_workout_progress is
  'Controls whether planned strength workout progress is displayed as completed sets or a percentage.';

grant update (planned_workout_progress) on public.profiles to authenticated;
