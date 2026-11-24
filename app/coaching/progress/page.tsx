"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CoachCommentsThread } from "@/components/coaching/coach-comments-thread";
import { AthleteGoalProgressList } from "@/components/coaching/athlete-goal-progress";
import {
  athleteWeekSummary,
  nextCoachedSession,
} from "@/lib/coaching/athlete-progress";
import { CoachingService } from "@/lib/coaching/coaching-service";
import type {
  AthleteCoachingWeekItem,
  AthleteGoal,
  AthleteProgramProgress,
  CoachWeeklyReviewNote,
  CoachingRelationship,
} from "@/lib/coaching/types";
import { DiaryService } from "@/lib/data/diary-service";
import {
  createSetraTheme,
  useResolvedAppearance,
} from "@/lib/setra/appearance";
import {
  addCalendarDays,
  localDateKey,
  parseLocalDate,
} from "@/lib/setra/week";
import "./progress.css";

const dateLabel = (value: string, year = false) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
  }).format(parseLocalDate(value));
const statusLabel = (item: AthleteCoachingWeekItem, today: string) =>
  item.status === "planned" && item.date < today
    ? "Missed"
    : item.status === "partial"
      ? "Partially completed"
      : item.status[0].toUpperCase() + item.status.slice(1);
const feelLabel = (value: AthleteCoachingWeekItem["sessionFeel"]) =>
  value === "easier"
    ? "Easier than expected"
    : value === "harder"
      ? "Harder than expected"
      : value === "expected"
        ? "As expected"
        : "";

function AthleteSession({
  item,
  today,
}: {
  item: AthleteCoachingWeekItem;
  today: string;
}) {
  const href = item.completedClientId
    ? `/?tab=history&coachedModality=${item.modality}&coachedSession=${encodeURIComponent(item.completedClientId)}`
    : `/?coachedDate=${item.date}`;
  return (
    <article className={`is-${item.status}`}>
      <Link href={href}>
        <i>
          {item.status === "completed"
            ? "✓"
            : item.status === "partial"
              ? "◐"
              : item.status === "skipped"
                ? "–"
                : ""}
        </i>
        <span>
          <b>{item.title}</b>
          <small>
            {dateLabel(item.date)} · {item.modality} ·{" "}
            {statusLabel(item, today)}
          </small>
          <em>
            Assigned by {item.coachName}
            {item.programName
              ? ` · ${item.programName}${item.programWeekNumber ? ` W${item.programWeekNumber}` : ""}`
              : ""}
          </em>
        </span>
        <strong>›</strong>
      </Link>
      {(item.sessionFeel || item.sessionRpe != null || item.athleteComment) && (
        <div className="athlete-progress-checkin">
          <b>YOUR CHECK-IN</b>
          <p>
            {feelLabel(item.sessionFeel)}
            {item.sessionRpe != null
              ? `${item.sessionFeel ? " · " : ""}RPE ${item.sessionRpe}`
              : ""}
          </p>
          {item.athleteComment && <small>{item.athleteComment}</small>}
        </div>
      )}
      {item.coachFeedback && (
        <div className="athlete-progress-feedback">
          <b>COACH FEEDBACK</b>
          <p>{item.coachFeedback}</p>
          <small>
            {item.coachName}
            {item.coachFeedbackUpdatedAt
              ? ` · ${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(item.coachFeedbackUpdatedAt))}`
              : ""}
          </small>
        </div>
      )}
      <CoachCommentsThread
        relationshipId={item.relationshipId}
        targetType="session"
        assignmentId={item.assignmentId}
        readOnly={item.relationshipStatus !== "active"}
        compact
      />
    </article>
  );
}

