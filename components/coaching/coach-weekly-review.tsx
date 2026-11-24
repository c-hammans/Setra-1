"use client";

import { useEffect, useState } from "react";
import type {
  AthleteGoal,
  CoachWeeklyReview,
  CoachWeeklyReviewSession,
} from "@/lib/coaching/types";
import { parseLocalDate } from "@/lib/setra/week";
import { AthleteCheckinCard } from "@/components/workout/athlete-checkin";
import { CoachCommentsThread } from "@/components/coaching/coach-comments-thread";
import { AthleteGoalProgressCard } from "@/components/coaching/athlete-goal-progress";

const dateLabel = (value: string, year = false) =>
  new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: year ? "numeric" : undefined,
  }).format(parseLocalDate(value));
const durationLabel = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};
const distanceLabel = (metres: number, activityType?: string) =>
  activityType === "swim" || activityType === "row"
    ? `${Math.round(metres).toLocaleString()} m`
    : `${Number((metres / 1000).toFixed(2))} km`;
const activityLabel = (value: string) =>
  ({
    run: "Running",
    bike: "Cycling",
    swim: "Swimming",
    row: "Rowing",
    walk_hike: "Walking / hiking",
    elliptical: "Elliptical",
    cross_training: "Cross-training",
    custom: "Other",
    strength: "Strength",
  })[value] || value.replaceAll("_", " ");

function actualSummary(session: CoachWeeklyReviewSession) {
  const parts: string[] = [];
  if (session.actualDurationSeconds)
    parts.push(durationLabel(session.actualDurationSeconds));
  if (session.actualDistanceMetres)
    parts.push(
      distanceLabel(session.actualDistanceMetres, session.activityType),
    );
  if (session.actualSets != null) parts.push(`${session.actualSets} sets`);
  if (session.actualVolumeKg)
    parts.push(`${Math.round(session.actualVolumeKg).toLocaleString()} kg`);
  return parts.join(" · ");
}
function comparison(session: CoachWeeklyReviewSession) {
  const parts: string[] = [];
  if (session.plannedSets != null && session.actualSets != null)
    parts.push(
      `${session.plannedSets} planned sets · ${session.actualSets} completed`,
    );
  if (
    session.plannedDurationMinutes != null &&
    session.actualDurationSeconds != null
  )
    parts.push(
      `${Number(session.plannedDurationMinutes.toFixed(0))} min planned · ${durationLabel(session.actualDurationSeconds)} actual`,
    );
  if (
    session.plannedDistanceMetres != null &&
    session.actualDistanceMetres != null
  )
    parts.push(
      `${distanceLabel(session.plannedDistanceMetres, session.activityType)} planned · ${distanceLabel(session.actualDistanceMetres, session.activityType)} actual`,
    );
  return parts;
}

