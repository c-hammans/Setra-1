begin;

alter table public.profiles
  add column if not exists body_weight_kg numeric(6,2);

alter table public.profiles
  drop constraint if exists profiles_body_weight_kg_check;

alter table public.profiles
  add constraint profiles_body_weight_kg_check
  check (body_weight_kg is null or (body_weight_kg > 0 and body_weight_kg <= 1000));

comment on column public.profiles.body_weight_kg is
  'Optional canonical body weight in kilograms, used for relative-strength calculations.';

grant update (body_weight_kg) on public.profiles to authenticated;

commit;
