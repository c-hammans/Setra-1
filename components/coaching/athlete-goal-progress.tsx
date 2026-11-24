import Link from "next/link";
import {
  buildAthleteGoalProgress,
  GOAL_TYPE_LABELS,
} from "@/lib/coaching/athlete-goals";
import type { AthleteGoal } from "@/lib/coaching/types";
import "./athlete-goal-progress.css";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
const attentionLabel = {
  goal_reached: "Goal reached",
  target_approaching: "Target date approaching",
  limited_recent_data: "Limited recent data",
} as const;

export function AthleteGoalProgressCard({
  goal,
  compact = false,
}: {
  goal: AthleteGoal;
  compact?: boolean;
}) {
  const progress = buildAthleteGoalProgress(goal);
  const currentHeading =
    goal.metricType === "strength_load" || goal.metricType === "event_time"
      ? "CURRENT PB"
      : goal.metricType === "distance" || goal.metricType === "duration"
        ? "CURRENT BEST"
        : "CURRENT";
  return (
    <article
      className={`coaching-goal-progress${goal.isPrimary ? " is-primary" : ""}${compact ? " is-compact" : ""}`}
    >
      <header>
        <div>
          {goal.isPrimary && <em>PRIMARY</em>}
          <small>{GOAL_TYPE_LABELS[goal.goalType]}</small>
          <b>{goal.title}</b>
        </div>
        {progress.attention && <i>{attentionLabel[progress.attention]}</i>}
      </header>
      <div className="coaching-goal-values">
        <span>
          <small>{currentHeading}</small>
          <b>{progress.currentLabel}</b>
        </span>
        <span>
          <small>TARGET</small>
          <b>{progress.targetLabel || "No measured target"}</b>
        </span>
      </div>
      {progress.available && progress.percentage != null && (
        <div
          className="coaching-goal-meter"
          aria-label={`${progress.percentage}% of target`}
        >
          <i style={{ width: `${progress.percentage}%` }} />
        </div>
      )}
      <p>
        {progress.trendLabel}
        {goal.currentValueDate
          ? ` · Best recorded ${dateLabel(goal.currentValueDate)}`
          : ""}
      </p>
      {!compact && (
        <footer>
          {goal.targetDate && <span>Target {dateLabel(goal.targetDate)}</span>}
          {goal.linkedPrograms.length > 0 && (
            <span>
              Linked:{" "}
              {goal.linkedPrograms.map((program) => program.name).join(", ")}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

export function AthleteGoalProgressList({
  goals,
  manageHref,
  title = "Goals / Progress",
}: {
  goals: AthleteGoal[];
  manageHref: string;
  title?: string;
}) {
  const active = goals.filter(
    (goal) => goal.status === "active" && goal.approvalStatus === "accepted",
  );
  return (
    <section className="coaching-goal-progress-section">
      <header>
        <div>
          <span>ATHLETE GOALS</span>
          <h2>{title}</h2>
        </div>
        <Link href={manageHref}>Manage ›</Link>
      </header>
      {active.length ? (
        <div>
          {active.map((goal) => (
            <AthleteGoalProgressCard key={goal.id} goal={goal} />
          ))}
        </div>
      ) : (
        <p>No accepted active goals yet.</p>
      )}
    </section>
  );
}
