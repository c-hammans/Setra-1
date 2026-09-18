begin;

-- The Awards API authenticates the user with their cookie first, then uses a
-- server-only Supabase secret to evaluate and persist awards. Explicit grants
-- are required because Setra's original schema intentionally revoked broad
-- table privileges.
grant select,update on public.profiles to service_role;
grant select on public.training_sessions,public.workouts,public.workout_exercises,public.workout_sets,public.workout_templates,public.endurance_templates to service_role;
grant select,insert,update on public.user_usage_days,public.user_achievements,public.training_plan_occurrences to service_role;

commit;
