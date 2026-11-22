import type { CoachWeeklyReview, CoachWeeklyReviewNote, CoachWeeklyReviewSession } from "./types.ts";
import { addCalendarDays } from "../setra/week.ts";

type Input = {
  relationshipId: string;
  weekStart: string;
  today: string;
  sessions: CoachWeeklyReviewSession[];
  note?: CoachWeeklyReviewNote | null;
};

export function buildCoachWeeklyReview({ relationshipId, weekStart, today, sessions, note }: Input): CoachWeeklyReview {
  const visible = sessions
    .filter((session) => session.status !== "rescheduled")
    .map((session) => session.status === "planned" && session.date < today ? { ...session, status: "missed" as const } : session)
    .sort((a, b) => a.date.localeCompare(b.date));
  const completed = visible.filter((session) => session.status === "completed" || session.status === "partial");
  const planned = visible.filter((session) => session.status !== "cancelled");
  const skipped = visible.filter((session) => session.status === "skipped" || session.status === "cancelled");
  const missed = visible.filter((session) => session.status === "missed");
  const sportMap = new Map<string, { activityType: string; distanceMetres: number; durationSeconds: number; sessions: number }>();
  completed.filter((session) => session.modality === "endurance").forEach((session) => {
    const current = sportMap.get(session.activityType) || { activityType: session.activityType, distanceMetres: 0, durationSeconds: 0, sessions: 0 };
    current.sessions += 1;
    current.distanceMetres += session.actualDistanceMetres || 0;
    current.durationSeconds += session.actualDurationSeconds || 0;
    sportMap.set(session.activityType, current);
  });
  return {
    relationshipId,
    weekStart,
    weekEnd: addCalendarDays(weekStart, 6),
    plannedSessions: planned.length,
    completedSessions: completed.length,
    skippedSessions: skipped.length,
    missedSessions: missed.length,
    completionRate: planned.length ? completed.length / planned.length : 0,
    totalDurationSeconds: completed.reduce((sum, session) => sum + (session.actualDurationSeconds || 0), 0),
    strengthSessions: completed.filter((session) => session.modality === "strength").length,
    enduranceSessions: completed.filter((session) => session.modality === "endurance").length,
    strengthSets: completed.reduce((sum, session) => sum + (session.actualSets || 0), 0),
    strengthVolumeKg: completed.reduce((sum, session) => sum + (session.actualVolumeKg || 0), 0),
    sportTotals: [...sportMap.values()].filter((sport) => sport.distanceMetres > 0 || sport.durationSeconds > 0),
    sessions: visible,
    note,
  };
}
