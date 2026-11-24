import type { CoachRosterClient, CoachRosterWeek } from "./types";
import { formatGoalTime } from "./athlete-goals.ts";

export type RosterSort = "adherence" | "attention" | "recent";
export type RosterFilters = {
  attentionOnly: boolean;
  groupId: string;
  programName: string;
};

export const adherenceRate = (completed: number, planned: number) =>
  planned > 0 ? Math.round((completed / planned) * 100) : null;

export function rosterSummary(clients: CoachRosterClient[]) {
  const planned = clients.reduce((sum, item) => sum + item.currentPlanned, 0);
  const completed = clients.reduce(
    (sum, item) => sum + item.currentCompleted,
    0,
  );
  return {
    activeClients: clients.length,
    planned,
    completed,
    adherence: adherenceRate(completed, planned) ?? 0,
    attentionClients: clients.filter((item) => item.attentionCount > 0).length,
    clientsWithGoals: clients.filter((item) => item.activeGoalCount > 0).length,
    averageSessions: clients.length
      ? Number((completed / clients.length).toFixed(1))
      : 0,
  };
}

export function rosterTrend(clients: CoachRosterClient[]): CoachRosterWeek[] {
  const weeks = new Map<string, CoachRosterWeek>();
  clients.forEach((client) =>
    client.weeklyTrend.forEach((item) => {
      const current = weeks.get(item.weekStart) || {
        weekStart: item.weekStart,
        planned: 0,
        completed: 0,
      };
      current.planned += item.planned;
      current.completed += item.completed;
      weeks.set(item.weekStart, current);
    }),
  );
  return [...weeks.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

export function clientCompletionTrend(client: CoachRosterClient) {
  if (client.weeklyTrend.length < 4) return "limited" as const;
  const midpoint = Math.floor(client.weeklyTrend.length / 2);
  const older = client.weeklyTrend.slice(0, midpoint);
  const recent = client.weeklyTrend.slice(midpoint);
  const totals = (items: CoachRosterWeek[]) =>
    items.reduce(
      (sum, item) => ({
        planned: sum.planned + item.planned,
        completed: sum.completed + item.completed,
      }),
      { planned: 0, completed: 0 },
    );
  const first = totals(older),
    last = totals(recent);
  if (first.planned < 2 || last.planned < 2) return "limited" as const;
  const difference =
    last.completed / last.planned - first.completed / first.planned;
  if (difference <= -0.15) return "lower" as const;
  if (difference >= 0.15) return "improving" as const;
  return "stable" as const;
}

export function filterAndSortRoster(
  clients: CoachRosterClient[],
  filters: RosterFilters,
  sort: RosterSort,
) {
  const filtered = clients.filter(
    (item) =>
      (!filters.attentionOnly || item.attentionCount > 0) &&
      (!filters.groupId || item.groupIds.includes(filters.groupId)) &&
      (!filters.programName || item.activeProgramName === filters.programName),
  );
  return [...filtered].sort((a, b) => {
    if (sort === "attention")
      return (
        b.attentionCount - a.attentionCount ||
        a.displayName.localeCompare(b.displayName)
      );
    if (sort === "recent")
      return (
        (b.latestCompletedDate || "").localeCompare(
          a.latestCompletedDate || "",
        ) || a.displayName.localeCompare(b.displayName)
      );
    const aRate = adherenceRate(a.currentCompleted, a.currentPlanned),
      bRate = adherenceRate(b.currentCompleted, b.currentPlanned);
    return (
      (aRate == null ? 1 : 0) - (bRate == null ? 1 : 0) ||
      (aRate ?? 0) - (bRate ?? 0) ||
      a.displayName.localeCompare(b.displayName)
    );
  });
}

export function rosterGoalValue(
  metric: CoachRosterClient["primaryGoalMetric"],
  value?: number | null,
  unit?: string | null,
) {
  if (value == null) return "No matching data";
  if (metric === "event_time" || metric === "duration")
    return formatGoalTime(value);
  if (metric === "distance") return `${Number((value / 1000).toFixed(2))} km`;
  if (metric === "strength_load")
    return `${Number(value.toFixed(2))} ${unit || "kg"}`;
  return String(value);
}
