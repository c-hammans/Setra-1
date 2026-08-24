begin;

alter table public.profiles
  add column if not exists full_name text check (char_length(full_name) between 1 and 120),
  add column if not exists date_of_birth date,
  add column if not exists training_goal text check (char_length(training_goal) between 1 and 240),
  add column if not exists experience_level text check (experience_level in ('beginner','intermediate','advanced')),
  add column if not exists appearance_mode text not null default 'system' check (appearance_mode in ('light','dark','system'));

update public.profiles set app_colour='#6B7280' where app_colour in ('#000000','#FFFFFF');
alter table public.profiles drop constraint if exists profiles_app_colour_check;
alter table public.profiles add constraint profiles_app_colour_check
  check (app_colour in ('#409ECE','#FF6B6B','#F6C445','#55B96D','#8B72D9','#6B7280'));

grant update (display_name,full_name,date_of_birth,preferred_unit,timezone,training_goal,experience_level,app_colour,appearance_mode,show_workout_timing_popup,show_pb_popup)
  on public.profiles to authenticated;

commit;
