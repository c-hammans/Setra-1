begin;

alter table public.profiles add column if not exists onboarding_completed_at timestamptz;

-- Existing users keep their current experience. Only accounts created after this
-- migration see first-use onboarding.
update public.profiles set onboarding_completed_at=coalesce(onboarding_completed_at,now());

grant update (training_preference,preferred_unit,weekly_session_goal,onboarding_completed_at) on public.profiles to authenticated;

commit;
