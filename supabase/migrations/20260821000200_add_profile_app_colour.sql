begin;

alter table public.profiles
  add column app_colour text not null default '#409ECE'
  check (app_colour in ('#409ECE','#FF6B6B','#F6C445','#55B96D','#8B72D9','#000000','#FFFFFF'));

commit;
