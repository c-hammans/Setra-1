export const NAVIGATION_RESUME_WINDOW_MS = 5 * 60 * 1000;

export type NavigationResumeState = {
  location: string;
  backgroundedAt: number;
  view?: "live-workout";
};

export function mostRecentNavigationResume(
  states: Array<NavigationResumeState | null>,
) {
  return states
    .filter((state): state is NavigationResumeState => Boolean(state))
    .sort((a, b) => b.backgroundedAt - a.backgroundedAt)[0] || null;
}

export function isRecentNavigationResume(
  state: NavigationResumeState | null,
  now = Date.now(),
) {
  return Boolean(
    state &&
      Number.isFinite(state.backgroundedAt) &&
      now >= state.backgroundedAt &&
      now - state.backgroundedAt <= NAVIGATION_RESUME_WINDOW_MS,
  );
}

export function resumableLocation(value: string) {
  return (
    value === "/" ||
    /^\/(?:profile|premium|awards|friends|import|integrations|support|legal|notifications|coaching(?:\/(?:analytics|goals|groups|library|programs|progress|[0-9a-f-]{36}))?)(?:[?#].*)?$/i.test(
      value,
    ) ||
    /^\/\?tab=(?:plan|history|pbs)(?:[&#].*)?$/.test(value)
  );
}

export function restoredLocation(
  current: string,
  saved: NavigationResumeState | null,
  now = Date.now(),
) {
  if (current !== "/" || !saved || !isRecentNavigationResume(saved, now)) return null;
  return saved.location !== "/" && resumableLocation(saved.location) ? saved.location : null;
}
