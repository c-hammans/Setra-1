begin;

alter table public.template_warmup_items
  add column if not exists title text not null default '';

alter table public.workout_warmup_items
  add column if not exists title text not null default '';

alter table public.template_warmup_items
  drop constraint if exists template_warmup_items_title_length_check;

alter table public.template_warmup_items
  add constraint template_warmup_items_title_length_check
  check (char_length(title) <= 80);

alter table public.workout_warmup_items
  drop constraint if exists workout_warmup_items_title_length_check;

alter table public.workout_warmup_items
  add constraint workout_warmup_items_title_length_check
  check (char_length(title) <= 80);

commit;