export function CoachWeeklyReviewModal({
  review,
  primaryGoal,
  loading,
  error,
  onClose,
  onOpenSession,
  onSaveNote,
}: {
  review: CoachWeeklyReview | null;
  primaryGoal?: AthleteGoal | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onOpenSession: (id: string) => void;
  onSaveNote: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState(review?.note?.text || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setNote(review?.note?.text || ""), [review?.note?.text]);
  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      await onSaveNote(note.trim());
      setMessage(
        note.trim()
          ? "Weekly review note saved."
          : "Weekly review note removed.",
      );
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "The weekly review note could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div
      className="coach-weekly-review-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="coach-weekly-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-weekly-review-title"
      >
        <header>
          <div>
            <span>WEEKLY REVIEW</span>
            <h2 id="coach-weekly-review-title">Training overview</h2>
            {review && (
              <p>
                {dateLabel(review.weekStart)} to{" "}
                {dateLabel(review.weekEnd, true)}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close weekly review">
            ×
          </button>
        </header>
        {loading ? (
          <p className="coach-review-state">Building the weekly review...</p>
        ) : error ? (
          <p className="coach-review-state error">{error}</p>
        ) : (
          review && (
            <div className="coach-weekly-review-scroll">
              {primaryGoal && (
                <AthleteGoalProgressCard goal={primaryGoal} compact />
              )}
              <section className="coach-review-summary">
                <div>
                  <b>
                    {review.completedSessions}/{review.plannedSessions}
                  </b>
                  <small>Completed</small>
                </div>
                <div>
                  <b>{Math.round(review.completionRate * 100)}%</b>
                  <small>Completion</small>
                </div>
                <div>
                  <b>
                    {review.totalDurationSeconds
                      ? durationLabel(review.totalDurationSeconds)
                      : "Not recorded"}
                  </b>
                  <small>Training time</small>
                </div>
                <div>
                  <b>{review.skippedSessions + review.missedSessions}</b>
                  <small>Skipped / missed</small>
                </div>
              </section>
              <section className="coach-review-metrics">
                <span>WEEK TOTALS</span>
                <div>
                  <p>
                    <b>{review.strengthSessions}</b>
                    <small>Strength</small>
                  </p>
                  <p>
                    <b>{review.enduranceSessions}</b>
                    <small>Endurance</small>
                  </p>
                  {review.strengthSets > 0 && (
                    <p>
                      <b>{review.strengthSets}</b>
                      <small>Strength sets</small>
                    </p>
                  )}
                  {review.strengthVolumeKg > 0 && (
                    <p>
                      <b>
                        {Math.round(review.strengthVolumeKg).toLocaleString()}{" "}
                        kg
                      </b>
                      <small>Strength volume</small>
                    </p>
                  )}
                  {review.sportTotals.map((sport) => (
                    <p key={sport.activityType}>
                      <b>
                        {sport.distanceMetres
                          ? distanceLabel(
                              sport.distanceMetres,
                              sport.activityType,
                            )
                          : durationLabel(sport.durationSeconds)}
                      </b>
                      <small>{activityLabel(sport.activityType)}</small>
                    </p>
                  ))}
                </div>
              </section>
              <section className="coach-review-sessions">
                <span>SESSIONS</span>
                {review.sessions.length ? (
                  review.sessions.map((session) => {
                    const actual = actualSummary(session);
                    const differences = comparison(session);
                    const athleteFeedback =
                      session.actualRpe != null ||
                      session.athleteFeel ||
                      session.athleteComment
                        ? {
                            rpe: session.actualRpe,
                            feel: session.athleteFeel,
                            comment: session.athleteComment,
                          }
                        : undefined;
                    return (
                      <article
                        key={session.id}
                        className={`status-${session.status}`}
                      >
                        <header>
                          <div>
                            <b>{session.title}</b>
                            <small>
                              {dateLabel(session.date)} ·{" "}
                              {activityLabel(session.activityType)}
                            </small>
                          </div>
                          <em>{session.status}</em>
                        </header>
                        <p>
                          <strong>Planned</strong>
                          {session.plannedSummary}
                        </p>
                        {actual && (
                          <p>
                            <strong>Actual</strong>
                            {actual}
                          </p>
                        )}
                        {differences.length > 0 && (
                          <div className="coach-review-comparison">
                            {differences.map((value) => (
                              <small key={value}>{value}</small>
                            ))}
                          </div>
                        )}
                        {athleteFeedback && (
                          <AthleteCheckinCard initial={athleteFeedback} />
                        )}{" "}
                        {session.coachFeedback && (
                          <blockquote>
                            <b>Coach feedback left</b>
                            {session.coachFeedback}
                          </blockquote>
                        )}
                        {(session.status === "completed" ||
                          session.status === "partial") && (
                          <button onClick={() => onOpenSession(session.id)}>
                            Open completed session
                          </button>
                        )}
                      </article>
                    );
                  })
                ) : (
                  <p className="coach-review-empty">
                    No planned sessions in this week.
                  </p>
                )}
              </section>
              <section className="coach-week-note">
                <span>WEEKLY REVIEW NOTE</span>
                <textarea
                  maxLength={3000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a concise review for the client"
                />
                <div>
                  <small>
                    {review.note
                      ? `Last updated ${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(review.note.updatedAt))}`
                      : "The client will see this in their Coaching area."}
                  </small>
                  <button
                    disabled={
                      saving || note.trim() === (review.note?.text || "")
                    }
                    onClick={() => void save()}
                  >
                    {saving
                      ? "Saving..."
                      : note.trim()
                        ? "Save review"
                        : "Remove review"}
                  </button>
                </div>
                {message && <em role="status">{message}</em>}
              </section>
              <CoachCommentsThread
                relationshipId={review.relationshipId}
                targetType="weekly_review"
                weekStart={review.weekStart}
              />
            </div>
          )
        )}
      </section>
    </div>
  );
}
