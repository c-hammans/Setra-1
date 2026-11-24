"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { coachAttentionLabel } from "@/lib/coaching/attention-rules";
import { CoachingService } from "@/lib/coaching/coaching-service";
import {
  adherenceRate,
  clientCompletionTrend,
  filterAndSortRoster,
  rosterGoalValue,
  rosterSummary,
  rosterTrend,
  type RosterSort,
} from "@/lib/coaching/roster-analytics";
import type {
  CoachAttentionItem,
  CoachRosterClient,
} from "@/lib/coaching/types";
import { DiaryService } from "@/lib/data/diary-service";
import {
  createSetraTheme,
  useResolvedAppearance,
} from "@/lib/setra/appearance";
import { localDateKey, parseLocalDate } from "@/lib/setra/week";
import "./analytics.css";

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";
const dateLabel = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-AU", {
        day: "numeric",
        month: "short",
      }).format(parseLocalDate(value))
    : "No recent session";
const durationLabel = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};
const feelLabel = (value?: CoachRosterClient["latestSessionFeel"]) =>
  value === "harder"
    ? "Harder than expected"
    : value === "easier"
      ? "Easier than expected"
      : value === "expected"
        ? "As expected"
        : "";

export default function CoachRosterAnalyticsPage() {
  const { user } = useAuth();
  const service = useMemo(() => (user ? new CoachingService() : null), [user]);
  const today = localDateKey();
  const [range, setRange] = useState<4 | 12>(4);
  const [clients, setClients] = useState<CoachRosterClient[]>([]);
  const [attention, setAttention] = useState<CoachAttentionItem[]>([]);
  const [sort, setSort] = useState<RosterSort>("adherence");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [programName, setProgramName] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  const refresh = useCallback(async () => {
    if (!user || !service) return;
    setLoading(true);
    setMessage("");
    try {
      const [rows, dashboard, profile] = await Promise.all([
        service.rosterAnalytics(today, range),
        service.dashboard(today),
        new DiaryService(user.id).loadProfile(),
      ]);
      const attentionCounts = new Map<string, number>();
      dashboard.attention.forEach((item) =>
        attentionCounts.set(
          item.relationshipId,
          (attentionCounts.get(item.relationshipId) || 0) + 1,
        ),
      );
      setClients(
        rows.map((row) => ({
          ...row,
          attentionCount: attentionCounts.get(row.relationshipId) || 0,
        })),
      );
      setAttention(dashboard.attention);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Roster analytics could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [range, service, today, user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const summary = rosterSummary(clients);
  const trend = rosterTrend(clients);
  const visible = filterAndSortRoster(
    clients,
    { attentionOnly, groupId, programName },
    sort,
  );
  const maxPlanned = Math.max(1, ...trend.map((item) => item.planned));
  const groups = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((client) =>
      client.groupIds.forEach((id, index) =>
        map.set(id, client.groupNames[index] || "Group"),
      ),
    );
    return [...map]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clients]);
  const programs = [
    ...new Set(
      clients
        .map((client) => client.activeProgramName)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  const lowerClients = clients.filter(
    (client) => clientCompletionTrend(client) === "lower",
  ).length;
  const theme = createSetraTheme(accent, resolved, textScale);
  return (
    <main
      className="roster-analytics-screen"
      style={theme}
      data-theme={resolved}
    >
      <header className="roster-analytics-header">
        <Link href="/coaching" aria-label="Back to Coaching">
          ‹
        </Link>
        <div>
          <small>COACHING</small>
          <b>Roster Analytics</b>
        </div>
        <span />
      </header>
      <div className="roster-analytics-content">
        <section className="roster-analytics-intro">
          <div>
            <span>ROSTER OVERVIEW</span>
            <h1>Your athletes, at a glance.</h1>
            <p>
              Adherence, training, goals and existing attention items across
              active authorised clients.
            </p>
          </div>
          <nav>
            <button
              className={range === 4 ? "active" : ""}
              onClick={() => setRange(4)}
            >
              4 weeks
            </button>
            <button
              className={range === 12 ? "active" : ""}
              onClick={() => setRange(12)}
            >
              12 weeks
            </button>
          </nav>
        </section>
        {message && (
          <p className="roster-message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="roster-empty">Loading roster analytics...</p>
        ) : (
          <>
            <section className="roster-summary">
              <div>
                <b>{summary.activeClients}</b>
                <small>Active clients</small>
              </div>
              <div>
                <b>
                  {summary.completed}/{summary.planned}
                </b>
                <small>This week</small>
              </div>
              <div>
                <b>{summary.adherence}%</b>
                <small>Adherence</small>
              </div>
              <div>
                <b>{summary.attentionClients}</b>
                <small>Need attention</small>
              </div>
              <div>
                <b>{summary.clientsWithGoals}</b>
                <small>With active goals</small>
              </div>
              <div>
                <b>{summary.averageSessions}</b>
                <small>Sessions / client</small>
              </div>
            </section>
            <section className="roster-trends">
              <header>
                <div>
                  <span>{range}-WEEK TREND</span>
                  <h2>Training across the roster</h2>
                </div>
                <p>
                  {durationLabel(
                    clients.reduce(
                      (sum, item) => sum + item.totalTrainingSeconds,
                      0,
                    ),
                  )}{" "}
                  recorded ·{" "}
                  {clients.reduce(
                    (sum, item) => sum + item.strengthSessions,
                    0,
                  )}{" "}
                  strength ·{" "}
                  {clients.reduce(
                    (sum, item) => sum + item.enduranceSessions,
                    0,
                  )}{" "}
                  endurance
                </p>
              </header>
              <div className="roster-trend-chart">
                {trend.map((item) => {
                  const rate = adherenceRate(item.completed, item.planned);
                  return (
                    <article key={item.weekStart}>
                      <div>
                        <i
                          style={{
                            height: `${(item.planned / maxPlanned) * 100}%`,
                          }}
                        >
                          <em
                            style={{
                              height: `${item.planned ? (item.completed / item.planned) * 100 : 0}%`,
                            }}
                          />
                        </i>
                      </div>
                      <b>{rate == null ? "–" : `${rate}%`}</b>
                      <small>{dateLabel(item.weekStart)}</small>
                    </article>
                  );
                })}
              </div>
              {lowerClients > 0 && (
                <p>
                  {lowerClients}{" "}
                  {lowerClients === 1 ? "client has" : "clients have"} lower
                  recent completion than the earlier half of this period. This
                  is context for review, not a performance score.
                </p>
              )}
            </section>
            <section className="roster-controls">
              <label>
                SORT
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as RosterSort)
                  }
                >
                  <option value="adherence">Lowest adherence</option>
                  <option value="attention">Needs attention</option>
                  <option value="recent">Recent activity</option>
                </select>
              </label>
              <label>
                GROUP
                <select
                  value={groupId}
                  onChange={(event) => setGroupId(event.target.value)}
                >
                  <option value="">All groups</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                PROGRAM
                <select
                  value={programName}
                  onChange={(event) => setProgramName(event.target.value)}
                >
                  <option value="">All programs</option>
                  {programs.map((program) => (
                    <option key={program}>{program}</option>
                  ))}
                </select>
              </label>
              <button
                className={attentionOnly ? "active" : ""}
                onClick={() => setAttentionOnly((value) => !value)}
              >
                Needs attention
              </button>
            </section>
            <section className="roster-list">
              <header>
                <span>ACTIVE CLIENTS</span>
                <b>{visible.length}</b>
              </header>
              {visible.map((client) => (
                <RosterClient key={client.relationshipId} client={client} />
              ))}
              {!visible.length && (
                <p className="roster-empty">No clients match these filters.</p>
              )}
            </section>
            {attention.length > 0 && (
              <section className="roster-attention">
                <header>
                  <span>NEEDS ATTENTION</span>
                  <h2>Existing attention queue</h2>
                </header>
                {attention.slice(0, 8).map((item, index) => {
                  const goal = item.reasons.some((reason) =>
                    reason.startsWith("goal_"),
                  );
                  const href = goal
                    ? `/coaching/goals?relationship=${item.relationshipId}`
                    : item.occurrenceId && item.sessionDate
                      ? `/coaching/${item.relationshipId}?week=${item.sessionDate}&session=${item.occurrenceId}`
                      : `/coaching/${item.relationshipId}`;
                  return (
                    <Link
                      key={`${item.relationshipId}-${item.occurrenceId || index}`}
                      href={href}
                    >
                      <span>
                        <b>{item.displayName}</b>
                        <small>{item.sessionTitle}</small>
                      </span>
                      <em>
                        {item.reasons
                          .map((reason) =>
                            coachAttentionLabel(reason, item.sessionRpe),
                          )
                          .join(" · ")}
                      </em>
                      <strong>›</strong>
                    </Link>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function RosterClient({ client }: { client: CoachRosterClient }) {
  const adherence = adherenceRate(
    client.currentCompleted,
    client.currentPlanned,
  );
  const trend = clientCompletionTrend(client);
  return (
    <article className="roster-client">
      <Link
        className="roster-client-main"
        href={`/coaching/${client.relationshipId}`}
      >
        <i>{initials(client.displayName)}</i>
        <span>
          <b>{client.displayName}</b>
          <small>
            @{client.username} · {client.currentCompleted}/
            {client.currentPlanned} this week
          </small>
        </span>
        <em>{adherence == null ? "No plan" : `${adherence}%`}</em>
        {client.attentionCount > 0 && <strong>{client.attentionCount}</strong>}
        <u>›</u>
      </Link>
      <div className="roster-client-context">
        <span>
          <small>RECENT</small>
          <b>{client.latestCompletedTitle || "No completed session"}</b>
          <em>{dateLabel(client.latestCompletedDate)}</em>
        </span>
        <span>
          <small>PROGRAM</small>
          <b>{client.activeProgramName || "No active program"}</b>
          {client.activeProgramName && (
            <em>
              Week {client.programCurrentWeek} of {client.programDurationWeeks}
            </em>
          )}
        </span>
        <span>
          <small>PRIMARY GOAL</small>
          <b>{client.primaryGoalTitle || "No Primary goal"}</b>
          {client.primaryGoalTitle && (
            <em>
              {rosterGoalValue(
                client.primaryGoalMetric,
                client.primaryGoalCurrent,
                client.primaryGoalUnit,
              )}
              {client.primaryGoalReached ? " · Goal reached" : ""}
            </em>
          )}
        </span>
        <span>
          <small>LATEST FEEDBACK</small>
          <b>
            {feelLabel(client.latestSessionFeel) || "No recent check-in"}
            {client.latestRpe != null ? ` · RPE ${client.latestRpe}` : ""}
          </b>
          {trend === "lower" && <em>Completion lower in recent weeks</em>}
        </span>
      </div>
      <footer>
        <Link
          href={`/coaching/${client.relationshipId}?week=${client.weekStart}&review=1`}
        >
          Weekly review
        </Link>
        <Link href={`/coaching/goals?relationship=${client.relationshipId}`}>
          Goal progress
        </Link>
      </footer>
    </article>
  );
}
