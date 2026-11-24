export const COACH_ATTENTION_RULES = {
  highRpe: 9,
  inactivityDays: 14,
} as const;

export type CoachAttentionReason =
  | "session_overdue"
  | "harder_than_expected"
  | "high_rpe"
  | "awaiting_coach_review"
  | "no_recent_session"
  | "goal_reached"
  | "goal_target_approaching"
  | "goal_limited_data";

export function coachAttentionLabel(
  reason: CoachAttentionReason,
  rpe?: number | null,
) {
  if (reason === "session_overdue") return "Session overdue";
  if (reason === "harder_than_expected") return "Harder than expected";
  if (reason === "high_rpe")
    return `RPE ${rpe ?? COACH_ATTENTION_RULES.highRpe}`;
  if (reason === "awaiting_coach_review") return "Awaiting coach review";
  if (reason === "goal_reached") return "Goal reached";
  if (reason === "goal_target_approaching") return "Target date approaching";
  if (reason === "goal_limited_data") return "Limited recent goal data";
  return "No recent completed session";
}

export function isHighSessionRpe(value?: number | null) {
  return value != null && value >= COACH_ATTENTION_RULES.highRpe;
}
