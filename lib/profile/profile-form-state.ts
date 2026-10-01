import type { ProfileSettings } from "./profile-service";

export function profileSettingsMatch(current: ProfileSettings, saved: ProfileSettings) {
  const keys = Object.keys(saved) as (keyof ProfileSettings)[];
  return keys.length === Object.keys(current).length && keys.every((key) => current[key] === saved[key]);
}

export function profileFormIsDirty(
  current: ProfileSettings,
  saved: ProfileSettings,
  baselineLoaded: boolean,
) {
  return baselineLoaded && !profileSettingsMatch(current, saved);
}
