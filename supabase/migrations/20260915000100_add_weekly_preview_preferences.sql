alter table public.profiles
  add column if not exists week_starts_on smallint not null default 1,
  add column if not exists last_weekly_preview_week_start date;

alter table public.profiles
  drop constraint if exists profiles_week_starts_on_check;

alter table public.profiles
  add constraint profiles_week_starts_on_check
  check (week_starts_on between 0 and 6);

comment on column public.profiles.week_starts_on is 'Weekday index matching JavaScript Date.getDay(): Sunday 0 through Saturday 6.';
comment on column public.profiles.last_weekly_preview_week_start is 'Start date of the most recently opened automatic weekly preview.';

grant update (week_starts_on, last_weekly_preview_week_start)
  on public.profiles to authenticated;
