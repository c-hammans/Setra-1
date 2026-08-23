export type Exercise = { id: string; name: string; group: string; equipment: string };
export type TemplateExercise = { exerciseId: string; sets: number; reps: string; group?: string; note?: string };
export type Template = { id: string; name: string; focus: string; exercises: TemplateExercise[]; color?: string; icon?: string; supersetNames?: Record<string,string> };
export type SetLog = { reps: string; weight: string; rpe: string; done: boolean; note?: string };
// `text` is retained for diaries saved before BAND became its user-facing name.
export type LoadMode = "kg"|"band"|"bw"|"text";
export type WorkoutExercise = { exerciseId: string; sets: SetLog[]; note: string; group?: string; loadMode?: LoadMode; planNote?: string; repTarget?: string; skipped?: boolean };
export type Workout = { id: string; templateId?: string; name: string; date: string; startedAt: string; endedAt?: string; duration: number; exercises: WorkoutExercise[]; note: string; supersetNames?: Record<string,string> };
export type ScheduledWorkout = { date: string; templateId: string; skipped?: boolean };
export type AppData = { exercises: Exercise[]; templates: Template[]; workouts: Workout[]; scheduled: ScheduledWorkout[] };
export type CloudSyncState = "local" | "loading" | "synced" | "error";
