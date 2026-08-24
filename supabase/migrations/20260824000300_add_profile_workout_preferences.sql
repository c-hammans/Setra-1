begin;

alter table public.profiles
  add column if not exists show_workout_timing_popup boolean not null default true,
  add column if not exists show_pb_popup boolean not null default true;

grant update (display_name,preferred_unit,timezone,app_colour,show_workout_timing_popup,show_pb_popup)
  on public.profiles to authenticated;

commit;
