export const NAVIGATION_RESUME_WINDOW_MS = 5 * 60 * 1000;

export type NavigationResumeState = {
  location: string;
  backgroundedAt: number;
};

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
    /^\/(?:profile|premium|awards|friends|import|support|legal)(?:[?#].*)?$/.test(
      value,
    ) ||
    /^\/\?tab=(?:plan|history|pbs)(?:[&#].*)?$/.test(value)
  );
}
