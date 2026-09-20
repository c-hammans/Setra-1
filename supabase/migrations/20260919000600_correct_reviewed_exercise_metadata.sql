begin;

-- Correct reviewed metadata in place. Stable exercise IDs preserve templates,
-- workout history and PB references.
update public.exercises as exercise
set equipment=correction.equipment
from (values
  ('arnold-press','Dumbbell'),
  ('bayesian-curl','Cable'),
  ('concentration-curl','Dumbbell'),
  ('drag-curl','Barbell'),
  ('hammer-curl','Dumbbell'),
  ('spider-curl','Dumbbell'),
  ('zottman-curl','Dumbbell'),
  ('cuban-press','Dumbbell'),
  ('face-pull','Cable'),
  ('pallof-press','Cable'),
  ('front-hold','Plate'),
  ('monkey-row','Dumbbell'),
  ('poliquin-raise','Dumbbell'),
  ('leg-extension','Machine'),
  ('lying-leg-curl','Machine'),
  ('one-legged-leg-extension','Machine'),
  ('one-legged-lying-leg-curl','Machine'),
  ('one-legged-seated-leg-curl','Machine'),
  ('seated-leg-curl','Machine'),
  ('standing-leg-curl','Machine')
) as correction(id,equipment)
where exercise.id=correction.id and exercise.owner_id is null;

commit;