export default function CoachedAthleteProgressPage() {
  const { user } = useAuth();
  const service = useMemo(() => (user ? new CoachingService() : null), [user]);
  const today = localDateKey();
  const [anchor, setAnchor] = useState(today);
  const [relationships, setRelationships] = useState<CoachingRelationship[]>(
    [],
  );
  const [items, setItems] = useState<AthleteCoachingWeekItem[]>([]);
  const [programs, setPrograms] = useState<AthleteProgramProgress[]>([]);
  const [notes, setNotes] = useState<CoachWeeklyReviewNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [goals, setGoals] = useState<AthleteGoal[]>([]);
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  useEffect(() => {
    const week = new URLSearchParams(window.location.search).get("week");
    if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) setAnchor(week);
  }, []);
  const refresh = useCallback(async () => {
    if (!user || !service) return;
    setLoading(true);
    setMessage("");
    try {
      const [relationRows, weekRows, programRows, noteRows, goalRows, profile] =
        await Promise.all([
          service.list(),
          service.athleteCoachingWeek(anchor),
          service.athletePrograms(anchor),
          service.clientWeeklyReviewNotes(),
          service.athleteGoals(),
          new DiaryService(user.id).loadProfile(),
        ]);
      setRelationships(relationRows);
      setItems(weekRows);
      setPrograms(programRows);
      setNotes(noteRows);
      setGoals(goalRows);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Your coaching progress could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [anchor, service, user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const athleteRelationships = relationships.filter(
    (item) => item.viewerRole === "client",
  );
  const activeRelationships = athleteRelationships.filter(
    (item) => item.status === "active",
  );
  const activeProgram = programs.find(
    (program) =>
      program.status === "active" && program.relationshipStatus === "active",
  );
  const summary = athleteWeekSummary(items, today);
  const next = nextCoachedSession(items, today);
  const weekStart = items[0]?.weekStart || anchor;
  const weekEnd = items[0]?.weekEnd || addCalendarDays(anchor, 6);
  const weekNote = notes.find((note) => note.weekStart === weekStart);
  const weekRelationship = items[0]
    ? athleteRelationships.find(
        (row) => row.relationshipId === items[0].relationshipId,
      )
    : activeRelationships[0] || athleteRelationships[0];
  const latestFeedback = [...items]
    .filter((item) => item.coachFeedback)
    .sort((a, b) =>
      (b.coachFeedbackUpdatedAt || "").localeCompare(
        a.coachFeedbackUpdatedAt || "",
      ),
    )[0];
  const theme = createSetraTheme(accent, resolved, textScale);
  function shift(days: number) {
    setAnchor((current) => addCalendarDays(current, days));
  }
  return (
    <main
      className="athlete-progress-screen"
      style={theme}
      data-theme={resolved}
    >
      <header className="athlete-progress-header">
        <Link href="/coaching" aria-label="Back to Coaching">
          ‹
        </Link>
        <div>
          <small>COACHING</small>
          <b>Your progress</b>
        </div>
        <span />
      </header>
      <div className="athlete-progress-content">
        {message && (
          <p className="athlete-progress-message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="athlete-progress-empty">Loading coaching progress...</p>
        ) : (
          <>
            {activeRelationships.length ? (
              <section className="athlete-progress-hero">
                <div>
                  <span>COACHED TRAINING</span>
                  <h1>{activeProgram?.name || "Your coached training"}</h1>
                  <p>
                    {activeProgram
                      ? `Week ${activeProgram.currentWeek} of ${activeProgram.durationWeeks}`
                      : `With ${activeRelationships.map((item) => item.displayName).join(", ")}`}
                  </p>
                </div>
                <div>
                  <b>
                    {summary.completed} of {summary.planned}
                  </b>
                  <small>sessions complete this week</small>
                  {next && (
                    <em>
                      Next: {next.title} · {dateLabel(next.date)}
                    </em>
                  )}
                </div>
              </section>
            ) : athleteRelationships.length ? (
              <section className="athlete-progress-ended">
                <span>COACHING HISTORY</span>
                <h1>No active coach</h1>
                <p>
                  Your completed training, historical programs and existing
                  coach feedback remain part of your record.
                </p>
              </section>
            ) : null}
            <AthleteGoalProgressList
              goals={goals}
              manageHref="/coaching/goals"
              title="Your goal progress"
            />
            {activeProgram && (
              <section className="athlete-program-progress">
                <header>
                  <div>
                    <span>ACTIVE PROGRAM</span>
                    <h2>{activeProgram.name}</h2>
                    <p>
                      {activeProgram.coachName}
                      {activeProgram.focus ? ` · ${activeProgram.focus}` : ""}
                    </p>
                  </div>
                  <b>
                    Week {activeProgram.currentWeek} /{" "}
                    {activeProgram.durationWeeks}
                  </b>
                </header>
                <div className="athlete-program-bar">
                  <i
                    style={{
                      width: `${activeProgram.totalSessions ? Math.round((activeProgram.completedSessions / activeProgram.totalSessions) * 100) : 0}%`,
                    }}
                  />
                </div>
                <footer>
                  <span>
                    <b>{activeProgram.completedSessions}</b>
                    <small>completed</small>
                  </span>
                  <span>
                    <b>{activeProgram.remainingSessions}</b>
                    <small>remaining</small>
                  </span>
                  <span>
                    <b>{activeProgram.totalSessions}</b>
                    <small>assigned</small>
                  </span>
                </footer>
              </section>
            )}
            <section className="athlete-week">
              <header>
                <div>
                  <span>WEEKLY ADHERENCE</span>
                  <h2>
                    {dateLabel(weekStart)} to {dateLabel(weekEnd, true)}
                  </h2>
                </div>
                <nav>
                  <button
                    onClick={() => shift(-7)}
                    aria-label="Previous coached week"
                  >
                    ‹
                  </button>
                  <button onClick={() => setAnchor(today)}>Current</button>
                  <button
                    onClick={() => shift(7)}
                    aria-label="Next coached week"
                  >
                    ›
                  </button>
                </nav>
              </header>
              <div className="athlete-week-counts">
                <span>
                  <b>{summary.completed}</b>
                  <small>Completed</small>
                </span>
                <span>
                  <b>{summary.skipped + summary.missed}</b>
                  <small>Skipped / missed</small>
                </span>
                <span>
                  <b>{summary.rescheduled}</b>
                  <small>Rescheduled</small>
                </span>
              </div>
              <div className="athlete-week-list">
                {items.map((item) => (
                  <AthleteSession
                    key={item.assignmentId}
                    item={item}
                    today={today}
                  />
                ))}
                {!items.length && (
                  <p className="athlete-progress-empty">
                    No coach-assigned sessions in this week.
                  </p>
                )}
              </div>
            </section>
            {(weekNote || latestFeedback) && (
              <section className="athlete-latest-review">
                <span>LATEST COACH REVIEW</span>
                {weekNote ? (
                  <>
                    <h2>
                      {weekNote.coachName} · {dateLabel(weekNote.weekStart)}
                    </h2>
                    <p>{weekNote.text}</p>
                  </>
                ) : latestFeedback ? (
                  <>
                    <h2>
                      {latestFeedback.coachName} · {latestFeedback.title}
                    </h2>
                    <p>{latestFeedback.coachFeedback}</p>
                  </>
                ) : null}
              </section>
            )}
            {weekRelationship && (
              <section className="athlete-review-comments">
                <CoachCommentsThread
                  relationshipId={weekRelationship.relationshipId}
                  targetType="weekly_review"
                  weekStart={weekStart}
                  readOnly={weekRelationship.status !== "active"}
                />
              </section>
            )}
            {programs.length > 0 && (
              <section className="athlete-program-history">
                <header>
                  <span>PROGRAM HISTORY</span>
                  <h2>Assigned blocks</h2>
                </header>
                <div>
                  {programs.map((program) => (
                    <article key={program.id}>
                      <span>
                        <b>{program.name}</b>
                        <small>
                          {program.coachName} · {dateLabel(program.startDate)}{" "}
                          to {dateLabel(program.endDate, true)}
                        </small>
                      </span>
                      <em>
                        {program.completedSessions} / {program.totalSessions}{" "}
                        completed · {program.status}
                      </em>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {!athleteRelationships.length && (
              <section className="athlete-progress-empty">
                <b>No coaching relationships yet</b>
                <p>
                  Coach invitations and accepted relationships will appear in
                  Coaching.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
