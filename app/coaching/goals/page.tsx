"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  buildAthleteGoalProgress,
  formatGoalTime,
  GOAL_METRIC_LABELS,
  GOAL_TYPE_LABELS,
  goalTargetLabel,
  parseGoalTime,
} from "@/lib/coaching/athlete-goals";
import { CoachingService } from "@/lib/coaching/coaching-service";
import type {
  AthleteGoal,
  AthleteGoalDraft,
  AthleteGoalMetric,
  AthleteGoalType,
  AthleteProgramProgress,
  ClientProgramSummary,
} from "@/lib/coaching/types";
import { DiaryService } from "@/lib/data/diary-service";
import {
  createSetraTheme,
  useResolvedAppearance,
} from "@/lib/setra/appearance";
import { localDateKey, parseLocalDate } from "@/lib/setra/week";
import "./goals.css";

const blank = (relationshipId?: string | null): AthleteGoalDraft => ({
  relationshipId,
  title: "",
  goalType: "general_fitness",
  targetDate: null,
  metricType: "none",
  targetValue: null,
  targetUnit: "",
  targetLabel: "",
  targetDistanceMetres: null,
  targetText: "",
  notes: "",
  isPrimary: false,
  linkedProgramId: null,
});
const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseLocalDate(value));

export default function AthleteGoalsPage() {
  const { user } = useAuth();
  const service = useMemo(() => (user ? new CoachingService() : null), [user]);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [goals, setGoals] = useState<AthleteGoal[]>([]);
  const [programs, setPrograms] = useState<
    Array<ClientProgramSummary | AthleteProgramProgress>
  >([]);
  const [draft, setDraft] = useState<AthleteGoalDraft>(blank());
  const [timeTarget, setTimeTarget] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">(
    "system",
  );
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("relationship");
    setRelationshipId(id);
    setDraft(blank(id));
  }, []);
  const refresh = useCallback(async () => {
    if (!user || !service) return;
    setLoading(true);
    try {
      const [goalRows, programRows, profile] = await Promise.all([
        service.athleteGoals(relationshipId),
        relationshipId
          ? service.clientPrograms(relationshipId, localDateKey())
          : service.athletePrograms(localDateKey()),
        new DiaryService(user.id).loadProfile(),
      ]);
      setGoals(goalRows);
      setPrograms(programRows);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Goals could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [relationshipId, service, user]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  function edit(goal: AthleteGoal) {
    setDraft({
      id: goal.id,
      relationshipId,
      title: goal.title,
      goalType: goal.goalType,
      targetDate: goal.targetDate,
      metricType: goal.metricType,
      targetValue:
        goal.metricType === "distance" && goal.targetValue != null
          ? goal.targetValue / 1000
          : goal.targetValue,
      targetUnit: goal.targetUnit,
      targetLabel: goal.targetLabel,
      targetDistanceMetres:
        goal.metricType === "event_time" && goal.targetDistanceMetres != null
          ? goal.targetDistanceMetres / 1000
          : goal.targetDistanceMetres,
      targetText: goal.targetText,
      notes: goal.notes,
      isPrimary: goal.isPrimary,
      linkedProgramId: goal.linkedPrograms[0]?.id || null,
    });
    setTimeTarget(
      (goal.metricType === "event_time" || goal.metricType === "duration") &&
        goal.targetValue != null
        ? formatGoalTime(goal.targetValue)
        : "",
    );
    setOpen(true);
  }
  function start() {
    setDraft(blank(relationshipId));
    setTimeTarget("");
    setOpen(true);
  }
  async function save() {
    if (!service || saving) return;
    const next = { ...draft };
    if (next.metricType === "strength_load") {
      next.targetUnit = "kg";
    } else if (next.metricType === "event_time") {
      const seconds = parseGoalTime(timeTarget);
      if (seconds == null) {
        setMessage(
          "Enter the target time as minutes:seconds or hours:minutes:seconds.",
        );
        return;
      }
      next.targetValue = seconds;
      next.targetUnit = "seconds";
      next.targetDistanceMetres = (next.targetDistanceMetres || 0) * 1000;
    } else if (next.metricType === "distance") {
      next.targetValue = (next.targetValue || 0) * 1000;
      next.targetUnit = "metres";
    } else if (next.metricType === "duration") {
      const seconds = parseGoalTime(timeTarget);
      if (seconds == null) {
        setMessage(
          "Enter the target duration as minutes:seconds or hours:minutes:seconds.",
        );
        return;
      }
      next.targetValue = seconds;
      next.targetUnit = "seconds";
    } else if (next.metricType === "none") {
      next.targetValue = null;
      next.targetUnit = "";
      next.targetLabel = "";
      next.targetDistanceMetres = null;
      next.targetText = "";
    }
    setSaving(true);
    setMessage("");
    try {
      const savedId = await service.saveAthleteGoal(next);
      const previous = goals.find((goal) => goal.id === savedId);
      await Promise.all(
        (previous?.linkedPrograms || [])
          .filter((program) => program.id !== next.linkedProgramId)
          .map((program) =>
            service.linkAthleteGoalProgram(savedId, program.id, false),
          ),
      );
      setOpen(false);
      await refresh();
      setMessage(
        relationshipId && !next.id
          ? "Goal proposed to the athlete."
          : "Goal saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Goal could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(
    goal: AthleteGoal,
    status: AthleteGoal["status"],
  ) {
    if (!service) return;
    try {
      await service.setAthleteGoalStatus(goal.id, status);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Goal could not be updated.",
      );
    }
  }
  async function accept(goal: AthleteGoal, primary: boolean) {
    if (!service) return;
    try {
      await service.acceptAthleteGoal(goal.id, primary);
      await refresh();
      setMessage("Coach-proposed goal accepted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Goal could not be accepted.",
      );
    }
  }
  const active = goals.filter((goal) => goal.status === "active");
  const history = goals.filter((goal) => goal.status !== "active");
  const theme = createSetraTheme(accent, resolved, textScale);
  return (
    <main className="athlete-goals-screen" style={theme} data-theme={resolved}>
      <header className="athlete-goals-header">
        <Link
          href={relationshipId ? `/coaching/${relationshipId}` : "/coaching"}
          aria-label="Back to Coaching"
        >
          ‹
        </Link>
        <div>
          <small>COACHING</small>
          <b>{relationshipId ? "Athlete goals" : "Goals & targets"}</b>
        </div>
        <button onClick={start}>Add goal</button>
      </header>
      <div className="athlete-goals-content">
        <section className="athlete-goals-intro">
          <span>TRAINING DIRECTION</span>
          <h1>
            {relationshipId
              ? "Goals for this athlete"
              : "What are you working towards?"}
          </h1>
          <p>
            {relationshipId
              ? "Propose a clear target for the athlete to review and accept."
              : "Keep your current priorities visible to you and your coach."}
          </p>
        </section>
        {message && (
          <p className="athlete-goals-message" role="status">
            {message}
          </p>
        )}
        {loading ? (
          <p className="athlete-goals-empty">Loading goals...</p>
        ) : (
          <>
            <section className="athlete-goal-list">
              <header>
                <span>ACTIVE GOALS</span>
                <b>{active.length}</b>
              </header>
              {active.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  coachView={Boolean(relationshipId)}
                  onEdit={() => edit(goal)}
                  onStatus={(status) => void changeStatus(goal, status)}
                  onAccept={(primary) => void accept(goal, primary)}
                />
              ))}
              {!active.length && (
                <p className="athlete-goals-empty">No active goals yet.</p>
              )}
            </section>
            {history.length > 0 && (
              <section className="athlete-goal-list">
                <header>
                  <span>COMPLETED & ARCHIVED</span>
                  <b>{history.length}</b>
                </header>
                {history.map((goal) => (
                  <GoalRow
                    key={goal.id}
                    goal={goal}
                    coachView={Boolean(relationshipId)}
                    onEdit={() => edit(goal)}
                    onStatus={(status) => void changeStatus(goal, status)}
                    onAccept={(primary) => void accept(goal, primary)}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>
      {open && (
        <div
          className="athlete-goal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="athlete-goal-dialog"
            role="dialog"
            aria-modal="true"
          >
            <header>
              <div>
                <span>{draft.id ? "EDIT GOAL" : "NEW GOAL"}</span>
                <h2>
                  {relationshipId && !draft.id
                    ? "Propose a goal"
                    : "Goal details"}
                </h2>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="athlete-goal-fields">
              <label>
                Goal type
                <select
                  value={draft.goalType}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      goalType: event.target.value as AthleteGoalType,
                    }))
                  }
                >
                  {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  maxLength={120}
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Run sub-20 5K"
                />
              </label>
              <label>
                Target date <small>Optional</small>
                <input
                  type="date"
                  value={draft.targetDate || ""}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      targetDate: event.target.value || null,
                    }))
                  }
                />
              </label>
              <label>
                Target type
                <select
                  value={draft.metricType}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      metricType: event.target.value as AthleteGoalMetric,
                      targetValue: null,
                      targetLabel: "",
                      targetDistanceMetres: null,
                      targetText: "",
                    }))
                  }
                >
                  {Object.entries(GOAL_METRIC_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {draft.metricType === "strength_load" && (
                <div className="athlete-goal-pair">
                  <label>
                    Exercise
                    <input
                      value={draft.targetLabel}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          targetLabel: event.target.value,
                        }))
                      }
                      placeholder="Back Squat"
                    />
                  </label>
                  <label>
                    Target kg
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={draft.targetValue ?? ""}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          targetValue: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                </div>
              )}
              {draft.metricType === "event_time" && (
                <div className="athlete-goal-pair">
                  <label>
                    Distance km
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft.targetDistanceMetres ?? ""}
                      onChange={(event) =>
                        setDraft((value) => ({
                          ...value,
                          targetDistanceMetres: event.target.value
                            ? Number(event.target.value)
                            : null,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Target time
                    <input
                      value={timeTarget}
                      onChange={(event) => setTimeTarget(event.target.value)}
                      placeholder="19:59"
                    />
                  </label>
                </div>
              )}
              {draft.metricType === "distance" && (
                <label>
                  Target distance km
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={draft.targetValue ?? ""}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        targetValue: event.target.value
                          ? Number(event.target.value)
                          : null,
                      }))
                    }
                  />
                </label>
              )}
              {draft.metricType === "duration" && (
                <label>
                  Target duration
                  <input
                    value={timeTarget}
                    onChange={(event) => setTimeTarget(event.target.value)}
                    placeholder="1:30:00"
                  />
                </label>
              )}
              {draft.metricType === "custom" && (
                <label>
                  Target
                  <input
                    maxLength={240}
                    value={draft.targetText}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        targetText: event.target.value,
                      }))
                    }
                    placeholder="Describe the target"
                  />
                </label>
              )}
              <label>
                Notes <small>Optional</small>
                <textarea
                  maxLength={2000}
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((value) => ({
                      ...value,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Useful context for training decisions"
                />
              </label>
              {!relationshipId && (
                <label className="athlete-goal-check">
                  <input
                    type="checkbox"
                    checked={draft.isPrimary}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        isPrimary: event.target.checked,
                      }))
                    }
                  />
                  <span>Make this my Primary goal</span>
                </label>
              )}
              {programs.length > 0 && (
                <label>
                  Linked program <small>Optional</small>
                  <select
                    value={draft.linkedProgramId || ""}
                    onChange={(event) =>
                      setDraft((value) => ({
                        ...value,
                        linkedProgramId: event.target.value || null,
                      }))
                    }
                  >
                    <option value="">No linked program</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <footer>
              <button onClick={() => setOpen(false)}>Cancel</button>
              <button
                disabled={saving || !draft.title.trim()}
                onClick={() => void save()}
              >
                {saving
                  ? "Saving..."
                  : relationshipId && !draft.id
                    ? "Propose goal"
                    : "Save goal"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}

function GoalRow({
  goal,
  coachView,
  onEdit,
  onStatus,
  onAccept,
}: {
  goal: AthleteGoal;
  coachView: boolean;
  onEdit: () => void;
  onStatus: (status: AthleteGoal["status"]) => void;
  onAccept: (primary: boolean) => void;
}) {
  const target = goalTargetLabel(goal);
  const progress = buildAthleteGoalProgress(goal);
  const canEdit = !coachView || goal.createdByRole === "coach";
  return (
    <article className={`athlete-goal-row status-${goal.status}`}>
      <header>
        <div>
          {goal.isPrimary && <em>PRIMARY</em>}
          {goal.approvalStatus === "proposed" && <em>PROPOSED</em>}
          <small>{GOAL_TYPE_LABELS[goal.goalType]}</small>
          <h2>{goal.title}</h2>
        </div>
        <button onClick={onEdit} disabled={!canEdit}>
          {canEdit ? "Edit" : "Client-owned"}
        </button>
      </header>
      {target && (
        <p>
          <b>Target</b>
          {target}
        </p>
      )}
      {goal.targetDate && (
        <p>
          <b>Date</b>
          {dateLabel(goal.targetDate)}
        </p>
      )}
      {progress.available && (
        <>
          <p>
            <b>Current</b>
            {progress.currentLabel}
          </p>
          <div
            className="athlete-goal-progress-meter"
            aria-label={`${progress.percentage}% of target`}
          >
            <i style={{ width: `${progress.percentage}%` }} />
          </div>
          <p>
            <b>Trend</b>
            {progress.trendLabel}
          </p>
        </>
      )}
      {!progress.available &&
        goal.metricType !== "none" &&
        goal.metricType !== "custom" && (
          <p>
            <b>Current</b>No reliable matching data
          </p>
        )}
      {goal.goalReached && goal.status === "active" && (
        <aside>
          Goal reached based on recorded training. Confirm when you are ready.
        </aside>
      )}
      {goal.notes && <blockquote>{goal.notes}</blockquote>}
      {goal.linkedPrograms.length > 0 && (
        <small>
          Linked to{" "}
          {goal.linkedPrograms.map((program) => program.name).join(", ")}
        </small>
      )}
      <footer>
        {goal.approvalStatus === "proposed" && !coachView && (
          <>
            <button onClick={() => onAccept(false)}>Accept</button>
            <button onClick={() => onAccept(true)}>Accept as Primary</button>
          </>
        )}
        {goal.status === "active" && goal.approvalStatus === "accepted" && (
          <button onClick={() => onStatus("completed")}>Mark completed</button>
        )}
        {(!coachView || goal.createdByRole === "coach") && (
          <button
            onClick={() =>
              onStatus(goal.status === "archived" ? "active" : "archived")
            }
          >
            {goal.status === "archived" ? "Restore" : "Archive"}
          </button>
        )}
      </footer>
    </article>
  );
}
