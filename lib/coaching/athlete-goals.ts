import type { AthleteGoal, AthleteGoalMetric } from "./types";

export const GOAL_TYPE_LABELS = {
  strength: "Strength",
  muscle_gain: "Muscle gain",
  general_fitness: "General fitness",
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  rowing: "Rowing",
  hybrid: "Hybrid",
  event_race: "Event / race preparation",
  custom: "Custom",
} as const;
export const GOAL_METRIC_LABELS: Record<AthleteGoalMetric, string> = {
  none: "No measured target",
  strength_load: "Exercise load",
  event_time: "Event time",
  distance: "Distance",
  duration: "Duration",
  custom: "Custom target",
};

export function parseGoalTime(value: string) {
  const parts = value.trim().split(":").map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0))
    return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}
export function formatGoalTime(seconds: number) {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}
export function goalTargetLabel(
  goal: Pick<
    AthleteGoal,
    | "metricType"
    | "targetValue"
    | "targetUnit"
    | "targetLabel"
    | "targetDistanceMetres"
    | "targetText"
  >,
) {
  if (goal.metricType === "strength_load" && goal.targetValue != null)
    return `${goal.targetLabel} · ${Number(goal.targetValue)} kg`;
  if (goal.metricType === "event_time" && goal.targetValue != null)
    return `${goal.targetDistanceMetres ? Number((goal.targetDistanceMetres / 1000).toFixed(2)) : ""} km · ${formatGoalTime(goal.targetValue)}`;
  if (goal.metricType === "distance" && goal.targetValue != null)
    return `${Number((goal.targetValue / 1000).toFixed(2))} km`;
  if (goal.metricType === "duration" && goal.targetValue != null)
    return formatGoalTime(goal.targetValue);
  if (goal.targetText) return goal.targetText;
  if (goal.targetValue != null)
    return `${Number(goal.targetValue)} ${goal.targetUnit}`.trim();
  return "";
}
export function goalProgressLabel(goal: AthleteGoal) {
  if (goal.currentValue == null) return "";
  if (goal.metricType === "strength_load")
    return `${Number(goal.currentValue)} kg → ${Number(goal.targetValue)} kg`;
  if (goal.metricType === "event_time")
    return `${formatGoalTime(goal.currentValue)} → ${formatGoalTime(goal.targetValue || 0)}`;
  if (goal.metricType === "distance")
    return `${Number((goal.currentValue / 1000).toFixed(2))} km → ${Number(((goal.targetValue || 0) / 1000).toFixed(2))} km`;
  if (goal.metricType === "duration")
    return `${formatGoalTime(goal.currentValue)} → ${formatGoalTime(goal.targetValue || 0)}`;
  return "";
}

export type AthleteGoalProgress = {
  available: boolean;
  currentLabel: string;
  targetLabel: string;
  percentage?: number;
  trendLabel: string;
  attention:
    | "goal_reached"
    | "target_approaching"
    | "limited_recent_data"
    | null;
};

const metricValueLabel = (goal: AthleteGoal, value: number) => {
  if (goal.metricType === "strength_load")
    return `${Number(value.toFixed(2))} kg`;
  if (goal.metricType === "event_time" || goal.metricType === "duration")
    return formatGoalTime(value);
  if (goal.metricType === "distance")
    return `${Number((value / 1000).toFixed(2))} km`;
  return String(value);
};

export function buildAthleteGoalProgress(
  goal: AthleteGoal,
  today = new Date(),
): AthleteGoalProgress {
  const measurable = [
    "strength_load",
    "event_time",
    "distance",
    "duration",
  ].includes(goal.metricType);
  const available =
    measurable &&
    goal.currentValue != null &&
    goal.targetValue != null &&
    goal.targetValue > 0;
  const targetLabel = goalTargetLabel(goal);
  const daysToTarget = goal.targetDate
    ? Math.ceil(
        (new Date(`${goal.targetDate}T12:00:00`).getTime() - today.getTime()) /
          86400000,
      )
    : null;
  if (!available)
    return {
      available: false,
      currentLabel: "No reliable matching data",
      targetLabel,
      trendLabel: "Limited recent data",
      attention:
        daysToTarget != null && daysToTarget >= 0 && daysToTarget <= 28
          ? "target_approaching"
          : measurable
            ? "limited_recent_data"
            : null,
    };
  const current = goal.currentValue!;
  const target = goal.targetValue!;
  const lowerIsBetter = goal.metricType === "event_time";
  const rawPercentage = lowerIsBetter
    ? (target / current) * 100
    : (current / target) * 100;
  let trendLabel = "Limited recent data";
  if (goal.previousValue != null) {
    const improvement = lowerIsBetter
      ? goal.previousValue - current
      : current - goal.previousValue;
    if (Math.abs(improvement) < 0.001) trendLabel = "Stable recent best";
    else if (improvement > 0)
      trendLabel = `${metricValueLabel(goal, Math.abs(improvement))} improvement from the earlier best`;
    else trendLabel = "Stable against the earlier best";
  } else if (goal.recentDataCount >= 2)
    trendLabel = "Recent matching data recorded";
  return {
    available: true,
    currentLabel: metricValueLabel(goal, current),
    targetLabel,
    percentage: Math.max(0, Math.min(100, Math.round(rawPercentage))),
    trendLabel,
    attention: goal.goalReached
      ? "goal_reached"
      : daysToTarget != null && daysToTarget >= 0 && daysToTarget <= 28
        ? "target_approaching"
        : goal.recentDataCount === 0
          ? "limited_recent_data"
          : null,
  };
}
export function goalTimingLabel(targetDate?: string | null, now = new Date()) {
  if (!targetDate) return "";
  const target = new Date(`${targetDate}T12:00:00`);
  const days = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (days < 0) return "Target date passed";
  if (days === 0) return "Today";
  const weeks = Math.ceil(days / 7);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}
