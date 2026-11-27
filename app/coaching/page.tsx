"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ClientAvailabilityEditor } from "@/components/coaching/client-availability-editor";
import { CoachingService } from "@/lib/coaching/coaching-service";
import type {
  CoachDashboard,
  CoachWeeklyReviewNote,
  CoachingProfile,
  CoachingRelationship,
} from "@/lib/coaching/types";
import { coachAttentionLabel } from "@/lib/coaching/attention-rules";
import { DiaryService } from "@/lib/data/diary-service";
import { usePremiumAccess } from "@/lib/premium/use-premium-access";
import {BillingPanel} from "@/components/billing/billing-panel";
import type {BillingPublicState} from "@/lib/billing/catalogue";
import {
  createSetraTheme,
  useResolvedAppearance,
} from "@/lib/setra/appearance";
import {
  addCalendarDays,
  localDateKey,
  parseLocalDate,
} from "@/lib/setra/week";
import "./coaching.css";

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "S";
const reviewWeekLabel = (weekStart: string) =>
  `${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(parseLocalDate(weekStart))} to ${new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(parseLocalDate(addCalendarDays(weekStart, 6)))}`;
const shortDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-AU", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(parseLocalDate(value))
    : "";

function Person({
  relationship,
  actions,
}: {
  relationship: CoachingRelationship;
  actions: React.ReactNode;
}) {
  return (
    <article className="coaching-person">
      <i>{initials(relationship.displayName)}</i>
      <span>
        <b>{relationship.displayName}</b>
        <small>@{relationship.username}</small>
      </span>
      <div>{actions}</div>
    </article>
  );
}

