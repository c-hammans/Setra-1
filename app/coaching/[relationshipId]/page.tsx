"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CoachingService } from "@/lib/coaching/coaching-service";
import type {
  AthleteGoal,
  ClientProgramSummary,
  ClientTrainingAvailability,
  CoachClientWeek,
  CoachClientWeekItem,
  CoachProgrammingDraft,
  CoachWeeklyReview,
} from "@/lib/coaching/types";
import {
  availabilityForDate,
  unavailableAssignmentWarnings,
  WEEKDAY_LABELS,
} from "@/lib/coaching/availability";
import { CoachWeeklyReviewModal } from "@/components/coaching/coach-weekly-review";
import { CoachCommentsThread } from "@/components/coaching/coach-comments-thread";
import { AthleteGoalProgressList } from "@/components/coaching/athlete-goal-progress";
import { AthleteCheckinCard } from "@/components/workout/athlete-checkin";
import { DiaryService } from "@/lib/data/diary-service";
import { TrainingSessionService } from "@/lib/data/training-session-service";
import {
  createSetraTheme,
  useResolvedAppearance,
} from "@/lib/setra/appearance";
import type { EnduranceTemplate, Template } from "@/lib/setra/types";
import { localDateKey, parseLocalDate } from "@/lib/setra/week";
import "./client.css";
import "./feedback.css";
import "./programming.css";
import "./weekly-review.css";
import "../../athlete-checkin.css";

const dateLabel = (value: string, withYear = false) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
  }).format(parseLocalDate(value));
const duration = (seconds?: number | null) => {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};
const datesBetween = (start: string) => {
  const first = parseLocalDate(start);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    return localDateKey(date);
  });
};
const emptyAvailability = (): ClientTrainingAvailability => ({
  preferredDays: [],
  unavailableDays: [],
  restDays: [],
  preferredSessionTimes: {},
  notes: "",
  oneOffDates: [],
});

