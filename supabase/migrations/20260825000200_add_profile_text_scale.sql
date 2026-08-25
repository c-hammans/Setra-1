alter table public.profiles
  add column if not exists text_scale numeric(2,1) not null default 1.0;

alter table public.profiles
  drop constraint if exists profiles_text_scale_check;

alter table public.profiles
  add constraint profiles_text_scale_check
  check (text_scale in (1.0,1.1,1.2,1.3));

grant update (display_name,full_name,date_of_birth,preferred_unit,timezone,training_goal,experience_level,app_colour,appearance_mode,text_scale,show_workout_timing_popup,show_pb_popup)
  on public.profiles to authenticated;
