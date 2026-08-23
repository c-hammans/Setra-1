insert into public.exercises (id,owner_id,name,muscle_group,equipment) values
  ('machine-hip-abduction',null,'Machine Hip Abduction','Glutes','Machine'),
  ('machine-hip-adduction',null,'Machine Hip Adduction','Adductors','Machine'),
  ('cable-crunches',null,'Cable Crunches','Core','Cable'),
  ('leg-raises',null,'Leg Raises','Core','Bodyweight'),
  ('lying-leg-raise',null,'Lying Leg Raise','Core','Bodyweight'),
  ('hanging-leg-raise',null,'Hanging Leg Raise','Core','Bodyweight'),
  ('captains-chair-leg-raise',null,'Captain''s Chair Leg Raise','Core','Machine'),
  ('single-leg-squat',null,'Single Leg Squat','Quads','Bodyweight'),
  ('single-leg-squat-to-box',null,'Single Leg Squat to Box','Quads','Bodyweight'),
  ('single-leg-squat-off-box',null,'Single Leg Squat off Box','Quads','Bodyweight'),
  ('pistol-squat',null,'Pistol Squat','Quads','Bodyweight'),
  ('assisted-pistol-squat',null,'Assisted Pistol Squat','Quads','Bodyweight'),
  ('trx-single-leg-squat',null,'TRX Single Leg Squat','Quads','Suspension Trainer'),
  ('dumbbell-single-leg-squat',null,'Dumbbell Single Leg Squat','Quads','Dumbbell'),
  ('kettlebell-single-leg-squat',null,'Kettlebell Single Leg Squat','Quads','Kettlebell'),
  ('skater-squat',null,'Skater Squat','Quads','Bodyweight')
on conflict (id) do update set
  name=excluded.name,
  muscle_group=excluded.muscle_group,
  equipment=excluded.equipment,
  updated_at=now();
