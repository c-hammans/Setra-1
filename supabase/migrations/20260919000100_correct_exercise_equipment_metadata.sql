begin;

-- Correct reviewed catalogue metadata without changing exercise IDs or historical references.
-- This is intentionally additive/reversible and does not merge similarly named movements.
update public.exercises
set equipment = 'Bodyweight'
where id in ('air-squat','chair-squat','half-air-squat')
  and equipment = 'Barbell';

commit;