export default function CoachingPage() {
  const { user } = useAuth();
  const { access } = usePremiumAccess();
  const service = useMemo(() => (user ? new CoachingService() : null), [user]);
  const [relationships, setRelationships] = useState<CoachingRelationship[]>(
    [],
  );
  const [dashboard, setDashboard] = useState<CoachDashboard>({
    clients: [],
    attention: [],
  });
  const [dashboardFilter, setDashboardFilter] = useState<"all" | "attention">(
    "all",
  );
  const [weeklyNotes, setWeeklyNotes] = useState<CoachWeeklyReviewNote[]>([]);
  const [coachEnabled, setCoachEnabled] = useState(false);
  const [billingState,setBillingState]=useState<BillingPublicState|null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoachingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolvedAppearance = useResolvedAppearance(appearance);

  const refresh = useCallback(async () => {
    if (!service || !user) return;
    setLoading(true);
    try {
      const [items, profile, dashboardData, notes] = await Promise.all([
        service.list(),
        new DiaryService(user.id).loadProfile(),
        service.dashboard(localDateKey()),
        service.clientWeeklyReviewNotes(),
      ]);
      setRelationships(items);
      setDashboard(dashboardData);
      setWeeklyNotes(notes);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Coaching relationships could not be loaded. Apply the Coaching migration first.",
      );
    } finally {
      setLoading(false);
    }
  }, [service, user]);

  useEffect(() => {
    setCoachEnabled(access.roles.includes("coach"));
  }, [access.roles]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function action(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await work();
      setMessage(success);
      setResults([]);
      await refresh();
    } catch (error) {
      setMessage(
        (error as {code?:string})?.code==="P0601"
          ? "No coaching seat is available. Manage your subscription or review your clients and pending invites."
          : error instanceof Error
          ? error.message
          : "That coaching action could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enableCoaching() {
    if (!service) return;
    await action(async () => {
      await service.enableCoachRole();
      setCoachEnabled(true);
    }, "Coach tools are ready.");
  }
  async function search() {
    if (!service || query.trim().length < 2) return;
    setBusy(true);
    setMessage("");
    try {
      setResults(await service.search(query));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Username search is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  function confirmEnd(item: CoachingRelationship) {
    if (
      !service ||
      !window.confirm(
        `End the coaching relationship with ${item.displayName}? No training data will be deleted.`,
      )
    )
      return;
    void action(
      () => service.end(item.relationshipId),
      "Coaching relationship ended.",
    );
  }

  const activeClients = relationships.filter(
    (item) => item.viewerRole === "coach" && item.status === "active",
  );
  const outgoing = relationships.filter(
    (item) => item.viewerRole === "coach" && item.status === "pending",
  );
  const activeCoaches = relationships.filter(
    (item) => item.viewerRole === "client" && item.status === "active",
  );
  const incoming = relationships.filter(
    (item) => item.viewerRole === "client" && item.status === "pending",
  );
  const past = relationships
    .filter((item) => item.status === "declined" || item.status === "ended")
    .slice(0, 6);
  const attentionByClient = new Map<string, number>();
  dashboard.attention.forEach((item) =>
    attentionByClient.set(
      item.relationshipId,
      (attentionByClient.get(item.relationshipId) || 0) + 1,
    ),
  );
  const theme = createSetraTheme(accent, resolvedAppearance, textScale);
  const seatLimit=billingState?.seats.limit;
  const noSeats=seatLimit!=null&&activeClients.length+outgoing.length>=seatLimit;

  return (
    <main
      className="coaching-screen"
      style={theme}
      data-theme={resolvedAppearance}
    >
      <header className="coaching-header">
        <Link href="/profile" aria-label="Back to profile">
          ‹
        </Link>
        <div>
          <small>COACHING</small>
          <b>Relationships</b>
        </div>
        <span />
      </header>
      <div className="coaching-content">
        <section className="coaching-intro">
          <span>SETRA COACHING</span>
          <h1>Training, with consent.</h1>
          <p>
            Coaching is separate from your plan and Friends. Clients stay in
            control of training access.
          </p>
        </section>
        <BillingPanel kind="coaching" seatVersion={activeClients.length*10000+outgoing.length} onState={setBillingState}/>
        {message && (
          <p className="coaching-message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="coaching-empty">Loading coaching relationships...</p>
        ) : (
          <>
            {incoming.length > 0 && (
              <section className="coaching-panel coaching-attention">
                <header>
                  <span>INVITATIONS</span>
                  <h2>Choose who coaches you</h2>
                  <p>
                    Accepting lets this coach view your planned and completed
                    sessions and assign training. You can remove access or end
                    the relationship at any time.
                  </p>
                </header>
                <div className="coaching-list">
                  {incoming.map((item) => (
                    <Person
                      key={item.relationshipId}
                      relationship={item}
                      actions={
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  service!.respond(item.relationshipId, false),
                                "Invitation declined.",
                              )
                            }
                          >
                            Decline
                          </button>
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  service!.respond(item.relationshipId, true),
                                "Coach invitation accepted.",
                              )
                            }
                          >
                            Accept
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="coaching-panel">
              <header>
                <span>MY COACHES</span>
                <h2>
                  {activeCoaches.length
                    ? `${activeCoaches.length} active ${activeCoaches.length === 1 ? "coach" : "coaches"}`
                    : "No active coach"}
                </h2>
                <p>
                  Your individual Setra plan and Friends remain independent.
                </p>
              </header>
              {activeCoaches.length ? (
                <div className="coaching-list">
                  {activeCoaches.map((item) => (
                    <Person
                      key={item.relationshipId}
                      relationship={item}
                      actions={
                        <>
                          <button
                            disabled={busy}
                            onClick={() =>
                              action(
                                () =>
                                  service!.setMvpPermissions(
                                    item.relationshipId,
                                    !(
                                      item.viewPlannedSessions &&
                                      item.viewCompletedSessions &&
                                      item.assignTraining
                                    ),
                                  ),
                                item.viewPlannedSessions
                                  ? "Coach training access removed."
                                  : "Coach training access enabled.",
                              )
                            }
                          >
                            {item.viewPlannedSessions
                              ? "Remove access"
                              : "Allow training access"}
                          </button>
                          <button
                            className="danger"
                            disabled={busy}
                            onClick={() => confirmEnd(item)}
                          >
                            End
                          </button>
                        </>
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="coaching-empty">
                  Accepted coaching relationships will appear here.
                </p>
              )}
            </section>
            {activeCoaches.length > 0 && <ClientAvailabilityEditor />}
            {activeCoaches.length > 0 && (
              <Link
                className="coach-program-library-link coach-groups-link"
                href="/coaching/goals"
              >
                <i>◇</i>
                <span>
                  <small>ATHLETE GOALS</small>
                  <b>Goals and targets</b>
                  <em>
                    Set priorities, review coach proposals and track measured
                    targets.
                  </em>
                </span>
                <strong>›</strong>
              </Link>
            )}
            {(activeCoaches.length > 0 ||
              relationships.some(
                (item) =>
                  item.viewerRole === "client" && item.status === "ended",
              )) && (
              <Link
                className="coach-program-library-link coach-groups-link"
                href="/coaching/progress"
              >
                <i>↗</i>
                <span>
                  <small>YOUR COACHING</small>
                  <b>Progress and adherence</b>
                  <em>
                    See assigned training, program progress and coach feedback.
                  </em>
                </span>
                <strong>›</strong>
              </Link>
            )}

            {weeklyNotes.length > 0 && (
              <section className="coaching-panel coaching-weekly-notes">
                <header>
                  <span>WEEKLY REVIEWS</span>
                  <h2>Notes from your coach</h2>
                  <p>
                    These reviews remain with your training record, including
                    after a coaching relationship ends.
                  </p>
                </header>
                <div>
                  {weeklyNotes.map((note) => (
                    <article key={note.id}>
                      <div>
                        <b>{reviewWeekLabel(note.weekStart)}</b>
                        <small>
                          {note.coachName} · Updated{" "}
                          {new Intl.DateTimeFormat("en-AU", {
                            dateStyle: "medium",
                          }).format(new Date(note.updatedAt))}
                        </small>
                      </div>
                      <p>{note.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {!coachEnabled ? (
              <section className="coaching-panel coaching-start">
                <header>
                  <span>COACH WITH SETRA</span>
                  <h2>Enable coach tools</h2>
                  <p>
                    This adds the coach role without changing your Free, Premium
                    or Adaptive plan.
                  </p>
                </header>
                {billingState?.required&&billingState.seats.limit===0?<a href="#test-billing">See coaching subscription options ›</a>:<button
                  className="coaching-primary"
                  disabled={busy}
                  onClick={enableCoaching}
                >
                  Enable coaching
                </button>}
              </section>
            ) : (
              <>
                <Link
                  className="coach-program-library-link"
                  href="/coaching/library"
                >
                  <i>▦</i>
                  <span>
                    <small>COACH LIBRARY</small>
                    <b>Workouts and programs</b>
                    <em>
                      Create, import, manage and assign reusable training.
                    </em>
                  </span>
                  <strong>›</strong>
                </Link>
                <Link
                  className="coach-program-library-link coach-groups-link"
                  href="/coaching/analytics"
                >
                  <i>↗</i>
                  <span>
                    <small>ROSTER ANALYTICS</small>
                    <b>Clients and adherence</b>
                    <em>
                      Review training, goals, programs and attention across your
                      roster.
                    </em>
                  </span>
                  <strong>›</strong>
                </Link>
                <Link
                  className="coach-program-library-link coach-groups-link"
                  href="/coaching/groups"
                >
                  <i>◎</i>
                  <span>
                    <small>COACH GROUPS</small>
                    <b>Clients and cohorts</b>
                    <em>
                      Organise active clients and assign training together.
                    </em>
                  </span>
                  <strong>›</strong>
                </Link>
                <section className="coaching-panel coach-dashboard" id="coach-active-clients">
                  <header>
                    <span>COACH DASHBOARD</span>
                    <h2>
                      {activeClients.length
                        ? `${activeClients.length} active ${activeClients.length === 1 ? "client" : "clients"}`
                        : "No active clients"}
                    </h2>
                    <p>
                      Current-week progress, recent training and items that need
                      a quick review.
                    </p>
                  </header>
                  <nav
                    className="coach-dashboard-filters"
                    aria-label="Dashboard filter"
                  >
                    <button
                      className={dashboardFilter === "all" ? "active" : ""}
                      onClick={() => setDashboardFilter("all")}
                    >
                      All clients <small>{dashboard.clients.length}</small>
                    </button>
                    <button
                      className={
                        dashboardFilter === "attention" ? "active" : ""
                      }
                      onClick={() => setDashboardFilter("attention")}
                    >
                      Needs attention{" "}
                      <small>{dashboard.attention.length}</small>
                    </button>
                  </nav>
                  {dashboardFilter === "all" ? (
                    dashboard.clients.length ? (
                      <div className="coach-dashboard-list">
                        {dashboard.clients.map((client) => {
                          const relationship = activeClients.find(
                            (item) =>
                              item.relationshipId === client.relationshipId,
                          );
                          const attentionCount =
                            attentionByClient.get(client.relationshipId) || 0;
                          return (
                            <article key={client.relationshipId}>
                              <Link href={`/coaching/${client.relationshipId}`}>
                                <i>{initials(client.displayName)}</i>
                                <span className="coach-dashboard-person">
                                  <b>{client.displayName}</b>
                                  <small>@{client.username}</small>
                                </span>
                                <span className="coach-dashboard-progress">
                                  <b>
                                    {client.completedSessions} /{" "}
                                    {client.plannedSessions}
                                  </b>
                                  <small>completed this week</small>
                                </span>
                                {attentionCount > 0 && (
                                  <em>{attentionCount}</em>
                                )}
                                <strong>›</strong>
                              </Link>
                              {client.permissionsReady ? (
                                <div className="coach-dashboard-context">
                                  <span>
                                    <small>NEXT</small>
                                    <b>
                                      {client.nextSessionTitle ||
                                        "No upcoming session"}
                                    </b>
                                    {client.nextSessionDate && (
                                      <em>
                                        {shortDate(client.nextSessionDate)}
                                      </em>
                                    )}
                                  </span>
                                  <span>
                                    <small>RECENT</small>
                                    <b>
                                      {client.latestCompletedTitle ||
                                        "No completed session"}
                                    </b>
                                    {client.latestCompletedDate && (
                                      <em>
                                        {shortDate(client.latestCompletedDate)}
                                      </em>
                                    )}
                                  </span>
                                  {(client.latestSessionFeel ||
                                    client.latestRpe != null ||
                                    client.latestAthleteComment) && (
                                    <span className="coach-dashboard-feedback">
                                      <small>LATEST ATHLETE FEEDBACK</small>
                                      <b>
                                        {client.latestSessionFeel === "harder"
                                          ? "Harder than expected"
                                          : client.latestSessionFeel ===
                                              "easier"
                                            ? "Easier than expected"
                                            : client.latestSessionFeel ===
                                                "expected"
                                              ? "As expected"
                                              : "Session feedback"}
                                        {client.latestRpe != null
                                          ? ` · RPE ${client.latestRpe}`
                                          : ""}
                                      </b>
                                      {client.latestAthleteComment && (
                                        <em>{client.latestAthleteComment}</em>
                                      )}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="coach-dashboard-permission">
                                  Awaiting client training access
                                </p>
                              )}
                              {relationship && (
                                <button
                                  className="coach-dashboard-end"
                                  disabled={busy}
                                  onClick={() => confirmEnd(relationship)}
                                >
                                  End relationship
                                </button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="coaching-empty">
                        Accepted client relationships will appear here.
                      </p>
                    )
                  ) : dashboard.attention.length ? (
                    <div className="coach-attention-list">
                      {dashboard.attention.map((item, index) => {
                        const goalAttention = item.reasons.some((reason) =>
                          reason.startsWith("goal_"),
                        );
                        const target = goalAttention
                          ? `/coaching/goals?relationship=${item.relationshipId}`
                          : item.occurrenceId && item.sessionDate
                            ? `/coaching/${item.relationshipId}?week=${item.sessionDate}&session=${item.occurrenceId}`
                            : `/coaching/${item.relationshipId}`;
                        return (
                          <article
                            key={`${item.relationshipId}-${item.occurrenceId || "client"}-${index}`}
                          >
                            <div>
                              <i>{initials(item.displayName)}</i>
                              <span>
                                <b>{item.displayName}</b>
                                <small>
                                  {item.sessionTitle}
                                  {item.sessionDate
                                    ? ` · ${shortDate(item.sessionDate)}`
                                    : ""}
                                </small>
                              </span>
                            </div>
                            <div className="coach-attention-reasons">
                              {item.reasons.map((reason) => (
                                <em key={reason}>
                                  {coachAttentionLabel(reason, item.sessionRpe)}
                                </em>
                              ))}
                            </div>
                            {item.athleteComment && (
                              <p>“{item.athleteComment}”</p>
                            )}
                            <footer>
                              <Link href={`/coaching/${item.relationshipId}`}>
                                Client week
                              </Link>
                              <Link className="primary" href={target}>
                                {goalAttention
                                  ? "View goal"
                                  : item.reasons.includes(
                                        "awaiting_coach_review",
                                      )
                                    ? "Review and respond"
                                    : "Open session"}
                              </Link>
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="coaching-empty">
                      Nothing needs attention right now.
                    </p>
                  )}
                </section>

                <section className="coaching-panel">
                  <header>
                    <span>PENDING INVITES</span>
                    <h2>
                      {outgoing.length
                        ? `${outgoing.length} awaiting response`
                        : "Nothing pending"}
                    </h2>
                  </header>
                  {outgoing.length ? (
                    <div className="coaching-list">
                      {outgoing.map((item) => (
                        <Person
                          key={item.relationshipId}
                          relationship={item}
                          actions={
                            <button
                              disabled={busy}
                              onClick={() =>
                                action(
                                  () => service!.cancel(item.relationshipId),
                                  "Invitation cancelled.",
                                )
                              }
                            >
                              Cancel
                            </button>
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="coaching-empty">
                      Invitations you send will remain here until answered or
                      cancelled.
                    </p>
                  )}
                </section>

                <section className="coaching-panel">
                  <header>
                    <span>INVITE CLIENT</span>
                    <h2>Search by username</h2>
                    <p>
                      Private email addresses are never exposed. Friends and
                      coaching are separate relationships.
                    </p>
                  </header>
                  <div className="coaching-search">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void search();
                      }}
                      placeholder="@username"
                      aria-label="Setra username"
                    />
                    <button
                      disabled={busy || query.trim().length < 2}
                      onClick={search}
                    >
                      Search
                    </button>
                  </div>
                  {results.length > 0 && (
                    <div className="coaching-results">
                      {results.map((item) => (
                        <article key={item.userId}>
                          <i>{initials(item.displayName)}</i>
                          <span>
                            <b>{item.displayName}</b>
                            <small>@{item.username}</small>
                          </span>
                          <button
                            disabled={
                              busy ||
                              noSeats ||
                              item.relationshipStatus === "pending" ||
                              item.relationshipStatus === "active"
                            }
                            onClick={() =>
                              action(
                                () => service!.invite(item.userId),
                                "Coach invitation sent.",
                              )
                            }
                          >
                            {item.relationshipStatus === "pending"
                              ? "Pending"
                              : item.relationshipStatus === "active"
                                ? "Client"
                                : "Invite"}
                          </button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {past.length > 0 && (
              <section className="coaching-panel coaching-past">
                <header>
                  <span>PAST</span>
                  <h2>Previous relationships</h2>
                </header>
                <div>
                  {past.map((item) => (
                    <span key={item.relationshipId}>
                      <b>{item.displayName}</b>
                      <small>{item.status}</small>
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
