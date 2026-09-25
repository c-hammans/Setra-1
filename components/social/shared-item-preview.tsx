import { formatLoad, type StrengthUnit } from "@/lib/setra/units";
import type { SharedItem } from "@/lib/social/types";
import "./shared-item-preview.css";

type SnapshotValue = Record<string, unknown>;

const records = (value: unknown): SnapshotValue[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is SnapshotValue =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];

const text = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

function setLoad(set: SnapshotValue, loadMode: string, unit: StrengthUnit) {
  const weight = text(set.weight);
  if (loadMode === "bw") return "BW";
  if (loadMode === "text") return weight || "Band";
  return weight ? formatLoad(weight, unit) : "No load";
}

function StrengthStructure({ snapshot, unit }: { snapshot: SnapshotValue; unit: StrengthUnit }) {
  const exercises = records(snapshot.exercises).filter((exercise) => records(exercise.sets).length > 0);
  if (!exercises.length) return <p className="shared-preview-empty">No completed exercises were recorded.</p>;

  return (
    <div className="shared-workout-structure">
      {exercises.map((exercise, exerciseIndex) => {
        const sets = records(exercise.sets);
        const loadMode = text(exercise.loadMode) || "kg";
        return (
          <article key={`${text(exercise.exerciseId)}-${exerciseIndex}`}>
            <header>
              <b>{text(exercise.exerciseName) || "Exercise"}</b>
              <small>{sets.length} {sets.length === 1 ? "set" : "sets"}</small>
            </header>
            <div className="shared-set-list">
              {sets.map((set, setIndex) => (
                <div key={setIndex}>
                  <span>{setIndex + 1}</span>
                  <b>{setLoad(set, loadMode, unit)}</b>
                  <strong>{text(set.reps) ? `${text(set.reps)} reps` : "Reps not recorded"}</strong>
                  {text(set.rpe) && <small>RPE {text(set.rpe)}</small>}
                </div>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EnduranceStructure({ snapshot }: { snapshot: SnapshotValue }) {
  const blocks = records(snapshot.blocks);
  if (!blocks.length) return <p className="shared-preview-empty">No structured steps were recorded.</p>;

  return (
    <div className="shared-endurance-structure">
      {blocks.map((block, index) => {
        const distance = Number(block.distanceMetres || block.plannedDistanceMetres || 0);
        const duration = Number(block.durationSeconds || block.plannedDurationSeconds || 0);
        const details = [
          distance > 0 ? (distance >= 1000 ? `${distance / 1000} km` : `${distance} m`) : "",
          duration > 0 ? `${Math.round(duration / 60)} min` : "",
          text(block.intensityTarget),
        ].filter(Boolean);
        return (
          <div key={`${text(block.id)}-${index}`}>
            <span>{index + 1}</span>
            <p>
              <b>{text(block.title) || text(block.type) || "Step"}</b>
              {details.length > 0 && <small>{details.join(" · ")}</small>}
            </p>
            {Number(block.repetitions || 0) > 1 && <strong>×{text(block.repetitions)}</strong>}
          </div>
        );
      })}
    </div>
  );
}

export function SharedItemPreview({ item, unit }: { item: SharedItem; unit: StrengthUnit }) {
  const snapshot = item.snapshot;
  const facts = Object.entries(snapshot)
    .filter(
      ([key, value]) =>
        !["version", "modality", "name", "title", "blocks", "exercises", "warmup", "supersetNames"].includes(key) &&
        ["string", "number"].includes(typeof value),
    )
    .slice(0, 6);

  return (
    <>
      {facts.length > 0 && (
        <div className="shared-preview-facts">
          {facts.map(([key, value]) => (
            <p key={key}>
              <span>{key.replace(/([A-Z])/g, " $1")}</span>
              <b>{String(value)}</b>
            </p>
          ))}
        </div>
      )}
      <section className="shared-preview-structure">
        <span>WORKOUT</span>
        {item.itemType.startsWith("strength") ? (
          <StrengthStructure snapshot={snapshot} unit={unit} />
        ) : (
          <EnduranceStructure snapshot={snapshot} />
        )}
      </section>
    </>
  );
}
