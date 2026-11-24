import test from "node:test";
import assert from "node:assert/strict";
import {
  clientCompletionTrend,
  filterAndSortRoster,
  rosterSummary,
  rosterTrend,
} from "./roster-analytics.ts";
import type { CoachRosterClient } from "./types.ts";

const client = (
  id: number,
  update: Partial<CoachRosterClient> = {},
): CoachRosterClient => ({
  relationshipId: `r${id}`,
  clientUserId: `u${id}`,
  username: `user${id}`,
  displayName: `Athlete ${id}`,
  weekStart: "2026-11-23",
  currentPlanned: 4,
  currentCompleted: 3,
  periodPlanned: 16,
  periodCompleted: 12,
  totalTrainingSeconds: 1000,
  strengthSessions: 2,
  enduranceSessions: 1,
  primaryGoalReached: false,
  activeGoalCount: 1,
  groupIds: id % 2 ? ["run"] : [],
  groupNames: id % 2 ? ["Run Squad"] : [],
  attentionCount: id % 3 === 0 ? 1 : 0,
  weeklyTrend: [
    { weekStart: "2026-11-02", planned: 4, completed: 4 },
    { weekStart: "2026-11-09", planned: 4, completed: 4 },
    { weekStart: "2026-11-16", planned: 4, completed: 2 },
    { weekStart: "2026-11-23", planned: 4, completed: 2 },
  ],
  ...update,
});

test("roster summary handles a single client", () => {
  assert.deepEqual(rosterSummary([client(1)]), {
    activeClients: 1,
    planned: 4,
    completed: 3,
    adherence: 75,
    attentionClients: 0,
    clientsWithGoals: 1,
    averageSessions: 3,
  });
});
test("roster aggregation remains stable with more than twenty clients", () => {
  const clients = Array.from({ length: 24 }, (_, index) => client(index + 1));
  assert.equal(rosterSummary(clients).activeClients, 24);
  assert.equal(rosterTrend(clients).at(-1)?.planned, 96);
});
test("client trend flags a meaningful recent completion reduction neutrally", () => {
  assert.equal(clientCompletionTrend(client(1)), "lower");
});
test("roster filters groups and attention without duplicating clients", () => {
  const clients = [client(1), client(2), client(3)];
  assert.deepEqual(
    filterAndSortRoster(
      clients,
      { attentionOnly: true, groupId: "run", programName: "" },
      "attention",
    ).map((item) => item.relationshipId),
    ["r3"],
  );
});