function CompletedDetail({ item }: { item: CoachClientWeekItem }) {
  const detail = item.completedDetail;
  return (
    <>
      {detail &&
        (item.modality === "strength" ? (
          <div className="coach-completed-detail">
            {detail.durationSeconds && (
              <small>{duration(detail.durationSeconds)}</small>
            )}
            {detail.exercises?.map((exercise, index) => (
              <div key={`${exercise.name}-${index}`}>
                <b>{exercise.name}</b>
                <span>
                  {exercise.sets.length ? (
                    exercise.sets.map((set, setIndex) => (
                      <em key={setIndex}>
                        {set.loadText || set.weight != null
                          ? `${set.loadText || set.weight} × ${set.reps || "–"}`
                          : `${set.reps || "–"} reps`}
                      </em>
                    ))
                  ) : (
                    <em>No completed sets</em>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="coach-completed-detail endurance">
            <span>
              {detail.durationSeconds && (
                <b>
                  {duration(detail.durationSeconds)}
                  <small>Duration</small>
                </b>
              )}
              {detail.distanceMetres != null && (
                <b>
                  {Number((detail.distanceMetres / 1000).toFixed(2))} km
                  <small>Distance</small>
                </b>
              )}
              {detail.averageHeartRate && (
                <b>
                  {detail.averageHeartRate} bpm<small>Average HR</small>
                </b>
              )}
              {detail.elevationGainMetres != null && (
                <b>
                  {detail.elevationGainMetres} m<small>Elevation</small>
                </b>
              )}
            </span>
          </div>
        ))}
      {detail?.athleteFeedback && (
        <AthleteCheckinCard initial={detail.athleteFeedback} />
      )}{" "}
      {item.assignmentId && (
        <CoachCommentsThread
          targetType="session"
          assignmentId={item.assignmentId}
          compact
        />
      )}
    </>
  );
}

function CoachFeedbackEditor({
  item,
  service,
  onChanged,
}: {
  item: CoachClientWeekItem;
  service: CoachingService;
  onChanged: () => Promise<void>;
}) {
  const [text, setText] = useState(item.feedback?.text || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setText(item.feedback?.text || ""), [item.feedback?.text]);
  async function save() {
    if (!item.assignmentId || !text.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await service.saveSessionFeedback(item.assignmentId, text.trim());
      await onChanged();
      setMessage(
        item.feedback ? "Feedback updated." : "Feedback sent to the client.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Feedback could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !item.feedback ||
      busy ||
      !window.confirm("Delete this coach feedback?")
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await service.deleteSessionFeedback(item.feedback.id);
      await onChanged();
      setText("");
      setMessage("Feedback deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Feedback could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="coach-feedback-editor">
      <span>COACH FEEDBACK</span>
      <textarea
        maxLength={2000}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Add clear feedback for this completed session"
      />
      <div>
        <button
          disabled={busy || !text.trim() || text.trim() === item.feedback?.text}
          onClick={save}
        >
          {busy
            ? "Saving..."
            : item.feedback
              ? "Update feedback"
              : "Send feedback"}
        </button>
        {item.feedback && (
          <button className="delete-feedback" disabled={busy} onClick={remove}>
            Delete
          </button>
        )}
      </div>
      {item.feedback && (
        <small>
          Last updated{" "}
          {new Intl.DateTimeFormat("en-AU", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(item.feedback.updatedAt))}
        </small>
      )}
      {message && <em role="status">{message}</em>}
    </section>
  );
}

function AssignedSessionControls({
  item,
  service,
  strengthTemplates,
  enduranceTemplates,
  availability,
  onChanged,
}: {
  item: CoachClientWeekItem;
  service: CoachingService;
  strengthTemplates: Template[];
  enduranceTemplates: EnduranceTemplate[];
  availability: ClientTrainingAvailability;
  onChanged: () => Promise<void>;
}) {
  const [date, setDate] = useState(item.date);
  const [modality, setModality] = useState<"strength" | "endurance">(
    item.modality,
  );
  const templates =
    modality === "strength" ? strengthTemplates : enduranceTemplates;
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setDate(item.date), [item.date]);
  useEffect(() => {
    setTemplateId((current) =>
      templates.some((template) => template.id === current)
        ? current
        : templates[0]?.id || "",
    );
  }, [templates]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await action();
      await onChanged();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!item.assignmentId) return null;
  if (!item.editable)
    return (
      <p className="coach-program-locked">
        Started and completed sessions are protected from programming changes.
      </p>
    );
  return (
    <section className="coach-program-controls">
      <div className="coach-order-actions">
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => service.reorderAssignment(item.assignmentId!, -1),
              "Order updated.",
            )
          }
        >
          ↑ Earlier
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(
              () => service.reorderAssignment(item.assignmentId!, 1),
              "Order updated.",
            )
          }
        >
          ↓ Later
        </button>
      </div>
      <label>
        MOVE TO
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <button
        className="program-secondary-action"
        disabled={busy || date === item.date}
        onClick={() => {
          const context = availabilityForDate(availability, date);
          if (
            context.status === "unavailable" &&
            !window.confirm(
              `The client is unavailable on ${dateLabel(date)}${context.note ? ` (${context.note})` : ""}. Move the session anyway?`,
            )
          )
            return;
          void run(
            () => service.moveAssignment(item.assignmentId!, date),
            "Session moved.",
          );
        }}
      >
        Move session
      </button>
      <div className="coach-replace-grid">
        <label>
          REPLACE WITH
          <select
            value={modality}
            onChange={(event) =>
              setModality(event.target.value as "strength" | "endurance")
            }
          >
            <option value="strength">Strength</option>
            <option value="endurance">Endurance</option>
          </select>
        </label>
        <label>
          TEMPLATE
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option value={template.id} key={template.id}>
                {"name" in template ? template.name : template.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="coach-program-footer">
        <button
          className="program-secondary-action"
          disabled={busy || !templateId}
          onClick={() =>
            void run(
              () =>
                service.replaceAssignment(
                  item.assignmentId!,
                  modality,
                  templateId,
                ),
              "Session replaced with a fresh template snapshot.",
            )
          }
        >
          Replace
        </button>
        <button
          className="program-remove-action"
          disabled={busy}
          onClick={() => {
            if (window.confirm(`Remove ${item.title} from the client week?`))
              void run(
                () => service.removeAssignment(item.assignmentId!),
                "Session removed.",
              );
          }}
        >
          Remove
        </button>
      </div>
      {message && <small role="status">{message}</small>}
    </section>
  );
}

export default function CoachClientPage() {
  const { user } = useAuth();
  const params = useParams<{ relationshipId: string }>();
  const relationshipId = String(params.relationshipId || "");
  const service = useMemo(() => (user ? new CoachingService() : null), [user]);
  const [week, setWeek] = useState<CoachClientWeek | null>(null);
  const [anchor, setAnchor] = useState(localDateKey());
  const [strengthTemplates, setStrengthTemplates] = useState<Template[]>([]);
  const [enduranceTemplates, setEnduranceTemplates] = useState<
    EnduranceTemplate[]
  >([]);
  const [clientPrograms, setClientPrograms] = useState<ClientProgramSummary[]>(
    [],
  );
  const [availability, setAvailability] =
    useState<ClientTrainingAvailability>(emptyAvailability);
  const [goals, setGoals] = useState<AthleteGoal[]>([]);
  const [drafts, setDrafts] = useState<CoachProgrammingDraft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false);
  const [reviewOnLoad, setReviewOnLoad] = useState(false);
  const [weeklyReview, setWeeklyReview] = useState<CoachWeeklyReview | null>(
    null,
  );
  const [weeklyReviewLoading, setWeeklyReviewLoading] = useState(false);
  const [weeklyReviewError, setWeeklyReviewError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const targetWeek = query.get("week");
    const targetSession = query.get("session");
    if (query.get("review") === "1") setReviewOnLoad(true);
    if (targetWeek && /^\d{4}-\d{2}-\d{2}$/.test(targetWeek))
      setAnchor(targetWeek);
    if (targetSession) setExpanded(targetSession);
  }, []);
  const refresh = useCallback(async (showLoading = true) => {
    if (!service || !user || !relationshipId) return;
    if (showLoading) setLoading(true);
    setMessage("");
    try {
      const diary = new DiaryService(user.id);
      const endurance = new TrainingSessionService(user.id);
      const [clientWeek, data, enduranceRows, profile, programs, goalRows] =
        await Promise.all([
          service.clientWeek(relationshipId, anchor),
          diary.load(),
          endurance.loadEnduranceTemplates(),
          diary.loadProfile(),
          service.clientPrograms(relationshipId, anchor),
          service.athleteGoals(relationshipId),
        ]);
      const clientAvailability = await service.clientAvailability(
        relationshipId,
        clientWeek.weekStart,
        clientWeek.weekEnd,
      );
      setWeek(clientWeek);
      setStrengthTemplates(
        data.templates.filter(
          (item) => !item.coachAssignmentId && !item.archivedAt,
        ),
      );
      setEnduranceTemplates(enduranceRows.filter((item) => !item.archivedAt));
      setClientPrograms(programs);
      setGoals(goalRows);
      setAvailability(clientAvailability);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This client week is unavailable.",
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [anchor, relationshipId, service, user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    setDrafts([]);
    setReviewOpen(false);
  }, [week?.weekStart]);
  useEffect(() => {
    if (loading || !expanded) return;
    const target = document.querySelector<HTMLElement>(
      `[data-coach-session="${CSS.escape(expanded)}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [expanded, loading, week?.weekStart]);
  function shiftWeek(days: number) {
    const next = parseLocalDate(week?.weekStart || anchor);
    next.setDate(next.getDate() + days);
    setAnchor(localDateKey(next));
  }
  function addDraft() {
    if (!week) return;
    const modality = strengthTemplates.length ? "strength" : "endurance";
    const templates =
      modality === "strength" ? strengthTemplates : enduranceTemplates;
    setDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        modality,
        templateId: templates[0]?.id || "",
        date: week.weekStart,
        instruction: "",
      },
    ]);
  }
  function updateDraft(id: string, update: Partial<CoachProgrammingDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id ? { ...draft, ...update } : draft,
      ),
    );
  }
  function moveDraft(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  async function confirmWeek() {
    if (
      !service ||
      !week ||
      busy ||
      drafts.some((draft) => !draft.templateId || !draft.date)
    )
      return;
    const warnings = unavailableAssignmentWarnings(
      availability,
      drafts.map((draft) => draft.date),
    );
    if (
      warnings.length &&
      !window.confirm(
        `This client is unavailable on ${warnings.map((item) => `${dateLabel(item.date)}${item.note ? ` (${item.note})` : ""}`).join(", ")}. Assign anyway?`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const activeProgram = clientPrograms.find(
        (program) =>
          program.status === "active" &&
          drafts.every(
            (draft) =>
              draft.date >= program.startDate && draft.date <= program.endDate,
          ),
      );
      if (activeProgram)
        await service.addProgramSessions(activeProgram.id, drafts);
      else await service.assignWeek(relationshipId, week.weekStart, drafts);
      setDrafts([]);
      setReviewOpen(false);
      await refresh();
      setMessage(
        activeProgram
          ? "The sessions were added to the active program."
          : "The programmed sessions are now in the client calendar.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The week could not be assigned.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function endProgram(program: ClientProgramSummary) {
    if (
      !service ||
      busy ||
      !window.confirm(
        `End ${program.name}? Future unstarted sessions will be removed, while completed training will remain.`,
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await service.endProgram(program.id);
      await refresh();
      setMessage("Program ended. Completed training was kept.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The program could not be ended.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadWeeklyReview() {
    if (!service || !week) return;
    setWeeklyReviewLoading(true);
    setWeeklyReviewError("");
    try {
      setWeeklyReview(
        await service.weeklyReview(
          relationshipId,
          week.weekStart,
          localDateKey(),
        ),
      );
    } catch (error) {
      setWeeklyReviewError(
        error instanceof Error
          ? error.message
          : "The weekly review could not be loaded.",
      );
    } finally {
      setWeeklyReviewLoading(false);
    }
  }
  function openWeeklyReview() {
    setWeeklyReviewOpen(true);
    void loadWeeklyReview();
  }
  useEffect(() => {
    if (!reviewOnLoad || !week || !service) return;
    setReviewOnLoad(false);
    setWeeklyReviewOpen(true);
    setWeeklyReviewLoading(true);
    setWeeklyReviewError("");
    void service
      .weeklyReview(relationshipId, week.weekStart, localDateKey())
      .then(setWeeklyReview)
      .catch((error) =>
        setWeeklyReviewError(
          error instanceof Error
            ? error.message
            : "The weekly review could not be loaded.",
        ),
      )
      .finally(() => setWeeklyReviewLoading(false));
  }, [relationshipId, reviewOnLoad, service, week]);
  async function saveWeeklyReviewNote(note: string) {
    if (!service || !week) return;
    await service.saveWeeklyReviewNote(relationshipId, week.weekStart, note);
    await loadWeeklyReview();
  }
  const planned =
    week?.items.filter((item) => item.status === "planned").length || 0;
  const completed =
    week?.items.filter(
      (item) => item.status === "completed" || item.status === "partial",
    ).length || 0;
  const weekDates = week ? datesBetween(week.weekStart) : [];
  const reviewWarnings = unavailableAssignmentWarnings(
    availability,
    drafts.map((draft) => draft.date),
  );
  const activeProgram = clientPrograms.find(
    (program) =>
      program.status === "active" &&
      week &&
      week.weekStart >= program.startDate &&
      week.weekStart <= program.endDate,
  );
  const primaryGoal = goals.find(
    (goal) =>
      goal.isPrimary &&
      goal.status === "active" &&
      goal.approvalStatus === "accepted",
  );
  const theme = createSetraTheme(accent, resolved, textScale);
  return (
    <main className="coach-client-screen" style={theme} data-theme={resolved}>
      <header className="coach-client-header">
        <Link href="/coaching" aria-label="Back to coaching">
          ‹
        </Link>
        <div>
          <small>CLIENT WEEK</small>
          <b>{week?.clientName || "Client"}</b>
        </div>
        <span />
      </header>
      <div className="coach-client-content">
        {message && (
          <p className="coach-client-message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="coach-client-empty">Loading the client week...</p>
        ) : (
          week && (
            <>
              <section className="coach-week-heading">
                <div>
                  <span>TRAINING WEEK</span>
                  <h1>{week.clientName}</h1>
                  <p>
                    {dateLabel(week.weekStart)} to{" "}
                    {dateLabel(week.weekEnd, true)}
                  </p>
                </div>
                <nav>
                  <button
                    onClick={() => shiftWeek(-7)}
                    aria-label="Previous week"
                  >
                    ‹
                  </button>
                  <button onClick={() => setAnchor(localDateKey())}>
                    This week
                  </button>
                  <button onClick={() => shiftWeek(7)} aria-label="Next week">
                    ›
                  </button>
                </nav>
                <button
                  className="coach-week-review-button"
                  onClick={openWeeklyReview}
                >
                  Weekly Review
                </button>
              </section>
              <AthleteGoalProgressList
                goals={goals}
                manageHref={`/coaching/goals?relationship=${relationshipId}`}
              />
              {activeProgram && (
                <section className="coach-active-program">
                  <div>
                    <span>ACTIVE PROGRAM</span>
                    <h2>{activeProgram.name}</h2>
                    <p>
                      Week {activeProgram.currentWeek} of{" "}
                      {activeProgram.durationWeeks}
                      {activeProgram.focus ? ` · ${activeProgram.focus}` : ""}
                    </p>
                  </div>
                  <div className="coach-active-program-progress">
                    <b>
                      {activeProgram.completedSessions} /{" "}
                      {activeProgram.totalSessions}
                    </b>
                    <small>sessions completed</small>
                    <i>
                      <em
                        style={{
                          width: `${activeProgram.totalSessions ? Math.round((activeProgram.completedSessions / activeProgram.totalSessions) * 100) : 0}%`,
                        }}
                      />
                    </i>
                  </div>
                  <div className="coach-active-program-actions">
                    <button onClick={openWeeklyReview}>Weekly review</button>
                    <button
                      className="danger"
                      disabled={busy}
                      onClick={() => void endProgram(activeProgram)}
                    >
                      End program
                    </button>
                  </div>
                </section>
              )}
              <section className="coach-availability-context">
                <header>
                  <span>CLIENT AVAILABILITY</span>
                  {availability.updatedAt && (
                    <small>
                      Updated{" "}
                      {new Intl.DateTimeFormat("en-AU", {
                        dateStyle: "medium",
                      }).format(new Date(availability.updatedAt))}
                    </small>
                  )}
                </header>
                <div>
                  {weekDates.map((date) => {
                    const context = availabilityForDate(availability, date);
                    return (
                      <article key={date} className={`is-${context.status}`}>
                        <b>{WEEKDAY_LABELS[context.day].slice(0, 3)}</b>
                        <small>
                          {context.oneOff ? "Unavailable" : context.status}
                        </small>
                        {context.time && <em>{context.time}</em>}
                        {context.note && <em>{context.note}</em>}
                      </article>
                    );
                  })}
                </div>
                {availability.notes && <p>{availability.notes}</p>}
              </section>
              <section className="coach-week-summary">
                <div>
                  <b>{week.items.length}</b>
                  <small>Sessions</small>
                </div>
                <div>
                  <b>{completed}</b>
                  <small>Completed</small>
                </div>
                <div>
                  <b>{planned}</b>
                  <small>Still planned</small>
                </div>
              </section>
              <section className="coach-client-panel coach-week-program">
                <header>
                  <span>WEEK PROGRAM</span>
                  <h2>Planned and completed</h2>
                  <p>
                    Open an assigned session to move, reorder, replace or remove
                    it before the client starts.
                  </p>
                </header>
                <div className="coach-program-days">
                  {weekDates.map((day) => {
                    const dayItems = week.items.filter(
                      (item) => item.date === day,
                    );
                    return (
                      <section key={day} className="coach-program-day">
                        <h3>{dateLabel(day)}</h3>
                        {dayItems.length ? (
                          <div className="coach-week-list">
                            {dayItems.map((item) => (
                              <article
                                key={item.id}
                                data-coach-session={item.id}
                                className={`is-${item.status}`}
                              >
                                <button
                                  onClick={() =>
                                    setExpanded((current) =>
                                      current === item.id ? null : item.id,
                                    )
                                  }
                                >
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
                                    <small>{item.summary}</small>
                                    {item.assignedBy && (
                                      <em>Assigned by {item.assignedBy}</em>
                                    )}
                                  </span>
                                  <strong>
                                    {expanded === item.id ? "⌃" : "⌄"}
                                  </strong>
                                </button>
                                {expanded === item.id && (
                                  <>
                                    <CompletedDetail item={item} />
                                    {item.assignmentId &&
                                      (item.status === "completed" ||
                                        item.status === "partial") && (
                                        <CoachFeedbackEditor
                                          item={item}
                                          service={service!}
                                          onChanged={() => refresh(false)}
                                        />
                                      )}
                                    {item.assignmentId &&
                                      item.status !== "completed" &&
                                      item.status !== "partial" && (
                                        <AssignedSessionControls
                                          item={item}
                                          service={service!}
                                          strengthTemplates={strengthTemplates}
                                          enduranceTemplates={
                                            enduranceTemplates
                                          }
                                          availability={availability}
                                          onChanged={refresh}
                                        />
                                      )}
                                  </>
                                )}
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p>No sessions</p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
              <section className="coach-client-panel weekly-builder">
                <header>
                  <span>
                    {activeProgram
                      ? `ADD TO ${activeProgram.name.toUpperCase()}`
                      : "BUILD THE WEEK"}
                  </span>
                  <h2>Assign sessions together</h2>
                  <p>
                    {activeProgram
                      ? "New sessions inside the block will remain linked to this program."
                      : "Add one or more strength and endurance templates, review the week, then confirm once."}
                  </p>
                </header>
                <div className="weekly-builder-list">
                  {drafts.map((draft, index) => {
                    const templates =
                      draft.modality === "strength"
                        ? strengthTemplates
                        : enduranceTemplates;
                    return (
                      <article key={draft.id}>
                        <div className="weekly-builder-order">
                          <button
                            onClick={() => moveDraft(index, -1)}
                            disabled={index === 0}
                            aria-label="Move draft earlier"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveDraft(index, 1)}
                            disabled={index === drafts.length - 1}
                            aria-label="Move draft later"
                          >
                            ↓
                          </button>
                        </div>
                        <label>
                          TYPE
                          <select
                            value={draft.modality}
                            onChange={(event) => {
                              const modality = event.target.value as
                                | "strength"
                                | "endurance";
                              const options =
                                modality === "strength"
                                  ? strengthTemplates
                                  : enduranceTemplates;
                              updateDraft(draft.id, {
                                modality,
                                templateId: options[0]?.id || "",
                              });
                            }}
                          >
                            <option value="strength">Strength</option>
                            <option value="endurance">Endurance</option>
                          </select>
                        </label>
                        <label>
                          TEMPLATE
                          <select
                            value={draft.templateId}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                templateId: event.target.value,
                              })
                            }
                          >
                            {templates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {"name" in template
                                  ? template.name
                                  : template.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          DATE
                          <input
                            type="date"
                            min={week.weekStart}
                            max={week.weekEnd}
                            value={draft.date}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                date: event.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          NOTE
                          <input
                            maxLength={1000}
                            value={draft.instruction}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                instruction: event.target.value,
                              })
                            }
                            placeholder="Optional instruction"
                          />
                        </label>
                        <button
                          className="weekly-builder-remove"
                          onClick={() =>
                            setDrafts((current) =>
                              current.filter((item) => item.id !== draft.id),
                            )
                          }
                          aria-label="Remove draft session"
                        >
                          ×
                        </button>
                      </article>
                    );
                  })}
                </div>
                {!strengthTemplates.length && !enduranceTemplates.length && (
                  <p className="coach-client-empty">
                    Create a template in your own Plan area before programming
                    this client.
                  </p>
                )}
                <div className="weekly-builder-actions">
                  <button
                    onClick={addDraft}
                    disabled={
                      !strengthTemplates.length && !enduranceTemplates.length
                    }
                  >
                    + Add session
                  </button>
                  {drafts.length > 0 && (
                    <button
                      className="assign-button"
                      disabled={drafts.some(
                        (draft) => !draft.templateId || !draft.date,
                      )}
                      onClick={() => setReviewOpen(true)}
                    >
                      Review{" "}
                      {drafts.length === 1
                        ? "session"
                        : `${drafts.length} sessions`}
                    </button>
                  )}
                </div>
              </section>
            </>
          )
        )}
      </div>
      {reviewOpen && week && (
        <div
          className="coach-review-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setReviewOpen(false);
          }}
        >
          <section
            className="coach-review-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-review-title"
          >
            <header>
              <div>
                <span>REVIEW PROGRAM</span>
                <h2 id="coach-review-title">Assign this week?</h2>
                <p>
                  {dateLabel(week.weekStart)} to {dateLabel(week.weekEnd, true)}
                </p>
              </div>
              <button
                onClick={() => setReviewOpen(false)}
                aria-label="Close review"
              >
                ×
              </button>
            </header>
            <div>
              {reviewWarnings.length > 0 && (
                <aside className="coach-availability-warning">
                  <b>Availability check</b>
                  <p>
                    {reviewWarnings
                      .map(
                        (item) =>
                          `${dateLabel(item.date)}${item.note ? ` · ${item.note}` : ""}`,
                      )
                      .join("; ")}
                  </p>
                  <small>
                    You can still assign these sessions after confirming.
                  </small>
                </aside>
              )}
              {weekDates.map((day) => {
                const rows = drafts.filter((draft) => draft.date === day);
                return rows.length ? (
                  <section key={day}>
                    <h3>{dateLabel(day)}</h3>
                    {rows.map((draft) => {
                      const options =
                        draft.modality === "strength"
                          ? strengthTemplates
                          : enduranceTemplates;
                      const template = options.find(
                        (item) => item.id === draft.templateId,
                      );
                      return (
                        <p key={draft.id}>
                          <b>
                            {template &&
                              ("name" in template
                                ? template.name
                                : template.title)}
                          </b>
                          <small>
                            {draft.modality === "strength"
                              ? "Strength"
                              : "Endurance"}
                            {draft.instruction ? ` · ${draft.instruction}` : ""}
                          </small>
                        </p>
                      );
                    })}
                  </section>
                ) : null;
              })}
            </div>
            <footer>
              <button onClick={() => setReviewOpen(false)}>Back</button>
              <button
                className="assign-button"
                disabled={busy}
                onClick={() => void confirmWeek()}
              >
                {busy
                  ? "Assigning..."
                  : `Assign ${drafts.length} ${drafts.length === 1 ? "session" : "sessions"}`}
              </button>
            </footer>
          </section>
        </div>
      )}
      {weeklyReviewOpen && (
        <CoachWeeklyReviewModal
          review={weeklyReview}
          primaryGoal={primaryGoal}
          loading={weeklyReviewLoading}
          error={weeklyReviewError}
          onClose={() => setWeeklyReviewOpen(false)}
          onSaveNote={saveWeeklyReviewNote}
          onOpenSession={(id) => {
            setWeeklyReviewOpen(false);
            setExpanded(id);
          }}
        />
      )}
    </main>
  );
}
