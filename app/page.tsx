"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import type { AppData, EnduranceSession, EnduranceTemplate, Exercise, LoadMode, SetLog, Template, TemplateExercise, TrainingPreference, Workout, WorkoutExercise } from "@/lib/setra/types";
import { useAuth } from "@/components/auth/auth-provider";
import { DiaryService } from "@/lib/data/diary-service";
import { TrainingSessionService } from "@/lib/data/training-session-service";
import { FeedbackService, type FeedbackCategory } from "@/lib/feedback/feedback-service";
import { backupPendingDiaryChange, canImportLegacyDiary, claimLegacyDiary, clearCompletedWorkoutEditorDraft, clearEnduranceEditorDraft, clearLocalDraft, clearPendingDiaryFailure, clearStrengthEditorDraft, loadCompletedWorkoutEditorDraft, loadEnduranceEditorDraft, loadLocalAppearance, loadLocalAppColour, loadLocalDiary, loadLocalDraftSnapshot, loadLocalEnduranceSessions, loadLocalEnduranceTemplates, loadLocalTextScale, loadPendingDiaryChanges, loadRecoveryBackups, loadStrengthEditorDraft, localImportSummary, markPendingDiaryFailure, queuePendingDiaryChange, removePendingDiaryChange, removeRecoveryBackup, saveCompletedWorkoutEditorDraft, saveEnduranceEditorDraft, saveLocalAppearance, saveLocalAppColour, saveLocalDiary, saveLocalDraft, saveLocalEnduranceSessions, saveLocalEnduranceTemplates, saveLocalTextScale, saveLocalWriteVersions, saveStrengthEditorDraft, type PendingDiaryChange } from "@/lib/data/local-diary";
import {recoveryComparison} from "@/lib/data/recovery-comparison";
import {contrastColour,createSetraTheme,useResolvedAppearance,type AppearanceMode,type TextScale} from "@/lib/setra/appearance";
import {NavIcon,type NavIconName} from "@/components/navigation/nav-icon";
import {expandedExerciseCatalogue,mergeExerciseCatalogues} from "@/lib/setra/exercise-catalogue";
import {formatLoad,type StrengthUnit} from "@/lib/setra/units";
import {LoadInput} from "@/components/strength/load-input";
import {activityLabel,EnduranceSessionSheet} from "@/components/endurance/endurance-session-sheet";
import {ActivityIcon} from "@/components/endurance/activity-icon";
import {EnduranceStructureView,EnduranceWorkoutView} from "@/components/endurance/endurance-workout-view";
import {calculateStructuredTotals,formatStepTime,stepDistanceUsesMetres} from "@/lib/setra/endurance-steps";
import {ShareStudio} from "@/components/share/share-studio";
import {enduranceWorkoutShareData,strengthPBShareData,strengthWorkoutShareData} from "@/lib/share/share-data";
import {WeeklyPreview,type WeeklyPreviewItem} from "@/components/weekly/weekly-preview";
import {applyPreviousSetValues} from "@/lib/setra/workout-updates";
import {useDialogFocusTrap} from "@/components/ui/use-dialog-focus-trap";
import {PreviousSetButton} from "@/components/workout/previous-set-button";
import {HomeStreak} from "@/components/awards/home-streak";
import {addCalendarDays,localDateKey,monthGridDateKeys,orderedWeekdayInitials,recurrenceDateKeys,weekDateKeys,weekStartKey,type WeekdayIndex} from "@/lib/setra/week";
import {analytics,trackMilestoneOnce,trackWeeklyReturnOnce} from "@/lib/analytics/events";
import {strengthCompletion} from "@/lib/setra/completion";
import {createRecordId,createWorkoutId,newBlankWorkout,newTemplateWorkout} from "@/lib/setra/new-workout";
import {overlayPendingEndurance,overlayPendingStrength} from "@/lib/data/pending-reconciliation";
import {normalizeWriteError,userWriteErrorMessage} from "@/lib/data/write-errors";
import {ProgressOverview} from "@/components/history/progress-overview";
import "./endurance.css";
import "./share.css";
import "./weekly-preview.css";
import "./awards-home.css";
import "./audit-fixes.css";

type Tab = "today" | "plan" | "history" | "pbs" | "library";
type PBResult = { exerciseId: string; name: string; weight: number; reps: string; previousWeight?:number };

const betaFeedbackEnabled = true;
const localTime = (date = new Date()) => `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const daysAgo = (days: number) => addCalendarDays(localDateKey(),-days);

const coreExercises: Exercise[] = [
  { id: "back-squat", name: "Back Squat", group: "Quads", equipment: "Barbell" },
  { id: "bench-press", name: "Bench Press", group: "Chest", equipment: "Barbell" },
  { id: "rdl", name: "Romanian Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "lat-pulldown", name: "Lat Pulldown", group: "Back", equipment: "Cable" },
  { id: "bulgarian-split", name: "Bulgarian Split Squat", group: "Quads", equipment: "Dumbbell" },
  { id: "db-shoulder", name: "Dumbbell Shoulder Press", group: "Shoulders", equipment: "Dumbbell" },
  { id: "hip-thrust", name: "Hip Thrust", group: "Glutes", equipment: "Barbell" },
  { id: "seated-row", name: "Seated Cable Row", group: "Back", equipment: "Cable" },
  { id: "calf-raise", name: "Standing Calf Raise", group: "Calves", equipment: "Machine" },
  { id: "plank", name: "Plank", group: "Core", equipment: "Bodyweight" },
  { id: "front-squat", name: "Front Squat", group: "Quads", equipment: "Barbell" },
  { id: "goblet-squat", name: "Goblet Squat", group: "Quads", equipment: "Kettlebell" },
  { id: "deadlift", name: "Conventional Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "sumo-deadlift", name: "Sumo Deadlift", group: "Glutes", equipment: "Barbell" },
  { id: "leg-press", name: "Leg Press", group: "Quads", equipment: "Machine" },
  { id: "leg-extension", name: "Leg Extension", group: "Quads", equipment: "Machine" },
  { id: "leg-curl", name: "Lying Leg Curl", group: "Hamstrings", equipment: "Machine" },
  { id: "walking-lunge", name: "Walking Lunge", group: "Glutes", equipment: "Dumbbell" },
  { id: "step-up", name: "Step Up", group: "Glutes", equipment: "Dumbbell" },
  { id: "kb-swing", name: "Kettlebell Swing", group: "Glutes", equipment: "Kettlebell" },
  { id: "glute-bridge", name: "Banded Glute Bridge", group: "Glutes", equipment: "Band" },
  { id: "incline-db-press", name: "Incline Dumbbell Press", group: "Chest", equipment: "Dumbbell" },
  { id: "push-up", name: "Push Up", group: "Chest", equipment: "Bodyweight" },
  { id: "overhead-press", name: "Overhead Press", group: "Shoulders", equipment: "Barbell" },
  { id: "lateral-raise", name: "Lateral Raise", group: "Shoulders", equipment: "Dumbbell" },
  { id: "face-pull", name: "Face Pull", group: "Shoulders", equipment: "Cable" },
  { id: "pull-up", name: "Pull Up", group: "Back", equipment: "Bodyweight" },
  { id: "bent-row", name: "Bent Over Row", group: "Back", equipment: "Barbell" },
  { id: "single-arm-row", name: "Single Arm Row", group: "Back", equipment: "Dumbbell" },
  { id: "bicep-curl", name: "Bicep Curl", group: "Biceps", equipment: "Dumbbell" },
  { id: "hammer-curl", name: "Hammer Curl", group: "Biceps", equipment: "Dumbbell" },
  { id: "tricep-pushdown", name: "Tricep Pushdown", group: "Triceps", equipment: "Cable" },
  { id: "band-pull-apart", name: "Band Pull Apart", group: "Upper Back", equipment: "Band" },
  { id: "pallof-press", name: "Pallof Press", group: "Core", equipment: "Cable" },
  { id: "dead-bug", name: "Dead Bug", group: "Core", equipment: "Bodyweight" },
  { id: "farmers-carry", name: "Farmer's Carry", group: "Grip", equipment: "Kettlebell" },
  { id: "db-back-squat", name: "Dumbbell Squat", group: "Quads", equipment: "Dumbbell" },
  { id: "kb-front-squat", name: "Kettlebell Front Squat", group: "Quads", equipment: "Kettlebell" },
  { id: "banded-squat", name: "Banded Squat", group: "Quads", equipment: "Band" },
  { id: "db-rdl", name: "Dumbbell Romanian Deadlift", group: "Hamstrings", equipment: "Dumbbell" },
  { id: "kb-rdl", name: "Kettlebell Romanian Deadlift", group: "Hamstrings", equipment: "Kettlebell" },
  { id: "single-leg-rdl", name: "Single Leg Romanian Deadlift", group: "Hamstrings", equipment: "Dumbbell" },
  { id: "banded-rdl", name: "Banded Romanian Deadlift", group: "Hamstrings", equipment: "Band" },
  { id: "barbell-lunge", name: "Barbell Reverse Lunge", group: "Glutes", equipment: "Barbell" },
  { id: "kb-lunge", name: "Kettlebell Reverse Lunge", group: "Glutes", equipment: "Kettlebell" },
  { id: "banded-lunge", name: "Banded Lateral Lunge", group: "Glutes", equipment: "Band" },
  { id: "db-bench", name: "Dumbbell Bench Press", group: "Chest", equipment: "Dumbbell" },
  { id: "kb-floor-press", name: "Kettlebell Floor Press", group: "Chest", equipment: "Kettlebell" },
  { id: "banded-chest-press", name: "Banded Chest Press", group: "Chest", equipment: "Band" },
  { id: "db-row", name: "Dumbbell Bent Over Row", group: "Back", equipment: "Dumbbell" },
  { id: "kb-row", name: "Kettlebell Row", group: "Back", equipment: "Kettlebell" },
  { id: "banded-row", name: "Banded Seated Row", group: "Back", equipment: "Band" },
  { id: "kb-shoulder-press", name: "Kettlebell Shoulder Press", group: "Shoulders", equipment: "Kettlebell" },
  { id: "banded-shoulder-press", name: "Banded Shoulder Press", group: "Shoulders", equipment: "Band" },
  { id: "barbell-hip-thrust", name: "Barbell Hip Thrust", group: "Glutes", equipment: "Barbell" },
  { id: "db-hip-thrust", name: "Dumbbell Hip Thrust", group: "Glutes", equipment: "Dumbbell" },
  { id: "banded-hip-thrust", name: "Banded Hip Thrust", group: "Glutes", equipment: "Band" },
  { id: "barbell-calf-raise", name: "Barbell Calf Raise", group: "Calves", equipment: "Barbell" },
  { id: "db-calf-raise", name: "Dumbbell Calf Raise", group: "Calves", equipment: "Dumbbell" },
  { id: "kb-calf-raise", name: "Kettlebell Calf Raise", group: "Calves", equipment: "Kettlebell" },
  { id: "narrow-grip-pull-up", name: "Narrow Grip Pull Up", group: "Back", equipment: "Bodyweight" },
  { id: "wide-grip-pull-up", name: "Wide Grip Pull Up", group: "Back", equipment: "Bodyweight" },
  { id: "neutral-grip-pull-up", name: "Neutral Grip Pull Up", group: "Back", equipment: "Bodyweight" },
  { id: "assisted-pull-up", name: "Assisted Pull Up", group: "Back", equipment: "Machine" },
  { id: "band-assisted-pull-up", name: "Band Assisted Pull Up", group: "Back", equipment: "Band" },
  { id: "weighted-pull-up", name: "Weighted Pull Up", group: "Back", equipment: "Bodyweight" },
  { id: "chin-up", name: "Chin Up", group: "Back", equipment: "Bodyweight" },
  { id: "narrow-grip-chin-up", name: "Narrow Grip Chin Up", group: "Back", equipment: "Bodyweight" },
  { id: "machine-pull-up", name: "Machine Pull Up", group: "Back", equipment: "Machine" },
  { id: "barbell-rdl", name: "Barbell Romanian Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "single-leg-barbell-rdl", name: "Single Leg Barbell Romanian Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "single-leg-db-rdl", name: "Single Leg Dumbbell Romanian Deadlift", group: "Hamstrings", equipment: "Dumbbell" },
  { id: "single-leg-kb-rdl", name: "Single Leg Kettlebell Romanian Deadlift", group: "Hamstrings", equipment: "Kettlebell" },
  { id: "b-stance-barbell-rdl", name: "B-Stance Barbell Romanian Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "b-stance-db-rdl", name: "B-Stance Dumbbell Romanian Deadlift", group: "Hamstrings", equipment: "Dumbbell" },
  { id: "smith-machine-rdl", name: "Smith Machine Romanian Deadlift", group: "Hamstrings", equipment: "Machine" },
  { id: "landmine-rdl", name: "Landmine Romanian Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "cable-rdl", name: "Cable Romanian Deadlift", group: "Hamstrings", equipment: "Cable" },
  { id: "stiff-leg-deadlift", name: "Stiff Leg Barbell Deadlift", group: "Hamstrings", equipment: "Barbell" },
  { id: "trap-bar-deadlift", name: "Trap Bar Deadlift", group: "Hamstrings", equipment: "Trap Bar" },
  { id: "hack-squat", name: "Hack Squat", group: "Quads", equipment: "Machine" },
  { id: "smith-back-squat", name: "Smith Machine Back Squat", group: "Quads", equipment: "Machine" },
  { id: "heels-elevated-squat", name: "Heels Elevated Dumbbell Squat", group: "Quads", equipment: "Dumbbell" },
  { id: "single-leg-press", name: "Single Leg Press", group: "Quads", equipment: "Machine" },
  { id: "barbell-bulgarian-split", name: "Barbell Bulgarian Split Squat", group: "Quads", equipment: "Barbell" },
  { id: "smith-bulgarian-split", name: "Smith Machine Bulgarian Split Squat", group: "Quads", equipment: "Machine" },
  { id: "cable-pull-through", name: "Cable Pull Through", group: "Glutes", equipment: "Cable" },
  { id: "single-leg-hip-thrust", name: "Single Leg Hip Thrust", group: "Glutes", equipment: "Bodyweight" },
  { id: "smith-hip-thrust", name: "Smith Machine Hip Thrust", group: "Glutes", equipment: "Machine" },
  { id: "machine-hip-thrust", name: "Hip Thrust Machine", group: "Glutes", equipment: "Machine" },
  { id: "cable-kickback", name: "Cable Glute Kickback", group: "Glutes", equipment: "Cable" },
  { id: "machine-chest-press", name: "Machine Chest Press", group: "Chest", equipment: "Machine" },
  { id: "incline-barbell-press", name: "Incline Barbell Bench Press", group: "Chest", equipment: "Barbell" },
  { id: "incline-machine-press", name: "Incline Machine Chest Press", group: "Chest", equipment: "Machine" },
  { id: "cable-chest-fly", name: "Cable Chest Fly", group: "Chest", equipment: "Cable" },
  { id: "chest-supported-row", name: "Chest Supported Dumbbell Row", group: "Back", equipment: "Dumbbell" },
  { id: "machine-row", name: "Seated Machine Row", group: "Back", equipment: "Machine" },
  { id: "t-bar-row", name: "T-Bar Row", group: "Back", equipment: "Machine" },
  { id: "wide-grip-lat-pulldown", name: "Wide Grip Lat Pulldown", group: "Back", equipment: "Cable" },
  { id: "narrow-grip-lat-pulldown", name: "Narrow Grip Lat Pulldown", group: "Back", equipment: "Cable" },
  { id: "single-arm-lat-pulldown", name: "Single Arm Lat Pulldown", group: "Back", equipment: "Cable" },
  { id: "arnold-press", name: "Arnold Press", group: "Shoulders", equipment: "Dumbbell" },
  { id: "machine-shoulder-press", name: "Machine Shoulder Press", group: "Shoulders", equipment: "Machine" },
  { id: "cable-lateral-raise", name: "Cable Lateral Raise", group: "Shoulders", equipment: "Cable" },
  { id: "rear-delt-fly", name: "Rear Delt Fly", group: "Shoulders", equipment: "Machine" },
  { id: "ez-bar-curl", name: "EZ Bar Bicep Curl", group: "Biceps", equipment: "EZ Bar" },
  { id: "cable-bicep-curl", name: "Cable Bicep Curl", group: "Biceps", equipment: "Cable" },
  { id: "overhead-tricep-extension", name: "Overhead Tricep Extension", group: "Triceps", equipment: "Cable" },
  { id: "skull-crusher", name: "EZ Bar Skull Crusher", group: "Triceps", equipment: "EZ Bar" },
  { id: "machine-hip-abduction", name: "Hip Abduction Machine", group: "Glutes", equipment: "Machine" },
  { id: "machine-hip-adduction", name: "Hip Adduction Machine", group: "Adductors", equipment: "Machine" },
  { id: "cable-crunches", name: "Cable Crunch", group: "Core", equipment: "Cable" },
  { id: "leg-raises", name: "Leg Raises", group: "Core", equipment: "Bodyweight" },
  { id: "lying-leg-raise", name: "Lying Leg Raise", group: "Core", equipment: "Bodyweight" },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", group: "Core", equipment: "Bodyweight" },
  { id: "captains-chair-leg-raise", name: "Captain's Chair Leg Raise", group: "Core", equipment: "Machine" },
  { id: "single-leg-squat", name: "Single Leg Squat", group: "Quads", equipment: "Bodyweight" },
  { id: "single-leg-squat-to-box", name: "Single Leg Squat to Box", group: "Quads", equipment: "Bodyweight" },
  { id: "single-leg-squat-off-box", name: "Single Leg Squat off Box", group: "Quads", equipment: "Bodyweight" },
  { id: "pistol-squat", name: "Pistol Squat", group: "Quads", equipment: "Bodyweight" },
  { id: "assisted-pistol-squat", name: "Assisted Pistol Squat", group: "Quads", equipment: "Bodyweight" },
  { id: "trx-single-leg-squat", name: "TRX Single Leg Squat", group: "Quads", equipment: "Suspension Trainer" },
  { id: "dumbbell-single-leg-squat", name: "Dumbbell Single Leg Squat", group: "Quads", equipment: "Dumbbell" },
  { id: "kettlebell-single-leg-squat", name: "Kettlebell Single Leg Squat", group: "Quads", equipment: "Kettlebell" },
  { id: "skater-squat", name: "Skater Squat", group: "Quads", equipment: "Bodyweight" },
  { id: "pec-deck-chest-fly", name: "Machine Chest Fly", group: "Chest", equipment: "Machine" },
  { id: "dumbbell-chest-fly", name: "Dumbbell Chest Fly", group: "Chest", equipment: "Dumbbell" },
  { id: "incline-dumbbell-chest-fly", name: "Incline Dumbbell Chest Fly", group: "Chest", equipment: "Dumbbell" },
  { id: "barbell-shrug", name: "Barbell Shrug", group: "Traps", equipment: "Barbell" },
  { id: "dumbbell-shrug", name: "Dumbbell Shrug", group: "Traps", equipment: "Dumbbell" },
  { id: "cable-shrug", name: "Cable Shrug", group: "Traps", equipment: "Cable" },
  { id: "machine-shrug", name: "Machine Shrug", group: "Traps", equipment: "Machine" },
  { id: "trap-bar-shrug", name: "Trap Bar Shrug", group: "Traps", equipment: "Trap Bar" },
  { id: "prone-trap-raise", name: "Prone Trap Raise", group: "Traps", equipment: "Dumbbell" },
  { id: "side-plank", name: "Side Plank", group: "Obliques", equipment: "Bodyweight" },
  { id: "side-plank-hip-dip", name: "Side Plank Hip Dip", group: "Obliques", equipment: "Bodyweight" },
  { id: "russian-twist", name: "Russian Twist", group: "Obliques", equipment: "Bodyweight" },
  { id: "cable-wood-chop", name: "Cable Wood Chop", group: "Obliques", equipment: "Cable" },
  { id: "cable-reverse-wood-chop", name: "Cable Reverse Wood Chop", group: "Obliques", equipment: "Cable" },
  { id: "landmine-rotation", name: "Landmine Rotation", group: "Obliques", equipment: "Barbell" },
  { id: "dumbbell-side-bend", name: "Dumbbell Side Bend", group: "Obliques", equipment: "Dumbbell" },
  { id: "pallof-isometric-hold", name: "Pallof Press Isometric Hold", group: "Obliques", equipment: "Cable" },
  { id: "barbell-wrist-curl", name: "Barbell Wrist Curl", group: "Forearms", equipment: "Barbell" },
  { id: "dumbbell-wrist-curl", name: "Dumbbell Wrist Curl", group: "Forearms", equipment: "Dumbbell" },
  { id: "reverse-wrist-curl", name: "Dumbbell Reverse Wrist Curl", group: "Forearms", equipment: "Dumbbell" },
  { id: "wrist-roller", name: "Wrist Roller", group: "Forearms", equipment: "Other" },
  { id: "plate-pinch", name: "Plate Pinch", group: "Forearms", equipment: "Plate" },
  { id: "reverse-barbell-curl", name: "Reverse Barbell Curl", group: "Forearms", equipment: "Barbell" },
  { id: "dead-hang", name: "Dead Hang", group: "Forearms", equipment: "Bodyweight" },
  { id: "wall-sit-hold", name: "Wall Sit Isometric Hold", group: "Quads", equipment: "Bodyweight" },
  { id: "squat-isometric-hold", name: "Squat Isometric Hold", group: "Quads", equipment: "Bodyweight" },
  { id: "split-squat-isometric-hold", name: "Split Squat Isometric Hold", group: "Quads", equipment: "Bodyweight" },
  { id: "glute-bridge-isometric-hold", name: "Glute Bridge Isometric Hold", group: "Glutes", equipment: "Bodyweight" },
  { id: "calf-raise-isometric-hold", name: "Calf Raise Isometric Hold", group: "Calves", equipment: "Bodyweight" },
  { id: "push-up-isometric-hold", name: "Push Up Isometric Hold", group: "Chest", equipment: "Bodyweight" },
  { id: "pull-up-isometric-hold", name: "Pull Up Isometric Hold", group: "Back", equipment: "Bodyweight" },
  { id: "hollow-body-hold", name: "Hollow Body Hold", group: "Core", equipment: "Bodyweight" },
];

const sampleExercises = mergeExerciseCatalogues(coreExercises, expandedExerciseCatalogue);

const sampleTemplates: Template[] = [
  { id: "lower-a", name: "Lower A", focus: "Squat strength", color: "#409ECE", icon: "◆", exercises: [
    { exerciseId: "back-squat", sets: 4, reps: "5" }, { exerciseId: "rdl", sets: 3, reps: "8" },
    { exerciseId: "bulgarian-split", sets: 3, reps: "10" }, { exerciseId: "calf-raise", sets: 3, reps: "12" },
  ]},
  { id: "upper-a", name: "Upper A", focus: "Push + pull", color: "#B7C7B3", icon: "↗", exercises: [
    { exerciseId: "bench-press", sets: 4, reps: "6" }, { exerciseId: "lat-pulldown", sets: 3, reps: "8" },
    { exerciseId: "db-shoulder", sets: 3, reps: "10" }, { exerciseId: "seated-row", sets: 3, reps: "10" },
  ]},
  { id: "runner-strength", name: "Runner Strength", focus: "Single-leg + posterior", color: "#FF6B6B", icon: "✦", exercises: [
    { exerciseId: "hip-thrust", sets: 3, reps: "8" }, { exerciseId: "bulgarian-split", sets: 3, reps: "8" },
    { exerciseId: "rdl", sets: 3, reps: "10" }, { exerciseId: "calf-raise", sets: 3, reps: "15" }, { exerciseId: "plank", sets: 3, reps: "45s" },
  ]},
];

const makeSet = (reps = ""): SetLog => ({ reps, weight: "", rpe: "", done: false, note: "" });
const completedSets=(exercise:WorkoutExercise)=>exercise.skipped?[]:exercise.sets.filter(set=>set.done);
const completedExercises=(workout:Workout)=>workout.exercises.filter(exercise=>completedSets(exercise).length>0);
const hasCompletedStrengthWork=(workout:Workout)=>strengthCompletion(workout).status!=="empty";
const liveExerciseFromTemplate = (item:TemplateExercise):WorkoutExercise => {
  const isRange=(item.reps.match(/\d+/g)?.length??0)>1;
  return {exerciseId:item.exerciseId,group:item.group,note:"",planNote:item.note||"",repTarget:item.reps,loadMode:item.plannedLoad?.mode||"kg",plannedLoad:item.plannedLoad,sets:Array.from({length:item.sets},()=>makeSet(isRange?"":item.reps.replace(/\D/g,"")))};
};
const restoreMissingTemplateExercises = (workout:Workout,template?:Template):Workout => {
  if(!template||template.exercises.length<=workout.exercises.length)return workout;
  const remaining=new Map<string,number>();
  workout.exercises.forEach(item=>remaining.set(item.exerciseId,(remaining.get(item.exerciseId)||0)+1));
  const missing=template.exercises.filter(item=>{const count=remaining.get(item.exerciseId)||0;if(count>0){remaining.set(item.exerciseId,count-1);return false}return true});
  if(!missing.length)return workout;
  return {...workout,supersetNames:{...template.supersetNames,...workout.supersetNames},exercises:[...workout.exercises,...missing.map(liveExerciseFromTemplate)]};
};
const sampleWorkouts: Workout[] = [
  { id: "sample-1", templateId: "lower-a", name: "Lower A", date: daysAgo(4), startedAt: "07:10", duration: 52, note: "Good session. Add 2.5 kg next week.", exercises: [
    { exerciseId: "back-squat", note: "", sets: [[5,60,7],[5,65,7],[5,67.5,8],[5,67.5,8]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
    { exerciseId: "rdl", note: "Hamstrings felt strong", sets: [[8,55,7],[8,60,8],[8,60,8]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
    { exerciseId: "bulgarian-split", note: "", sets: [[10,16,8],[10,16,8],[9,16,9]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
  ]},
  { id: "sample-2", templateId: "upper-a", name: "Upper A", date: daysAgo(7), startedAt: "17:35", duration: 46, note: "", exercises: [
    { exerciseId: "bench-press", note: "", sets: [[6,40,7],[6,42.5,8],[6,42.5,8],[5,42.5,9]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
    { exerciseId: "lat-pulldown", note: "", sets: [[8,40,7],[8,45,8],[8,45,8]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
  ]},
  { id: "sample-3", templateId: "lower-a", name: "Lower A", date: daysAgo(12), startedAt: "07:05", duration: 49, note: "", exercises: [
    { exerciseId: "back-squat", note: "", sets: [[5,60,7],[5,62.5,7],[5,65,8],[5,65,8]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
    { exerciseId: "rdl", note: "", sets: [[8,50,7],[8,55,7],[8,55,8]].map(([r,w,e]) => ({reps:String(r),weight:String(w),rpe:String(e),done:true})) },
  ]},
];

const initialData: AppData = { exercises: sampleExercises, templates: sampleTemplates, workouts: sampleWorkouts, scheduled: [{ date: localDateKey(), templateId: "lower-a" }] };
const motivations = ["Ready when you are.","Built for what’s next.","Strong starts here.","Show up and get stronger.","One set at a time.","Make today count.","Progress starts now.","Your strength is building.","Keep the momentum.","Today is yours.","Put in the work.","Go build something strong.","Small steps. Big goals.","Stronger with every set.","This is your time.","Earn tomorrow’s strength.","Move with purpose.","Start steady. End strong.","You’ve got this.","Ready. Set. Build.","Build the next version.","Train with purpose.","Make this session count.","The work starts now.","Own every rep.","Keep showing up.","Strength happens here.","One more strong day.","Begin where you are.","Let’s get stronger."];
const formatDate = (value: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
const calendarDateLabel=(date:string,counts:{planned:number;completed:number;partial:number;skipped:number},selected:boolean)=>{
  const parts=[new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(`${date}T12:00:00`))];
  if(selected)parts.push("selected");
  if(counts.completed)parts.push(`${counts.completed} completed ${counts.completed===1?"session":"sessions"}`);
  if(counts.partial)parts.push(`${counts.partial} partially completed ${counts.partial===1?"session":"sessions"}`);
  if(counts.planned)parts.push(`${counts.planned} planned ${counts.planned===1?"session":"sessions"}`);
  if(counts.skipped)parts.push(`${counts.skipped} skipped ${counts.skipped===1?"session":"sessions"}`);
  if(!counts.completed&&!counts.partial&&!counts.planned&&!counts.skipped)parts.push("no sessions");
  return parts.join(", ");
};
const profileInitials = (name?:string,email?:string) => {
  const words=(name||"").trim().split(/\s+/).filter(Boolean);
  if(words.length>1)return `${words[0][0]}${words[words.length-1][0]}`.toUpperCase();
  if(words.length===1)return words[0].slice(0,2).toUpperCase();
  const emailName=(email||"").split("@")[0].replace(/[^a-z0-9]+/gi," ").trim();
  const emailWords=emailName.split(/\s+/).filter(Boolean);
  return emailWords.length>1?`${emailWords[0][0]}${emailWords[emailWords.length-1][0]}`.toUpperCase():(emailWords[0]||"SE").slice(0,2).toUpperCase();
};
const formatMinutes=(minutes?:number)=>minutes==null?"":minutes>=60?`${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`:`${Math.round(minutes)} min`;
const elapsedMinutes=(start?:string,end?:string)=>{if(!start||!end)return 0;const [sh,sm]=start.split(":").map(Number);const [eh,em]=end.split(":").map(Number);if([sh,sm,eh,em].some(value=>!Number.isFinite(value)))return 0;let minutes=(eh*60+em)-(sh*60+sm);if(minutes<0)minutes+=1440;return Math.max(0,minutes)};
const formatPace=(seconds?:number,unit="km")=>seconds==null?"":`${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,"0")} /${unit}`;
const enduranceSummary=(session:EnduranceSession)=>{const parts:string[]=[];const duration=session.status==="completed"?session.durationMinutes:session.plannedDurationMinutes;const distance=session.status==="completed"?session.distanceKm:session.plannedDistanceKm;if(duration)parts.push(formatMinutes(duration));if(distance)parts.push(`${Number(distance.toFixed(2))} km`);if(session.status!=="completed"&&!duration&&!distance){const totals=calculateStructuredTotals(session.blocks);if(totals.durationSeconds)parts.push(`${totals.durationCoverage==="partial"?"Known ":""}${formatStepTime(totals.durationSeconds)}`);if(totals.distanceMetres)parts.push(`${totals.distanceCoverage==="partial"?"Known ":""}${stepDistanceUsesMetres(session.activityType)?`${Math.round(totals.distanceMetres)} m`:`${Number((totals.distanceMetres/1000).toFixed(2))} km`}`)}if(session.averageSpeedKph)parts.push(`${session.averageSpeedKph.toFixed(1)} km/h`);else if(session.averageSplitSecondsPer500m)parts.push(formatPace(session.averageSplitSecondsPer500m,"500 m"));else if(session.averagePaceSecondsPerKm)parts.push(formatPace(session.activityType==="swim"?session.averagePaceSecondsPerKm/10:session.averagePaceSecondsPerKm,session.activityType==="swim"?"100 m":"km"));return parts.join(" · ")||(session.status==="completed"?"Details not recorded":"Open session")};
const compactDateRange=(dates:string[])=>dates.length?`${new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(new Date(`${dates[0]}T12:00:00`))}–${new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(new Date(`${dates[dates.length-1]}T12:00:00`))}`:"";
const weeklyEnduranceSummary=(session:EnduranceSession)=>{const repeated=session.blocks.find(block=>(block.type==="repeat_group"||Boolean(block.repetitions&&block.repetitions>1))&&block.repetitions);if(repeated){const child=session.blocks.find(block=>block.parentId===repeated.id);const useMetres=Boolean(child?.distanceMetres&&child.distanceMetres<1000)||session.activityType==="swim"||session.activityType==="row";const effort=child?.distanceMetres?`${Number((child.distanceMetres/(useMetres?1:1000)).toFixed(useMetres?0:2))} ${useMetres?"m":"km"}`:child?.durationSeconds?formatMinutes(child.durationSeconds/60):repeated.title;return `${repeated.repetitions} × ${effort}`;}return enduranceSummary(session)};

const retryCloud = async <T,>(action:()=>Promise<T>,attempts=2):Promise<T> => {
  let lastError:unknown;
  for(let attempt=0;attempt<attempts;attempt+=1){
    try{return await action()}catch(error){lastError=error;if(normalizeWriteError(error).kind!=="transient"||attempt>=attempts-1)break;await new Promise(resolve=>setTimeout(resolve,650))}
  }
  throw lastError;
};

export default function Home() {
  const {configured,user}=useAuth();
  const [today,setToday]=useState(()=>localDateKey());
  const diaryService=useMemo(()=>user?new DiaryService(user.id):null,[user]);
  const trainingService=useMemo(()=>user?new TrainingSessionService(user.id):null,[user]);
  const feedbackService=useMemo(()=>user?new FeedbackService(user.id):null,[user]);
  const [data, setData] = useState<AppData>(()=>user?{exercises:sampleExercises,templates:[],workouts:[],scheduled:[]}:initialData);
  const [enduranceSessions,setEnduranceSessions]=useState<EnduranceSession[]>([]);
  const [enduranceTemplates,setEnduranceTemplates]=useState<EnduranceTemplate[]>([]);
  const [trainingPreference,setTrainingPreference]=useState<TrainingPreference>("strength");
  const [enduranceEditor,setEnduranceEditor]=useState<{mode:"template"|"plan"|"log";initial?:EnduranceSession|EnduranceTemplate|null}|null>(null);
  const [trainingAction,setTrainingAction]=useState<"plan"|"log"|null>(null);
  const [enduranceDetailId,setEnduranceDetailId]=useState<string|null>(null);
  const [deleteEnduranceId,setDeleteEnduranceId]=useState<string|null>(null);
  const [deleteEnduranceTemplateId,setDeleteEnduranceTemplateId]=useState<string|null>(null);
  const [historyScope,setHistoryScope]=useState<"all"|"strength"|"endurance">("all");
  const [activityFilter,setActivityFilter]=useState("all");
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [active, setActive] = useState<Workout | null>(null);
  const [savedDraft, setSavedDraft] = useState<Workout | null>(null);
  const [liveEditIndex, setLiveEditIndex] = useState<number | null>(null);
  const [liveAddOpen, setLiveAddOpen] = useState(false);
  const [liveAddQuery, setLiveAddQuery] = useState("");
  const [liveSwapQuery, setLiveSwapQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [exerciseHistoryId, setExerciseHistoryId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Template | null>(null);
  const [picker, setPicker] = useState(false);
  const [swapPlanned, setSwapPlanned] = useState<{date:string;templateId:string}|null>(null);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [editorQuery, setEditorQuery] = useState("");
  const [warmupQuery, setWarmupQuery] = useState("");
  const [warmupPickerOpen, setWarmupPickerOpen] = useState(false);
  const [warmupExpanded, setWarmupExpanded] = useState(true);
  const [historyMode, setHistoryMode] = useState<"sessions" | "exercises" | "progress">("sessions");
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [motivation, setMotivation] = useState(motivations[0]);
  const [newPBs, setNewPBs] = useState<PBResult[]>([]);
  const [expandedPlanned, setExpandedPlanned] = useState<Set<string>>(new Set());
  const [expandedLiveExercises, setExpandedLiveExercises] = useState<Set<number>>(new Set());
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | null>(null);
  const [scheduleEnduranceTemplateId,setScheduleEnduranceTemplateId]=useState<string|null>(null);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleRepeat, setScheduleRepeat] = useState<"once"|"weekly"|"fortnightly">("once");
  const [scheduleWeeks, setScheduleWeeks] = useState(4);
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<number | null>(null);
  const draggedExerciseRef=useRef<number|null>(null);
  const warmupIdRef=useRef(0);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const completionLockRef=useRef(false);
  const initialActionHandledRef=useRef(false);
  const feedbackLinkHandledRef=useRef(false);
  const [completionSaving,setCompletionSaving]=useState(false);
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionFinishTime, setSessionFinishTime] = useState("");
  const [completedShare, setCompletedShare] = useState<Workout | null>(null);
  const [completionReceipt,setCompletionReceipt]=useState<Workout|null>(null);
  const [completionReceiptPbs,setCompletionReceiptPbs]=useState<PBResult[]>([]);
  const [completionReceiptSync,setCompletionReceiptSync]=useState<"pending"|"synced">("pending");
  const [saveTemplatePrompt,setSaveTemplatePrompt]=useState<Workout|null>(null);
  const [queuedTemplatePrompt,setQueuedTemplatePrompt]=useState<Workout|null>(null);
  const [completedEnduranceShare,setCompletedEnduranceShare]=useState<EnduranceSession|null>(null);
  const [completedEnduranceReceipt,setCompletedEnduranceReceipt]=useState<EnduranceSession|null>(null);
  const [enduranceReceiptSync,setEnduranceReceiptSync]=useState<"pending"|"synced">("pending");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [sessionTemplateSaved, setSessionTemplateSaved] = useState(false);
  const [cloudState,setCloudState]=useState<"local"|"loading"|"pending"|"synced"|"error">(configured?"loading":"local");
  const [cloudMessage,setCloudMessage]=useState("");
  const [syncIssues,setSyncIssues]=useState<PendingDiaryChange[]>([]);
  const [syncRecoveryOpen,setSyncRecoveryOpen]=useState(false);
  const [recoverySnapshot,setRecoverySnapshot]=useState<{strength:AppData;sessions:EnduranceSession[];templates:EnduranceTemplate[]}|null>(null);
  const [recoveryLoadState,setRecoveryLoadState]=useState<"idle"|"loading"|"ready"|"error">("idle");
  const [discardRecoveryId,setDiscardRecoveryId]=useState<string|null>(null);
  const [recoveryBackups,setRecoveryBackups]=useState<PendingDiaryChange[]>([]);
  const [draftSaveState,setDraftSaveState]=useState<"idle"|"saving"|"saved"|"device"|"pending"|"error">("idle");
  const [showImport,setShowImport]=useState(false);
  const [importBusy,setImportBusy]=useState(false);
  const [appColour,setAppColour]=useState("#409ECE");
  const [appearanceMode,setAppearanceMode]=useState<AppearanceMode>("system");
  const [textScale,setTextScale]=useState<TextScale>(1);
  const [showWorkoutTimingPopup,setShowWorkoutTimingPopup]=useState(true);
  const [showPbPopup,setShowPbPopup]=useState(true);
  const [preferredUnit,setPreferredUnit]=useState<StrengthUnit>("kg");
  const [weekStartsOn,setWeekStartsOn]=useState<WeekdayIndex>(1);
  const [lastWeeklyPreviewWeekStart,setLastWeeklyPreviewWeekStart]=useState<string|null>(null);
  const [profileReady,setProfileReady]=useState(false);
  const [enduranceReady,setEnduranceReady]=useState(false);
  const [weeklyPreviewOpen,setWeeklyPreviewOpen]=useState(false);
  const [feedbackOpen,setFeedbackOpen]=useState(false);
  const [feedbackCategory,setFeedbackCategory]=useState<FeedbackCategory>("general");
  const [feedbackMessage,setFeedbackMessage]=useState("");
  const [feedbackBusy,setFeedbackBusy]=useState(false);
  const [feedbackSent,setFeedbackSent]=useState(false);
  const [feedbackError,setFeedbackError]=useState("");
  const resolvedAppearance=useResolvedAppearance(appearanceMode);
  const prominentLayerOpen=Boolean(active||editor||picker||swapPlanned||scheduleTemplateId||scheduleEnduranceTemplateId||finishDialogOpen||completionReceipt||completedEnduranceReceipt||newPBs.length||completedShare||saveTemplatePrompt||completedEnduranceShare||detailId||deleteWorkoutId||deleteTemplateId||liveEditIndex!==null||liveAddOpen||exerciseHistoryId||feedbackOpen||trainingAction||enduranceEditor||enduranceDetailId||deleteEnduranceId||deleteEnduranceTemplateId||weeklyPreviewOpen||syncRecoveryOpen);
  useDialogFocusTrap(prominentLayerOpen);

  useEffect(() => {
    const stored=loadLocalDiary(user?.id);
    if(stored)setData({...stored,templates:stored.templates.map(template=>({...template,color:template.color?.toUpperCase()==="#7B61FF"?"#409ECE":template.color})),exercises:mergeExerciseCatalogues(sampleExercises,stored.exercises)});
    setSavedDraft(loadLocalDraftSnapshot(user?.id)?.workout||null);
    setRecoveryBackups(loadRecoveryBackups(user?.id));
    setEnduranceSessions(loadLocalEnduranceSessions(user?.id));
    setEnduranceTemplates(loadLocalEnduranceTemplates(user?.id));
    const cachedColour=loadLocalAppColour(user?.id);if(cachedColour)setAppColour(cachedColour);
    const cachedAppearance=loadLocalAppearance(user?.id);if(cachedAppearance)setAppearanceMode(cachedAppearance);
    const cachedTextScale=loadLocalTextScale(user?.id);if(cachedTextScale)setTextScale(cachedTextScale);
    const strengthEditorDraft=loadStrengthEditorDraft(user?.id);const enduranceEditorDraft=loadEnduranceEditorDraft(user?.id);
    if(strengthEditorDraft&&(!enduranceEditorDraft||strengthEditorDraft.updatedAt>=enduranceEditorDraft.updatedAt))setEditor(strengthEditorDraft.template);
    else if(enduranceEditorDraft)setEnduranceEditor({mode:enduranceEditorDraft.mode,initial:enduranceEditorDraft.value});
    const completedWorkoutEditorDraft=loadCompletedWorkoutEditorDraft(user?.id);if(completedWorkoutEditorDraft){setActive(completedWorkoutEditorDraft.workout);setEditingWorkoutId(completedWorkoutEditorDraft.editingWorkoutId)}
    setLoaded(true);
    setMotivation(motivations[Math.floor(Math.random()*motivations.length)]);
    const requestedTab=new URLSearchParams(window.location.search).get("tab");
    let storedTab:string|null=null;try{storedTab=localStorage.getItem(`setra-last-tab:${user?.id||"guest"}`)}catch{/* Restricted storage falls back to Today. */}
    if(requestedTab==="plan"||requestedTab==="history"||requestedTab==="pbs")setTab(requestedTab);
    else if(storedTab==="today"||storedTab==="plan"||storedTab==="history"||storedTab==="pbs")setTab(storedTab);
  }, [user?.id]);
  useEffect(()=>{const refreshDate=()=>setToday(current=>{const next=localDateKey();return next===current?current:next});const timer=window.setInterval(refreshDate,60_000);window.addEventListener("focus",refreshDate);document.addEventListener("visibilitychange",refreshDate);return()=>{window.clearInterval(timer);window.removeEventListener("focus",refreshDate);document.removeEventListener("visibilitychange",refreshDate)}},[]);
  useEffect(()=>{const restore=()=>{const requested=new URLSearchParams(window.location.search).get("tab");setTab(requested==="plan"||requested==="history"||requested==="pbs"?requested:"today")};window.addEventListener("popstate",restore);return()=>window.removeEventListener("popstate",restore)},[]);
  useEffect(()=>{if(loaded)try{localStorage.setItem(`setra-last-tab:${user?.id||"guest"}`,tab)}catch{/* Navigation remains functional without storage. */}},[loaded,tab,user?.id]);
  useEffect(() => { if (loaded&&!saveLocalDiary(data,user?.id).ok){setCloudState("error");setCloudMessage("This device is out of storage. Cloud data is unchanged, but new offline changes may not be recoverable.")} }, [data, loaded,user?.id]);
  useEffect(()=>{if(loaded&&!saveLocalEnduranceSessions(enduranceSessions,user?.id).ok){setCloudState("error");setCloudMessage("This device is out of storage. Endurance changes may not be available offline.")}},[enduranceSessions,loaded,user?.id]);
  useEffect(()=>{if(loaded&&!saveLocalEnduranceTemplates(enduranceTemplates,user?.id).ok){setCloudState("error");setCloudMessage("This device is out of storage. Template changes may not be available offline.")}},[enduranceTemplates,loaded,user?.id]);
  useEffect(()=>{if(!loaded||!editor)return;clearEnduranceEditorDraft(user?.id);const saved=saveStrengthEditorDraft(editor,user?.id);if(!saved.ok){setCloudState("error");setCloudMessage("This workout edit could not be saved on this device. Keep the editor open until you can save it.")}},[editor,loaded,user?.id]);
  useEffect(()=>{if(!loaded||!active||!editingWorkoutId)return;const saved=saveCompletedWorkoutEditorDraft(active,editingWorkoutId,user?.id);if(!saved.ok){setCloudState("error");setCloudMessage("This completed workout edit could not be saved on this device. Keep the editor open until you can update it.")}},[active,editingWorkoutId,loaded,user?.id]);
  useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{document.documentElement.style.setProperty("--setra-viewport-height",`${viewport.height}px`);document.documentElement.style.setProperty("--setra-viewport-offset-top",`${viewport.offsetTop}px`)};update();viewport.addEventListener("resize",update);viewport.addEventListener("scroll",update);return()=>{viewport.removeEventListener("resize",update);viewport.removeEventListener("scroll",update)}},[]);
  useEffect(()=>{if(trainingPreference==="endurance"&&(tab==="pbs"||tab==="library"))setTab("today")},[tab,trainingPreference]);
  useEffect(()=>{if(!profileReady||initialActionHandledRef.current||new URLSearchParams(window.location.search).get("action")!=="log")return;initialActionHandledRef.current=true;window.history.replaceState({},"","/");if(trainingPreference==="hybrid")setTrainingAction("log");else if(trainingPreference==="endurance")setEnduranceEditor({mode:"log"});else setPicker(true)},[profileReady,trainingPreference]);
  useEffect(()=>{if(!profileReady||feedbackLinkHandledRef.current||new URLSearchParams(window.location.search).get("feedback")!=="1")return;feedbackLinkHandledRef.current=true;window.history.replaceState({},"","/");openFeedback()},[profileReady]);
  useEffect(()=>{if(liveEditIndex!==null)setLiveSwapQuery("")},[liveEditIndex]);
  useEffect(()=>{
    if(!active||editingWorkoutId)return;
    setDraftSaveState("saving");
    const local=saveLocalDraft(active,user?.id);
    const queueKey=`workout:${active.id}`;
    const queued=queuePendingDiaryChange({key:queueKey,kind:"save_workout",payload:{workout:{...active,updatedAt:local.updatedAt},status:"in_progress"}},user?.id);
    if(!local.ok){setDraftSaveState("error");setCloudMessage("This device could not save the workout draft. Keep this page open and free some browser storage before continuing.")}
    if(!queued.ok){setDraftSaveState(local.ok?"device":"error");setCloudState("error");setCloudMessage(local.ok?"This draft is saved on this device, but it could not be added to the cloud-sync queue. Keep this page open or retry after freeing browser storage.":"The workout draft could not be saved on this device.");return}
    const timer=window.setTimeout(()=>{
      if(!diaryService){if(local.ok)setDraftSaveState("device");return}
      retryCloud(()=>diaryService.saveWorkout({...active,updatedAt:local.updatedAt},"in_progress",queued),2).then(version=>{removePendingDiaryChange(queueKey,queued.operationId,user?.id,version);setDraftSaveState("saved")}).catch(()=>{setDraftSaveState(local.ok&&queued.ok?"pending":"error");setCloudMessage(local.ok&&queued.ok?"Saved on this device. Cloud sync will retry automatically when Setra reconnects.":"The workout draft could not be saved.")});
    },650);
    return()=>window.clearTimeout(timer);
  },[active,diaryService,editingWorkoutId,user?.id]);
  useEffect(()=>{
    if(!profileReady||!diaryService||!user?.id)return;
    let cancelled=false;let replaying=false;
    const refreshIssues=()=>setSyncIssues(loadPendingDiaryChanges(user.id).filter(change=>Boolean(change.failure)));
    const replay=async()=>{
      if(replaying)return;replaying=true;
      try{
        for(const change of loadPendingDiaryChanges(user.id)){
          if(cancelled)return;
          if(change.failure?.kind&&change.failure.kind!=="transient")continue;
          if(change.failure?.nextRetryAt&&Date.parse(change.failure.nextRetryAt)>Date.now())continue;
          try{
            let version:number;
            if(change.kind==="save_workout")version=await diaryService.saveWorkout(change.payload.workout,change.payload.status,change);
            else if(change.kind==="replace_schedule")version=await diaryService.replaceSchedule(change.payload.items,change);
            else if(change.kind==="save_strength_template")version=await diaryService.saveTemplate(change.payload.template,change);
            else if(change.kind==="save_endurance_session"){if(!trainingService)continue;version=await trainingService.save(change.payload.session,change)}
            else if(change.kind==="save_endurance_template"){if(!trainingService)continue;version=await trainingService.saveTemplate(change.payload.template,change)}
            else if(change.kind==="delete_workout")version=await diaryService.deleteWorkout(change.payload.clientId,change);
            else if(change.kind==="delete_strength_template")version=await diaryService.deleteTemplate(change.payload.clientId,change);
            else if(change.kind==="delete_endurance_session"){if(!trainingService)continue;version=await trainingService.delete(change.payload.clientId,change)}
            else{if(!trainingService)continue;version=await trainingService.deleteTemplate(change.payload.clientId,change)}
            removePendingDiaryChange(change.key,change.operationId,user.id,version);
          }catch(error){
            const normalized=normalizeWriteError(error);
            if(normalized.kind==="stale"&&change.protocolVersion!==2){removePendingDiaryChange(change.key,change.operationId,user.id);continue}
            const attempts=(change.failure?.attempts||0)+1;
            const nextRetryAt=normalized.kind==="transient"?new Date(Date.now()+Math.min(300_000,2**Math.min(attempts,8)*1000)).toISOString():undefined;
            markPendingDiaryFailure(change.operationId,{kind:normalized.kind==="stale"?"conflict":normalized.kind==="duplicate"?"conflict":normalized.kind,message:userWriteErrorMessage(normalized),attempts,nextRetryAt},user.id);
            setCloudState("error");setCloudMessage(userWriteErrorMessage(normalized));
            // A failed entity must not block unrelated queued work.
          }
        }
      }finally{replaying=false;const remaining=loadPendingDiaryChanges(user.id);refreshIssues();if(remaining.length===0){setCloudState("synced");setCloudMessage("")}else if(remaining.some(change=>change.failure)){setCloudState("error")}}
    };
    refreshIssues();void replay();const retryTimer=window.setInterval(()=>void replay(),15_000);const online=()=>void replay();const storage=(event:StorageEvent)=>{if(event.key?.startsWith(`form-pending-diary-operation:${user.id}:`)||event.key===`form-pending-diary-changes:${user.id}`)void replay()};window.addEventListener("online",online);window.addEventListener("storage",storage);return()=>{cancelled=true;window.clearInterval(retryTimer);window.removeEventListener("online",online);window.removeEventListener("storage",storage)};
  },[profileReady,diaryService,trainingService,user?.id]);
  useEffect(()=>{
    if(!prominentLayerOpen)return;
    const scrollY=window.scrollY;
    const body=document.body;
    const root=document.documentElement;
    const previous={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow,rootOverflow:root.style.overflow,rootOverscroll:root.style.overscrollBehavior};
    body.style.position="fixed";body.style.top=`-${scrollY}px`;body.style.width="100%";body.style.overflow="hidden";
    root.style.overflow="hidden";root.style.overscrollBehavior="none";
    return()=>{body.style.position=previous.position;body.style.top=previous.top;body.style.width=previous.width;body.style.overflow=previous.overflow;root.style.overflow=previous.rootOverflow;root.style.overscrollBehavior=previous.rootOverscroll;window.scrollTo(0,scrollY)};
  },[prominentLayerOpen]);
  // closeStrengthEditor intentionally reads the current editor/template snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{if(!prominentLayerOpen)return;const closeTopLayer=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;if(syncRecoveryOpen)setSyncRecoveryOpen(false);else if(completionReceipt)setCompletionReceipt(null);else if(completedEnduranceReceipt)setCompletedEnduranceReceipt(null);else if(finishDialogOpen)setFinishDialogOpen(false);else if(weeklyPreviewOpen)setWeeklyPreviewOpen(false);else if(feedbackOpen)setFeedbackOpen(false);else if(exerciseHistoryId)setExerciseHistoryId(null);else if(liveEditIndex!==null)setLiveEditIndex(null);else if(liveAddOpen)setLiveAddOpen(false);else if(picker)setPicker(false);else if(swapPlanned)setSwapPlanned(null);else if(scheduleTemplateId||scheduleEnduranceTemplateId){setScheduleTemplateId(null);setScheduleEnduranceTemplateId(null)}else if(deleteWorkoutId)setDeleteWorkoutId(null);else if(deleteTemplateId)setDeleteTemplateId(null);else if(deleteEnduranceId)setDeleteEnduranceId(null);else if(deleteEnduranceTemplateId)setDeleteEnduranceTemplateId(null);else if(detailId)setDetailId(null);else if(enduranceDetailId)setEnduranceDetailId(null);else if(editor)closeStrengthEditor();else if(trainingAction)setTrainingAction(null)};window.addEventListener("keydown",closeTopLayer);return()=>window.removeEventListener("keydown",closeTopLayer)},[prominentLayerOpen,syncRecoveryOpen,completionReceipt,completedEnduranceReceipt,finishDialogOpen,weeklyPreviewOpen,feedbackOpen,exerciseHistoryId,liveEditIndex,liveAddOpen,picker,swapPlanned,scheduleTemplateId,scheduleEnduranceTemplateId,deleteWorkoutId,deleteTemplateId,deleteEnduranceId,deleteEnduranceTemplateId,detailId,enduranceDetailId,editor,trainingAction]);
  useEffect(()=>{
    if(!loaded||!diaryService)return;
    let cancelled=false;setCloudState("loading");
    retryCloud(()=>Promise.all([diaryService.load(),diaryService.loadDraft(),diaryService.loadProfile(),diaryService.loadWriteVersions()])).then(([cloud,draft,profile,writeVersions])=>{
      if(cancelled)return;
      saveLocalWriteVersions(writeVersions,user?.id);
      cloud=overlayPendingStrength(cloud,loadPendingDiaryChanges(user?.id));
      const reconciledSchedule=cloud.scheduled.filter(item=>!cloud.workouts.some(workout=>workout.date===item.date&&workout.templateId===item.templateId));
      if(reconciledSchedule.length!==cloud.scheduled.length){cloud.scheduled=reconciledSchedule;const key="schedule:current";const queued=queuePendingDiaryChange({key,kind:"replace_schedule",payload:{items:reconciledSchedule}},user?.id);if(queued.ok)void diaryService.replaceSchedule(reconciledSchedule,queued).then(version=>removePendingDiaryChange(key,queued.operationId,user?.id,version));else{setCloudState("error");setCloudMessage("The completed workout is safe, but its planned calendar occurrence could not be queued for removal.")}}
      const hasCloudData=cloud.templates.length>0||cloud.workouts.length>0||cloud.scheduled.length>0;
      if(hasCloudData)setData({...cloud,exercises:mergeExerciseCatalogues(sampleExercises,cloud.exercises)});
      const localDraft=loadLocalDraftSnapshot(user?.id);const cloudUpdated=draft?.updatedAt||"1970-01-01T00:00:00.000Z";const newestDraft=localDraft&&localDraft.updatedAt>cloudUpdated?localDraft.workout:draft;
      if(newestDraft){const restoredDraft=restoreMissingTemplateExercises(newestDraft,cloud.templates.find(template=>template.id===newestDraft.templateId));setSavedDraft(restoredDraft);saveLocalDraft(restoredDraft,user?.id);analytics.track("draft_recovered",{outcome:"recovered"})}
      const cachedColour=loadLocalAppColour(user?.id);
      if(cachedColour){setAppColour(cachedColour);if(cachedColour!==profile.appColour)void diaryService.updateAppColour(cachedColour)}
      else{setAppColour(profile.appColour);saveLocalAppColour(profile.appColour,user?.id)}
      setAppearanceMode(profile.appearanceMode);saveLocalAppearance(profile.appearanceMode,user?.id);
      setTextScale(profile.textScale);saveLocalTextScale(profile.textScale,user?.id);
      setTrainingPreference(profile.trainingPreference);
      setPreferredUnit(profile.preferredUnit);
      setShowWorkoutTimingPopup(profile.showWorkoutTimingPopup);setShowPbPopup(profile.showPbPopup);
      setWeekStartsOn(profile.weekStartsOn);setLastWeeklyPreviewWeekStart(profile.lastWeeklyPreviewWeekStart);setProfileReady(true);
      const local=loadLocalDiary();const summary=local?localImportSummary(local):null;
      if(hasCloudData&&local&&canImportLegacyDiary(user!.id))claimLegacyDiary(user!.id);
      if(!hasCloudData)setData({exercises:cloud.exercises.length?cloud.exercises:sampleExercises,templates:[],scheduled:[],workouts:[]});
      setShowImport(Boolean(local&&summary&&canImportLegacyDiary(user!.id)&&(summary.templates>0||summary.workoutCount>0||summary.scheduled>0))&&!hasCloudData);
      const outstanding=loadPendingDiaryChanges(user?.id);setCloudState(outstanding.length?outstanding.some(item=>item.failure)?"error":"pending":"synced");if(outstanding.length===0)setCloudMessage("");
    }).catch(error=>{if(!cancelled){setCloudState("error");setCloudMessage(error instanceof Error?error.message:"Cloud connection failed. Your local diary is still safe.")}});
    return()=>{cancelled=true};
  },[loaded,diaryService,user]);

  useEffect(()=>{if(!loaded||!trainingService)return;let cancelled=false;retryCloud(()=>Promise.all([trainingService.loadEndurance(),trainingService.loadEnduranceTemplates()])).then(([sessions,templates])=>{if(!cancelled){const reconciled=overlayPendingEndurance(sessions,templates,loadPendingDiaryChanges(user?.id));setEnduranceSessions(reconciled.sessions);setEnduranceTemplates(reconciled.templates)}}).catch(error=>{if(!cancelled){setCloudState("error");setCloudMessage(error instanceof Error?error.message:"Endurance data could not be loaded. Your local copy is still safe.")}}).finally(()=>{if(!cancelled)setEnduranceReady(true)});return()=>{cancelled=true}},[loaded,trainingService,user?.id]);
  useEffect(()=>{if(!syncRecoveryOpen||!diaryService||!trainingService)return;let cancelled=false;setRecoveryLoadState("loading");setRecoverySnapshot(null);Promise.all([diaryService.load(),diaryService.loadDraft(),trainingService.loadEndurance(),trainingService.loadEnduranceTemplates()]).then(([strength,draft,sessions,templates])=>{if(!cancelled){setRecoverySnapshot({strength:{...strength,workouts:draft?[draft,...strength.workouts.filter(item=>item.id!==draft.id)]:strength.workouts},sessions,templates});setRecoveryLoadState("ready")}}).catch(()=>{if(!cancelled){setRecoverySnapshot(null);setRecoveryLoadState("error")}});return()=>{cancelled=true}},[syncRecoveryOpen,diaryService,trainingService]);

  function runCloud<T>(action:(service:DiaryService)=>Promise<T>){
    if(!diaryService)return;
    setCloudState("loading");return retryCloud(()=>action(diaryService)).then(version=>{setCloudState("pending");return version}).catch(error=>{analytics.track("save_failed",{outcome:"failed"});setCloudState("error");setCloudMessage(userWriteErrorMessage(error));return null});
  }
  function navigateTab(next:Tab){setTab(next);const url=next==="today"?"/":`/?tab=${next}`;try{if(user?.id){window.localStorage.setItem(`setra-last-tab:${user.id}`,next);window.localStorage.setItem(`setra-last-location:${user.id}`,JSON.stringify({location:url,savedAt:Date.now()}))}}catch{/* Navigation remains available when storage is restricted. */}window.history.pushState({},"",url)}
  function persistSchedule(items:AppData["scheduled"]){
    const key="schedule:current";const queued=queuePendingDiaryChange({key,kind:"replace_schedule",payload:{items}},user?.id);
    if(!queued.ok){setCloudState("error");setCloudMessage("This schedule change could not be saved on this device. Free some browser storage, then try again.");return Promise.resolve(false)}
    const cloud=runCloud(service=>service.replaceSchedule(items,queued));
    if(!cloud){setCloudMessage("Schedule changes are saved on this device and waiting to sync.");return Promise.resolve(true)}
    void cloud.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version);else setCloudMessage("Schedule changes are saved on this device and waiting to sync.")});
    return Promise.resolve(true);
  }
  function runTrainingCloud(action:(service:TrainingSessionService)=>Promise<number>){if(!trainingService)return;setCloudState("loading");return retryCloud(()=>action(trainingService)).then(version=>{setCloudState("pending");return version}).catch(error=>{analytics.track("save_failed",{outcome:"failed"});setCloudState("error");setCloudMessage(userWriteErrorMessage(error));return null})}
  function closeCompletedWorkoutEditor(){clearCompletedWorkoutEditorDraft(user?.id);setActive(null);setEditingWorkoutId(null)}
  function closeStrengthEditor(){if(editor){const original=data.templates.find(item=>item.id===editor.id);if((!original||JSON.stringify(original)!==JSON.stringify(editor))&&!window.confirm("Discard these unsaved template changes?"))return}clearStrengthEditorDraft(user?.id);setEditor(null)}
  function closeEnduranceEditor(){clearEnduranceEditorDraft(user?.id);setEnduranceEditor(null)}
  function persistEnduranceEditorDraft(value:EnduranceSession|EnduranceTemplate){clearStrengthEditorDraft(user?.id);const saved=saveEnduranceEditorDraft(enduranceEditor?.mode||("status" in value?"plan":"template"),value,user?.id);if(!saved.ok){setCloudState("error");setCloudMessage("This endurance edit could not be saved on this device. Keep the editor open until you can save it.")}}
  function saveEnduranceValue(value:EnduranceSession|EnduranceTemplate){
    if(!("status" in value)){
      const key=`endurance-template:${value.id}`;const queued=queuePendingDiaryChange({key,kind:"save_endurance_template",payload:{template:value}},user?.id);
      if(!queued.ok){setCloudState("error");setCloudMessage("This template could not be saved on this device. The editor has stayed open.");return}
      setEnduranceTemplates(current=>[value,...current.filter(item=>item.id!==value.id)]);clearEnduranceEditorDraft(user?.id);setEnduranceEditor(null);
      runTrainingCloud(service=>service.saveTemplate(value,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});return;
    }
    const session=value;const key=`endurance-session:${session.id}`;const queued=queuePendingDiaryChange({key,kind:"save_endurance_session",payload:{session}},user?.id);
    if(!queued.ok){setCloudState("error");setCloudMessage("This activity could not be saved on this device. The editor has stayed open.");return}
    const initial=enduranceEditor?.initial;const initialSession=initial&&"status" in initial?initial:null;const newlyCompleted=session.status==="completed"&&enduranceEditor?.mode==="log"&&initialSession?.status!=="completed";
    if(newlyCompleted){analytics.track("training_mode_used",{modality:"endurance",source:session.templateId?"template":"manual"});if(!enduranceSessions.some(item=>item.status==="completed")&&!data.workouts.some(hasCompletedStrengthWork)&&user?.id)trackMilestoneOnce(user.id,"first_session_completed",{modality:"endurance",source:session.templateId?"template":"manual"})}
    setEnduranceSessions(current=>[session,...current.filter(item=>item.id!==session.id)].sort((a,b)=>b.date.localeCompare(a.date)));clearEnduranceEditorDraft(user?.id);setSelectedDate(session.date);setEnduranceEditor(null);setEnduranceDetailId(newlyCompleted?null:session.status==="completed"?session.id:null);if(newlyCompleted){setEnduranceReceiptSync("pending");setCompletedEnduranceReceipt(session)}
    runTrainingCloud(service=>service.save(session,queued))?.then(version=>{if(version!=null){const removed=removePendingDiaryChange(key,queued.operationId,user?.id,version);if(removed.ok){if(newlyCompleted)setEnduranceReceiptSync("synced");window.dispatchEvent(new Event("setra-training-changed"))}}});
  }
  function deleteEnduranceSession(session:EnduranceSession){const key=`endurance-session:${session.id}`;const queued=queuePendingDiaryChange({key,kind:"delete_endurance_session",payload:{clientId:session.id}},user?.id);if(!queued.ok){setCloudState("error");setCloudMessage("The deletion could not be saved on this device, so the session was not removed.");return}setEnduranceSessions(current=>current.filter(item=>item.id!==session.id));runTrainingCloud(service=>service.delete(session.id,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});setEnduranceDetailId(null);setDeleteEnduranceId(null)}
  function toggleEnduranceSkipped(session:EnduranceSession){const updated={...session,skipped:!session.skipped};const key=`endurance-session:${updated.id}`;const queued=queuePendingDiaryChange({key,kind:"save_endurance_session",payload:{session:updated}},user?.id);if(!queued.ok){setCloudState("error");setCloudMessage("This occurrence could not be updated on this device.");return}setEnduranceSessions(current=>current.map(item=>item.id===updated.id?updated:item));runTrainingCloud(service=>service.save(updated,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)})}
  function deleteEnduranceTemplate(){if(!deleteEnduranceTemplateId)return;const clientId=deleteEnduranceTemplateId;const key=`endurance-template:${clientId}`;const queued=queuePendingDiaryChange({key,kind:"delete_endurance_template",payload:{clientId}},user?.id);if(!queued.ok){setCloudState("error");setCloudMessage("The deletion could not be saved on this device, so the template was not removed.");return}setEnduranceTemplates(current=>current.filter(item=>item.id!==clientId));runTrainingCloud(service=>service.deleteTemplate(clientId,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});setDeleteEnduranceTemplateId(null)}
  async function importBrowserDiary(){
    if(!diaryService||!user||!canImportLegacyDiary(user.id))return;const local=loadLocalDiary();if(!local)return;
    setImportBusy(true);setCloudMessage("");
    try{await diaryService.importLocal(local);claimLegacyDiary(user.id);const cloud=await diaryService.load();setData({...cloud,exercises:mergeExerciseCatalogues(sampleExercises,cloud.exercises)});setShowImport(false);setCloudState("synced")}
    catch(error){setCloudState("error");setCloudMessage(error instanceof Error?error.message:"Import failed. Nothing was removed from this browser.")}
    finally{setImportBusy(false)}
  }
  const exerciseName = (id: string) => data.exercises.find(exercise => exercise.id === id)?.name ?? "Exercise";
  const pendingLabel=(change:PendingDiaryChange)=>change.kind==="save_workout"?change.payload.workout.name:change.kind==="save_strength_template"?change.payload.template.name:change.kind==="save_endurance_session"?change.payload.session.title:change.kind==="save_endurance_template"?change.payload.template.title:change.kind==="replace_schedule"?"Training schedule":change.payload.clientId;
  const serverRecord=(change:PendingDiaryChange)=>{if(!recoverySnapshot)return null;if(change.kind==="save_workout"||change.kind==="delete_workout")return recoverySnapshot.strength.workouts.find(item=>item.id===(change.kind==="save_workout"?change.payload.workout.id:change.payload.clientId))||null;if(change.kind==="save_strength_template"||change.kind==="delete_strength_template")return recoverySnapshot.strength.templates.find(item=>item.id===(change.kind==="save_strength_template"?change.payload.template.id:change.payload.clientId))||null;if(change.kind==="save_endurance_session"||change.kind==="delete_endurance_session")return recoverySnapshot.sessions.find(item=>item.id===(change.kind==="save_endurance_session"?change.payload.session.id:change.payload.clientId))||null;if(change.kind==="save_endurance_template"||change.kind==="delete_endurance_template")return recoverySnapshot.templates.find(item=>item.id===(change.kind==="save_endurance_template"?change.payload.template.id:change.payload.clientId))||null;return recoverySnapshot.strength.scheduled};
  function retrySyncIssue(change:PendingDiaryChange){clearPendingDiaryFailure(change.operationId,user?.id);setSyncIssues(current=>current.filter(item=>item.operationId!==change.operationId));window.dispatchEvent(new Event("online"))}
  function discardSyncIssue(change:PendingDiaryChange){const backup=backupPendingDiaryChange(change,user?.id);if(!backup.ok){setCloudMessage("Setra could not create a recoverable backup, so the device copy was kept.");return}const removed=removePendingDiaryChange(change.key,change.operationId,user?.id);if(!removed.ok){setCloudMessage("The device copy could not be removed and remains available for recovery.");return}setRecoveryBackups(loadRecoveryBackups(user?.id));setSyncIssues(current=>current.filter(item=>item.operationId!==change.operationId));setDiscardRecoveryId(null);setSyncRecoveryOpen(false);window.location.reload()}
  function restoreRecoveryBackup(change:PendingDiaryChange){const input=change.kind==="save_workout"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="replace_schedule"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="save_strength_template"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="save_endurance_session"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="save_endurance_template"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="delete_workout"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="delete_strength_template"?{key:change.key,kind:change.kind,payload:change.payload}:change.kind==="delete_endurance_session"?{key:change.key,kind:change.kind,payload:change.payload}:{key:change.key,kind:change.kind,payload:change.payload};const queued=queuePendingDiaryChange(input,user?.id);if(!queued.ok){setCloudMessage("This backup could not be restored to the device sync queue.");return}if(!removeRecoveryBackup(change.operationId,user?.id).ok){setCloudMessage("The backup was queued, but its retained snapshot could not be cleaned up yet.");return}setRecoveryBackups(loadRecoveryBackups(user?.id));setCloudState("pending");setCloudMessage("Recovery backup restored and waiting to sync.");window.dispatchEvent(new Event("online"))}
  function saveSyncIssueAsCopy(change:PendingDiaryChange){const suffix=`recovered-${change.operationId}`;let queued:{ok:boolean;error?:string}|null=null;let apply:()=>void=()=>{};if(change.kind==="save_workout"){const workout={...change.payload.workout,id:`${change.payload.workout.id}-${suffix}`,name:`${change.payload.workout.name} (recovered copy)`};queued=queuePendingDiaryChange({key:`workout:${workout.id}`,kind:"save_workout",payload:{workout,status:change.payload.status}},user?.id);apply=()=>{if(change.payload.status==="completed")setData(current=>({...current,workouts:current.workouts.some(item=>item.id===workout.id)?current.workouts:[workout,...current.workouts]}));else{saveLocalDraft(workout,user?.id);setSavedDraft(workout)}}}else if(change.kind==="save_strength_template"){const template={...change.payload.template,id:`${change.payload.template.id}-${suffix}`,name:`${change.payload.template.name} (recovered copy)`};queued=queuePendingDiaryChange({key:`strength-template:${template.id}`,kind:"save_strength_template",payload:{template}},user?.id);apply=()=>setData(current=>({...current,templates:current.templates.some(item=>item.id===template.id)?current.templates:[template,...current.templates]}))}else if(change.kind==="save_endurance_session"){const session={...change.payload.session,id:`${change.payload.session.id}-${suffix}`,title:`${change.payload.session.title} (recovered copy)`,plannedSessionId:undefined};queued=queuePendingDiaryChange({key:`endurance-session:${session.id}`,kind:"save_endurance_session",payload:{session}},user?.id);apply=()=>setEnduranceSessions(current=>current.some(item=>item.id===session.id)?current:[session,...current])}else if(change.kind==="save_endurance_template"){const template={...change.payload.template,id:`${change.payload.template.id}-${suffix}`,title:`${change.payload.template.title} (recovered copy)`};queued=queuePendingDiaryChange({key:`endurance-template:${template.id}`,kind:"save_endurance_template",payload:{template}},user?.id);apply=()=>setEnduranceTemplates(current=>current.some(item=>item.id===template.id)?current:[template,...current])}else return;if(!queued?.ok){setCloudMessage("The separate copy could not be stored. Your original device change is still safe.");return}apply();const removed=removePendingDiaryChange(change.key,change.operationId,user?.id);if(!removed.ok){setCloudMessage("The separate copy was saved, and the original remains available until Setra can safely clear it.");return}setSyncIssues(current=>current.filter(item=>item.operationId!==change.operationId));setSyncRecoveryOpen(false);window.dispatchEvent(new Event("online"))}
  const scheduledTemplates = data.scheduled.filter(item=>item.date===selectedDate).map(item=>data.templates.find(template=>template.id===item.templateId)).filter((template):template is Template=>Boolean(template)).filter(template=>!(savedDraft?.date===selectedDate&&savedDraft.templateId===template.id));
  const completedWorkouts = data.workouts.filter(workout => workout.date === selectedDate&&hasCompletedStrengthWork(workout));
  const fulfilledPlannedIds=new Set(enduranceSessions.filter(session=>session.status==="completed"&&session.plannedSessionId).map(session=>session.plannedSessionId!));
  const outstandingEndurancePlans=enduranceSessions.filter(session=>session.status==="planned"&&!fulfilledPlannedIds.has(session.id)).sort((a,b)=>a.date.localeCompare(b.date));
  const plannedEndurance=enduranceSessions.filter(session=>session.date===selectedDate&&session.status==="planned"&&!fulfilledPlannedIds.has(session.id));
  const completedEndurance=enduranceSessions.filter(session=>session.date===selectedDate&&session.status==="completed");
  const enduranceCalendarSessions=enduranceSessions.filter(session=>session.status!=="planned"||!fulfilledPlannedIds.has(session.id));
  const showStrength=trainingPreference!=="endurance";
  const showEndurance=trainingPreference!=="strength";
  const isHybrid=trainingPreference==="hybrid";
  const enduranceDetail=enduranceSessions.find(session=>session.id===enduranceDetailId);
  const detail = data.workouts.find(workout => workout.id === detailId);
  const historyExercise = data.exercises.find(exercise => exercise.id === exerciseHistoryId);
  const weekDays = useMemo(() => weekDateKeys(selectedDate,weekStartsOn),[selectedDate,weekStartsOn]);
  const monthDays = useMemo(() => monthGridDateKeys(selectedDate,weekStartsOn),[selectedDate,weekStartsOn]);
  const monthWeekdayInitials=useMemo(()=>orderedWeekdayInitials(weekStartsOn),[weekStartsOn]);
  const personalBests = useMemo(() => data.exercises.map(exercise => { const attempts=data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.id&&!item.skipped&&(item.loadMode==null||item.loadMode==="kg")).flatMap(item=>item.sets.filter(set=>set.done&&Number(set.weight)>0).map(set=>({set,workout})))); const best=attempts.sort((a,b)=>(Number(b.set.weight)||0)-(Number(a.set.weight)||0))[0]; return best&&Number(best.set.weight)>0?{exercise,best}:null; }).filter(Boolean) as {exercise:Exercise;best:{set:SetLog;workout:Workout}}[],[data]);
  const workoutInProgress = Boolean(active || savedDraft);
  const combinedHistory=useMemo(()=>[
    ...data.workouts.filter(hasCompletedStrengthWork).map(workout=>({kind:"strength" as const,date:workout.date,id:workout.id,title:workout.name,workout})),
    ...enduranceSessions.filter(session=>session.status==="completed").map(session=>({kind:"endurance" as const,date:session.date,id:session.id,title:session.title,session})),
  ].sort((a,b)=>b.date.localeCompare(a.date)),[data.workouts,enduranceSessions]);
  const visibleHistory=combinedHistory.filter(item=>isHybrid||(trainingPreference==="strength"?item.kind==="strength":item.kind==="endurance"));
  const recentHistory=visibleHistory.slice(0,3);
  const filteredSessionHistory=visibleHistory.filter(item=>!isHybrid||historyScope==="all"||item.kind===historyScope).filter(item=>item.kind==="strength"||activityFilter==="all"||item.session.activityType===activityFilter);
  const filteredExerciseHistory=data.exercises.filter(exercise=>data.workouts.some(workout=>workout.exercises.some(item=>item.exerciseId===exercise.id&&completedSets(item).length>0))&&exercise.name.toLowerCase().includes(libraryQuery.toLowerCase()));
  const effectiveHistoryMode=historyMode==="exercises"&&(!showStrength||(isHybrid&&historyScope==="endurance"))?"sessions":historyMode;
  const progressShowStrength=showStrength&&(!isHybrid||historyScope!=="endurance");
  const progressShowEndurance=showEndurance&&(!isHybrid||historyScope!=="strength");
  const progressWeeks=useMemo(()=>Array.from({length:6},(_,index)=>{const anchor=new Date(`${today}T12:00:00`);anchor.setDate(anchor.getDate()-(5-index)*7);const dates=weekDateKeys(localDateKey(anchor),weekStartsOn);const strength=progressShowStrength?data.workouts.filter(workout=>workout.date>=dates[0]&&workout.date<=dates[6]&&hasCompletedStrengthWork(workout)):[];const endurance=progressShowEndurance?enduranceSessions.filter(session=>session.status==="completed"&&session.date>=dates[0]&&session.date<=dates[6]):[];const knownMinutes=[...strength.map(item=>item.duration>0?item.duration:undefined),...endurance.map(item=>item.durationMinutes)].filter((value):value is number=>typeof value==="number"&&value>0);const knownDistance=endurance.filter(item=>typeof item.distanceKm==="number"&&item.distanceKm>0);return{key:dates[0],label:new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"short"}).format(new Date(`${dates[0]}T12:00:00`)),sessions:strength.length+endurance.length,strength:strength.length,endurance:endurance.length,minutes:knownMinutes.reduce((sum,value)=>sum+value,0),durationCoverage:knownMinutes.length,distance:knownDistance.reduce((sum,item)=>sum+(item.distanceKm||0),0),distanceCoverage:knownDistance.length}}),[data.workouts,enduranceSessions,progressShowEndurance,progressShowStrength,today,weekStartsOn]);
  const strengthTrends=useMemo(()=>data.exercises.flatMap(exercise=>{const records=data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.id&&!item.skipped&&(item.loadMode==null||item.loadMode==="kg")).map(item=>{const sets=completedSets(item).filter(set=>Number(set.weight)>0);const max=Math.max(0,...sets.map(set=>Number(set.weight)||0));return{date:workout.date,max,reps:sets.find(set=>Number(set.weight)===max)?.reps||""}})).filter(item=>item.max>0).sort((a,b)=>a.date.localeCompare(b.date));if(records.length<2)return[];const first=records[0],last=records.at(-1)!;return[{exercise,first,last,change:last.max-first.max}] }).sort((a,b)=>Math.abs(b.change)-Math.abs(a.change)).slice(0,3),[data.exercises,data.workouts]);
  const enduranceTrends=useMemo(()=>Array.from(new Set(enduranceSessions.filter(item=>item.status==="completed").map(item=>item.activityType))).map(activityType=>{const rows=enduranceSessions.filter(item=>item.status==="completed"&&item.activityType===activityType);const knownDistance=rows.filter(item=>typeof item.distanceKm==="number"&&item.distanceKm>0);const knownTime=rows.filter(item=>typeof item.durationMinutes==="number"&&item.durationMinutes>0);return{activityType,sessions:rows.length,distance:knownDistance.reduce((sum,item)=>sum+(item.distanceKm||0),0),minutes:knownTime.reduce((sum,item)=>sum+(item.durationMinutes||0),0),hasDistance:knownDistance.length>0,hasTime:knownTime.length>0}}),[enduranceSessions]);
  const calendarCounts=(date:string)=>{
    const strengthScheduled=showStrength?data.scheduled.filter(item=>item.date===date):[];
    const strengthPerformed=showStrength?data.workouts.filter(workout=>workout.date===date&&hasCompletedStrengthWork(workout)):[];
    const endurancePlanned=showEndurance?enduranceCalendarSessions.filter(session=>session.date===date&&session.status==="planned"):[];
    return {
      planned:strengthScheduled.filter(item=>!item.skipped).length+endurancePlanned.filter(session=>!session.skipped).length,
      completed:strengthPerformed.filter(workout=>strengthCompletion(workout).status==="complete").length+(showEndurance?enduranceCalendarSessions.filter(session=>session.date===date&&session.status==="completed").length:0),
      partial:strengthPerformed.filter(workout=>strengthCompletion(workout).status==="partial").length,
      skipped:strengthScheduled.filter(item=>item.skipped).length+endurancePlanned.filter(session=>session.skipped).length+(showEndurance?enduranceCalendarSessions.filter(session=>session.date===date&&session.status==="cancelled").length:0),
    };
  };
  const currentWeekDates=useMemo(()=>weekDateKeys(today,weekStartsOn),[today,weekStartsOn]);
  const displayedWeekDates=weekDays;
  const previousDisplayedWeekDates=useMemo(()=>{const anchor=new Date(`${displayedWeekDates[0]}T12:00:00`);anchor.setDate(anchor.getDate()-7);return weekDateKeys(localDateKey(anchor),weekStartsOn)},[displayedWeekDates,weekStartsOn]);
  const weeklyActuals=useMemo(()=>{const count=(dates:string[])=>{const strengthRows=data.workouts.filter(workout=>workout.date>=dates[0]&&workout.date<=dates[6]&&hasCompletedStrengthWork(workout));const enduranceRows=enduranceSessions.filter(session=>session.status==="completed"&&session.date>=dates[0]&&session.date<=dates[6]);return{strength:strengthRows.length,endurance:enduranceRows.length,total:strengthRows.length+enduranceRows.length,minutes:strengthRows.reduce((sum,item)=>sum+(item.duration||0),0)+enduranceRows.reduce((sum,item)=>sum+(item.durationMinutes||0),0)}};return{displayed:count(displayedWeekDates),previous:count(previousDisplayedWeekDates)}},[displayedWeekDates,data.workouts,enduranceSessions,previousDisplayedWeekDates]);
  const weeklyPreviewItems=useMemo<WeeklyPreviewItem[]>(()=>{
    const inWeek=(date:string)=>date>=displayedWeekDates[0]&&date<=displayedWeekDates[6];
    const items:WeeklyPreviewItem[]=[];
    const representedStrengthWorkouts=new Set<string>();
    const representedEnduranceActivities=new Set<string>();
    data.scheduled.filter(item=>inWeek(item.date)).forEach(item=>{
      const template=data.templates.find(candidate=>candidate.id===item.templateId);if(!template)return;
      const completed=data.workouts.find(workout=>workout.date===item.date&&workout.templateId===item.templateId&&hasCompletedStrengthWork(workout));
      if(completed)representedStrengthWorkouts.add(completed.id);
      items.push({id:`strength-${item.date}-${item.templateId}`,sourceId:item.templateId,completedId:completed?.id,date:item.date,title:template.name,descriptor:template.focus||"Strength",modality:"strength",status:completed?(strengthCompletion(completed).status==="partial"?"partial":"completed"):item.skipped?"skipped":"planned"});
    });
    data.workouts.filter(workout=>inWeek(workout.date)&&hasCompletedStrengthWork(workout)&&!representedStrengthWorkouts.has(workout.id)).forEach(workout=>{const exercises=completedExercises(workout);items.push({id:`strength-completed-${workout.id}`,sourceId:workout.templateId||workout.id,completedId:workout.id,date:workout.date,title:workout.name,descriptor:workout.templateId?"Strength":`Unplanned strength · ${exercises.length} ${exercises.length===1?"exercise":"exercises"}`,modality:"strength",status:strengthCompletion(workout).status==="partial"?"partial":"completed",startTime:workout.startedAt||undefined})});
    enduranceSessions.filter(session=>inWeek(session.date)&&session.status==="planned").forEach(session=>{
      const completed=enduranceSessions.find(candidate=>candidate.status==="completed"&&candidate.plannedSessionId===session.id);
      if(completed)representedEnduranceActivities.add(completed.id);
      items.push({id:`endurance-${session.id}`,sourceId:session.id,completedId:completed?.id,date:session.date,title:session.title,descriptor:weeklyEnduranceSummary(session),modality:"endurance",activityType:session.activityType,status:completed?"completed":session.skipped?"skipped":"planned",startTime:session.plannedStartTime});
    });
    enduranceSessions.filter(session=>inWeek(session.date)&&session.status==="cancelled").forEach(session=>items.push({id:`endurance-skipped-${session.id}`,sourceId:session.id,date:session.date,title:session.title,descriptor:"Skipped",modality:"endurance",activityType:session.activityType,status:"skipped",startTime:session.plannedStartTime}));
    enduranceSessions.filter(session=>inWeek(session.date)&&session.status==="completed"&&!representedEnduranceActivities.has(session.id)).forEach(session=>items.push({id:`endurance-completed-${session.id}`,sourceId:session.id,completedId:session.id,date:session.date,title:session.title,descriptor:`Unplanned · ${weeklyEnduranceSummary(session)}`,modality:"endurance",activityType:session.activityType,status:"completed",startTime:session.startedAt||undefined}));
    return items;
  },[displayedWeekDates,data.scheduled,data.templates,data.workouts,enduranceSessions]);
  const enduranceThisWeek=useMemo(()=>{const sessions=enduranceSessions.filter(session=>session.status==="completed"&&session.date>=currentWeekDates[0]&&session.date<=currentWeekDates[6]);const distanceRows=sessions.filter(session=>typeof session.distanceKm==="number");const durationRows=sessions.filter(session=>typeof session.durationMinutes==="number"&&session.durationMinutes>0);return {sessions:sessions.length,distance:distanceRows.reduce((sum,session)=>sum+(session.distanceKm||0),0),distanceCoverage:distanceRows.length,minutes:durationRows.reduce((sum,session)=>sum+(session.durationMinutes||0),0),durationCoverage:durationRows.length}},[enduranceSessions,currentWeekDates]);
  const strengthThisWeek=useMemo(()=>{const sessions=data.workouts.filter(workout=>workout.date>=currentWeekDates[0]&&workout.date<=currentWeekDates[6]&&hasCompletedStrengthWork(workout));const durationRows=sessions.filter(workout=>workout.duration>0);return {sessions:sessions.length,minutes:durationRows.reduce((sum,workout)=>sum+workout.duration,0),durationCoverage:durationRows.length}},[data.workouts,currentWeekDates]);
  const todayMessage=useMemo(()=>{
    if(selectedDate!==today){const planned=weeklyPreviewItems.filter(item=>item.date===selectedDate&&item.status==="planned").length;const completed=weeklyPreviewItems.filter(item=>item.date===selectedDate&&item.status==="completed").length;const partial=weeklyPreviewItems.filter(item=>item.date===selectedDate&&item.status==="partial").length;return planned?`${planned} ${planned===1?"session":"sessions"} planned.`:completed?`${completed} ${completed===1?"session":"sessions"} completed.`:partial?`${partial} partially completed ${partial===1?"session":"sessions"}.`:"No training planned for this day."}
    if(active||savedDraft?.date===today)return "Workout in progress — your latest changes are saved.";
    const plannedToday=weeklyPreviewItems.filter(item=>item.date===today&&item.status==="planned").length;if(plannedToday)return `${plannedToday} ${plannedToday===1?"session":"sessions"} planned for today.`;
    const completedToday=weeklyPreviewItems.filter(item=>item.date===today&&item.status==="completed").length;if(completedToday)return completedToday===1?"Today’s training is complete.":`${completedToday} sessions completed today.`;
    const partialToday=weeklyPreviewItems.filter(item=>item.date===today&&item.status==="partial").length;if(partialToday)return partialToday===1?"Today’s session was partially completed.":`${partialToday} sessions were partially completed today.`;
    const overdue=weeklyPreviewItems.filter(item=>item.date<today&&item.status==="planned").length;if(overdue)return `${overdue} overdue ${overdue===1?"session needs":"sessions need"} a decision.`;
    const next=weeklyPreviewItems.find(item=>item.date>today&&item.status==="planned");return next?`Next: ${next.title} · ${formatDate(next.date)}`:"Rest day or open plan — nothing is scheduled.";
  },[active,savedDraft,selectedDate,today,weeklyPreviewItems]);

  useEffect(()=>{
    if(!profileReady||!enduranceReady||!user?.id)return;
    const start=weekStartKey(today,weekStartsOn);
    const hasPriorTraining=data.workouts.some(workout=>hasCompletedStrengthWork(workout)&&workout.date<start)||enduranceSessions.some(session=>session.status==="completed"&&session.date<start);
    if(hasPriorTraining)trackWeeklyReturnOnce(user.id,start);
  },[data.workouts,enduranceReady,enduranceSessions,profileReady,today,user?.id,weekStartsOn]);

  function openWeeklyPreview(){
    const key=weekStartKey(today,weekStartsOn);analytics.track("weekly_review_used");setWeeklyPreviewOpen(true);setLastWeeklyPreviewWeekStart(key);if(diaryService)runCloud(service=>service.markWeeklyPreviewSeen(key));
  }
  function openWeeklySession(item:WeeklyPreviewItem){
    setWeeklyPreviewOpen(false);setSelectedDate(item.date);setTab("today");
    if(item.modality==="endurance"){setEnduranceDetailId(item.completedId||item.sourceId);return}
    if(item.completedId){setDetailId(item.completedId);return}
    setExpandedPlanned(current=>new Set(current).add(item.sourceId));
  }

  useEffect(()=>{
    if(!profileReady||!enduranceReady||tab!=="today"||prominentLayerOpen||workoutInProgress)return;
    if(typeof window!=="undefined"&&window.location.search)return;
    const key=weekStartKey(today,weekStartsOn);if(lastWeeklyPreviewWeekStart===key)return;
    openWeeklyPreview();
  // Opening is deliberately gated by the current layer state and persisted profile value.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profileReady,enduranceReady,tab,prominentLayerOpen,workoutInProgress,weekStartsOn,lastWeeklyPreviewWeekStart]);

  const previousSets = (exerciseId:string,loadMode:LoadMode="kg") => {const normalizedMode=loadMode==="text"?"band":loadMode;const exercise=data.workouts.flatMap(workout=>workout.exercises).find(item=>item.exerciseId===exerciseId&&(item.loadMode==="text"?"band":item.loadMode||"kg")===normalizedMode&&completedSets(item).length>0);return exercise?completedSets(exercise):[]};

  function startWorkout(template: Template, workoutDate = today) {
    if (workoutInProgress) return;
    completionLockRef.current=false;setCompletionSaving(false);
    setExpandedLiveExercises(new Set());
    setWarmupExpanded(true);
    setEditingWorkoutId(null);
    analytics.track("template_reused",{modality:"strength",source:"template"});
    setActive(newTemplateWorkout(template,workoutDate,localTime(),template.exercises.map(liveExerciseFromTemplate)));
    setPicker(false);
  }
  function startBlankWorkout() {
    if (workoutInProgress) return;
    completionLockRef.current=false;setCompletionSaving(false);
    setExpandedLiveExercises(new Set());
    setEditingWorkoutId(null);
    setActive(newBlankWorkout(selectedDate,localTime()));
    setPicker(false);
  }
  function saveDraft() {
    if (!active) return;
    const local=saveLocalDraft(active,user?.id);if(!local.ok){setDraftSaveState("error");setCloudMessage("This device could not save the workout draft.")}else setDraftSaveState("device");
    const key=`workout:${active.id}`;const queued=queuePendingDiaryChange({key,kind:"save_workout",payload:{workout:{...active,updatedAt:local.updatedAt},status:"in_progress"}},user?.id);
    if(queued.ok)runCloud(service=>service.saveWorkout({...active,updatedAt:local.updatedAt},"in_progress",queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version);setDraftSaveState(version!=null?"saved":"pending")});
    else{setCloudState("error");setCloudMessage(local.ok?"This workout is saved on this device, but it could not be queued for cloud sync.":"This workout could not be saved on this device.");setDraftSaveState(local.ok?"device":"error")}
    setSavedDraft(active); setActive(null); setTab("today");
  }
  function saveWorkout(timing?:{startedAt:string;endedAt:string}) {
    if (!active||completionLockRef.current) return;
    completionLockRef.current=true;setCompletionSaving(true);
    const startedAt=timing?.startedAt||active.startedAt;
    const endedAt=timing?.endedAt||active.endedAt;
    // Keep the complete prescription and its done/skipped state. History views decide
    // which completed sets to display; the saved workout remains an honest record of
    // what was planned, completed and intentionally skipped.
    const completedAt=active.completedAt||new Date().toISOString();
    const completed = { ...active, ...timing, completedAt, updatedAt:completedAt, duration: elapsedMinutes(startedAt,endedAt), exercises:active.exercises.map(exercise=>({...exercise,sets:exercise.sets.map(set=>({...set}))})) };
    let records:PBResult[]=[];
    if (!editingWorkoutId) {
      records = completed.exercises.flatMap(exercise => {
        if (exercise.loadMode && exercise.loadMode !== "kg") return [];
        const bestSet = exercise.sets.filter(set=>set.done&&Number(set.weight)>0).sort((a,b)=>Number(b.weight)-Number(a.weight))[0];
        if (!bestSet) return [];
        const previousBest = Math.max(0,...data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.exerciseId&&!item.skipped&&(item.loadMode==null||item.loadMode==="kg")).flatMap(item=>item.sets.filter(set=>set.done&&Number(set.weight)>0).map(set=>Number(set.weight)||0))));
        return Number(bestSet.weight)>previousBest?[{exerciseId:exercise.exerciseId,name:exerciseName(exercise.exerciseId),weight:Number(bestSet.weight),reps:bestSet.reps,previousWeight:previousBest||undefined}]:[];
      });
    }
    const nextScheduled=active.templateId?data.scheduled.filter(item=>!(item.date===active.date&&item.templateId===active.templateId)):data.scheduled;
    const workoutKey=`workout:${completed.id}`;
    let queuedWorkout:ReturnType<typeof queuePendingDiaryChange>;
    try{queuedWorkout=queuePendingDiaryChange({key:workoutKey,kind:"save_workout",payload:{workout:completed,status:"completed"}},user?.id)}catch(error){queuedWorkout={ok:false,key:workoutKey,operationId:"",revision:0,expectedVersion:0,protocolVersion:2,updatedAt:new Date().toISOString(),error:error instanceof Error?error.message:"Device persistence failed."}}
    if(!queuedWorkout.ok){
      // Preserve the identity, timestamp and entered values so a retry is the same completion.
      setActive(completed);completionLockRef.current=false;setCompletionSaving(false);setCloudState("error");setCloudMessage("The completed workout could not be saved on this device. Your entries remain open—free some browser storage, then try Finish again.");return;
    }
    if(!editingWorkoutId){
      analytics.track("training_mode_used",{modality:"strength",source:active.templateId?"template":"manual"});
      if(!data.workouts.some(hasCompletedStrengthWork)&&!enduranceSessions.some(item=>item.status==="completed")&&user?.id)trackMilestoneOnce(user.id,"first_session_completed",{modality:"strength",source:active.templateId?"template":"manual"});
      setCompletionReceiptSync("pending");setCompletionReceipt(completed);setCompletionReceiptPbs(showPbPopup?records:[]);setNewTemplateName("");setSessionTemplateSaved(false);if(!completed.templateId)setQueuedTemplatePrompt(completed);
    }
    setData(current => ({ ...current, workouts: editingWorkoutId ? current.workouts.map(workout=>workout.id===editingWorkoutId?completed:workout) : [completed, ...current.workouts], scheduled: nextScheduled }));
    runCloud(service=>service.saveWorkout(completed,"completed",queuedWorkout))?.then(version=>{if(version!=null){const removed=removePendingDiaryChange(workoutKey,queuedWorkout.operationId,user?.id,version);if(removed.ok){setCompletionReceiptSync("synced");void persistSchedule(nextScheduled).then(scheduleSaved=>{if(scheduleSaved)window.dispatchEvent(new Event("setra-training-changed"))})}}});clearLocalDraft(user?.id);clearCompletedWorkoutEditorDraft(user?.id);setSavedDraft(null);setActive(null);setEditingWorkoutId(null);setSelectedDate(completed.date);setTab("today");setDetailId(null);setFinishDialogOpen(false);setCompletionSaving(false);
  }
  function openFinishDialog() {
    if (!active) return;
    const planned=active.exercises.filter(exercise=>!exercise.skipped).reduce((sum,exercise)=>sum+exercise.sets.length,0);
    const done=active.exercises.reduce((sum,exercise)=>sum+completedSets(exercise).length,0);
    const skipped=active.exercises.filter(exercise=>exercise.skipped).length;
    if(!showWorkoutTimingPopup&&done>=planned&&skipped===0){saveWorkout();return}
    const fallbackStart=new Date();fallbackStart.setHours(fallbackStart.getHours()-1);
    setSessionStartTime(active.startedAt||localTime(fallbackStart));
    setSessionFinishTime(active.endedAt||localTime());
    setFinishDialogOpen(true);
  }
  function deleteCompletedWorkout() {
    if (!deleteWorkoutId) return;
    const clientId=deleteWorkoutId;const key=`workout:${clientId}`;const queued=queuePendingDiaryChange({key,kind:"delete_workout",payload:{clientId}},user?.id);
    if(!queued.ok){setCloudState("error");setCloudMessage("The deletion could not be saved on this device, so the workout was not removed.");return}
    runCloud(service=>service.deleteWorkout(clientId,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});
    setData(current => ({ ...current, workouts: current.workouts.filter(workout => workout.id !== clientId) }));
    setDetailId(null);
    setDeleteWorkoutId(null);
  }
  function deleteTemplate() {
    if (!deleteTemplateId) return;
    const clientId=deleteTemplateId;const key=`strength-template:${clientId}`;const queued=queuePendingDiaryChange({key,kind:"delete_strength_template",payload:{clientId}},user?.id);
    if(!queued.ok){setCloudState("error");setCloudMessage("The deletion could not be saved on this device, so the template was not removed.");return}
    runCloud(service=>service.deleteTemplate(clientId,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});
    setData(current=>({...current,templates:current.templates.filter(template=>template.id!==clientId),scheduled:current.scheduled.filter(item=>item.templateId!==clientId)}));
    if (editor?.id===clientId) closeStrengthEditor();
    setDeleteTemplateId(null);
  }
  function saveSessionAsTemplate() {
    if (!saveTemplatePrompt || !newTemplateName.trim() || sessionTemplateSaved) return;
    const exercises=saveTemplatePrompt.exercises.filter(exercise=>!exercise.skipped).map(exercise=>({exerciseId:exercise.exerciseId,sets:Math.max(1,exercise.sets.length),reps:exercise.repTarget||exercise.sets.find(set=>set.reps)?.reps||"8",group:exercise.group,note:exercise.planNote||exercise.note||""}));
    if (!exercises.length) return;
    const template:Template={id:createRecordId("template"),name:newTemplateName.trim(),focus:"Saved from Add as I go",color:"#409ECE",icon:"◆",warmup:(saveTemplatePrompt.warmup||[]).map(item=>({id:item.id,kind:item.kind,exerciseId:item.exerciseId,title:item.title,instructions:item.instructions})),exercises,supersetNames:saveTemplatePrompt.supersetNames};
    const key=`strength-template:${template.id}`;const queued=queuePendingDiaryChange({key,kind:"save_strength_template",payload:{template}},user?.id);if(!queued.ok){setCloudState("error");setCloudMessage("The template could not be saved on this device. Try again after freeing browser storage.");return}setData(current=>({...current,templates:[...current.templates,template]}));runCloud(service=>service.saveTemplate(template,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});setSessionTemplateSaved(true);
  }
  function updateSet(exerciseIndex: number, setIndex: number, key: keyof SetLog, value: string | boolean) {
    if (!active) return;
    const exercises = active.exercises.map((exercise, ei) => ei !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.map((set, si) => si !== setIndex ? set : { ...set, [key]: value }) });
    setActive({ ...active, exercises });
    if (key==="done"&&value===true&&exercises[exerciseIndex].sets.every(set=>set.done)) setExpandedLiveExercises(current=>{const next=new Set(current);next.delete(exerciseIndex);return next;});
  }
  function updateWarmupItemDone(itemIndex:number,done:boolean){
    if(!active?.warmup)return;
    const warmup=active.warmup.map((item,index)=>index===itemIndex?{...item,done}:item);
    setActive({...active,warmup});
    setWarmupExpanded(!warmup.every(item=>item.done));
  }
  function toggleExerciseSkipped(exerciseIndex:number) {
    if (!active) return;
    const skipped=!active.exercises[exerciseIndex].skipped;
    setActive({...active,exercises:active.exercises.map((exercise,index)=>index===exerciseIndex?{...exercise,skipped}:exercise)});
    setExpandedLiveExercises(current=>{const next=new Set(current);if(skipped)next.delete(exerciseIndex);else next.add(exerciseIndex);return next;});
  }
  function updateWorkoutExercise(exerciseIndex:number, changes:Partial<WorkoutExercise>) {
    if (!active) return;
    setActive({...active,exercises:active.exercises.map((exercise,index)=>index===exerciseIndex?{...exercise,...changes}:exercise)});
  }
  function moveLiveExercise(from: number, to: number) {
    if (!active || to < 0 || to >= active.exercises.length) return;
    const exercises = [...active.exercises];
    const [moved] = exercises.splice(from, 1); exercises.splice(to, 0, moved);
    setActive({ ...active, exercises }); setLiveEditIndex(to);
  }
  function groupLiveExercise(index: number, adjacentIndex: number) {
    if (!active) return;
    const exercises = active.exercises.map(item => ({ ...item }));
    const group = exercises[adjacentIndex].group || `live-superset-${Date.now()}`;
    exercises[index].group = group; exercises[adjacentIndex].group = group;
    setActive({ ...active, exercises });
  }
  function ungroupLiveExercise(index: number) {
    if (!active) return;
    const exercises = active.exercises.map(item => ({ ...item }));
    const oldGroup = exercises[index].group; delete exercises[index].group;
    if (exercises.filter(item => item.group === oldGroup).length < 2) exercises.forEach(item => { if (item.group === oldGroup) delete item.group; });
    setActive({ ...active, exercises });
  }
  function saveTemplate() {
    if (!editor || !editor.name.trim() || editor.exercises.length === 0) return;
    const warmup=(editor.warmup||[]).filter(item=>item.kind==="exercise"?Boolean(item.exerciseId):Boolean(item.title?.trim()||item.instructions.trim())).map(item=>({...item,title:item.kind==="instruction"?item.title?.trim()||"":"",instructions:item.instructions.trim()}));
    const normalized = { ...editor, warmup, color: editor.color?.toUpperCase() === "#7B61FF" ? "#409ECE" : editor.color };
    const key=`strength-template:${normalized.id}`;const queued=queuePendingDiaryChange({key,kind:"save_strength_template",payload:{template:normalized}},user?.id);
    if(!queued.ok){setCloudState("error");setCloudMessage("This template could not be saved on this device. The editor has stayed open.");return}
    setData(current => ({ ...current, templates: current.templates.some(item => item.id === normalized.id) ? current.templates.map(item => item.id === normalized.id ? normalized : item) : [...current.templates, normalized] }));
    runCloud(service=>service.saveTemplate(normalized,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});
    clearStrengthEditorDraft(user?.id);setEditor(null);
  }
  function addWarmupInstruction() {
    if(!editor)return;
    warmupIdRef.current+=1;
    setEditor({...editor,warmup:[...(editor.warmup||[]),{id:`warmup-${editor.id}-${warmupIdRef.current}`,kind:"instruction",instructions:""}]});
  }
  function addWarmupExercise(exerciseId:string) {
    if(!editor)return;
    warmupIdRef.current+=1;
    setEditor({...editor,warmup:[...(editor.warmup||[]),{id:`warmup-${editor.id}-${warmupIdRef.current}`,kind:"exercise",exerciseId,instructions:""}]});
    setWarmupQuery("");setWarmupPickerOpen(false);
  }
  function updateWarmupItem(index:number,key:"title"|"instructions",value:string) {
    if(!editor)return;
    setEditor({...editor,warmup:(editor.warmup||[]).map((item,itemIndex)=>itemIndex===index?{...item,[key]:value}:item)});
  }
  function removeWarmupItem(index:number) {
    if(!editor)return;
    setEditor({...editor,warmup:(editor.warmup||[]).filter((_,itemIndex)=>itemIndex!==index)});
  }
  function moveWarmupItem(index:number,direction:-1|1) {
    if(!editor)return;const to=index+direction;if(to<0||to>=(editor.warmup||[]).length)return;
    const warmup=[...(editor.warmup||[])];const [item]=warmup.splice(index,1);warmup.splice(to,0,item);setEditor({...editor,warmup});
  }
  function toggleSuperset(index: number) {
    if (!editor || index === 0) return;
    const exercises = editor.exercises.map(item => ({ ...item }));
    const supersetNames = { ...editor.supersetNames };
    if (exercises[index].group) {
      const oldGroup = exercises[index].group;
      delete exercises[index].group;
      const remaining = exercises.filter(item => item.group === oldGroup);
      if (remaining.length < 2) {
        exercises.forEach(item => { if (item.group === oldGroup) delete item.group; });
        delete supersetNames[oldGroup];
      }
    } else {
      const group = exercises[index - 1].group || `superset-${Date.now()}`;
      exercises[index - 1].group = group; exercises[index].group = group;
    }
    setEditor({ ...editor, exercises, supersetNames });
  }
  function removeTemplateExercise(index:number) {
    if (!editor) return;
    const removedGroup=editor.exercises[index]?.group;
    const exercises=editor.exercises.filter((_,exerciseIndex)=>exerciseIndex!==index).map(item=>({...item}));
    const supersetNames={...editor.supersetNames};
    if(removedGroup&&exercises.filter(item=>item.group===removedGroup).length<2){exercises.forEach(item=>{if(item.group===removedGroup)delete item.group;});delete supersetNames[removedGroup];}
    setEditor({...editor,exercises,supersetNames});
  }
  function reorderTemplateExercise(from:number,to:number) {
    setEditor(current=>{
      if(!current||from===to||from<0||to<0||from>=current.exercises.length||to>=current.exercises.length)return current;
      const exercises=[...current.exercises];const [moved]=exercises.splice(from,1);exercises.splice(to,0,moved);
      return {...current,exercises};
    });
  }
  function beginTemplateReorder(index:number,event:ReactPointerEvent<HTMLButtonElement>){
    if(event.pointerType==="mouse"&&event.button!==0)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);draggedExerciseRef.current=index;setDraggedExerciseIndex(index);
  }
  function moveTemplateReorder(event:ReactPointerEvent<HTMLButtonElement>){
    const from=draggedExerciseRef.current;if(from===null)return;
    event.preventDefault();const screen=document.querySelector<HTMLElement>(".editor-screen");if(screen){const edge=90;if(event.clientY<edge)screen.scrollBy({top:-14});else if(event.clientY>window.innerHeight-edge)screen.scrollBy({top:14})}
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-editor-index]");
    if(!target)return;const to=Number(target.dataset.editorIndex);if(!Number.isInteger(to)||to===from)return;
    reorderTemplateExercise(from,to);draggedExerciseRef.current=to;setDraggedExerciseIndex(to);
  }
  function endTemplateReorder(event:ReactPointerEvent<HTMLButtonElement>){
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    draggedExerciseRef.current=null;setDraggedExerciseIndex(null);
  }
  function openSchedule(templateId: string) {
    setScheduleTemplateId(templateId);
    setScheduleDate(today);
    setScheduleRepeat("once");
    setScheduleWeeks(4);
  }
  async function scheduleWorkout() {
    if (!scheduleTemplateId) return;
    const intervalDays=scheduleRepeat==="weekly"?7:scheduleRepeat==="fortnightly"?14:0;
    const count=intervalDays?Math.max(1,Math.ceil((scheduleWeeks*7)/intervalDays)):1;
    const dates=recurrenceDateKeys(scheduleDate,intervalDays,count);
    const additions=dates.filter(date=>!data.scheduled.some(item=>item.date===date&&item.templateId===scheduleTemplateId)).map(date=>({date,templateId:scheduleTemplateId}));
    const scheduled=[...data.scheduled,...additions];if(!await persistSchedule(scheduled))return;
    if(data.scheduled.length===0&&!enduranceSessions.some(session=>session.status==="planned")&&user?.id)trackMilestoneOnce(user.id,"first_session_planned",{modality:"strength",source:"schedule"});
    setData(current=>({...current,scheduled}));
    setSelectedDate(scheduleDate);
    setScheduleTemplateId(null);
  }
  async function togglePlannedWorkoutSkipped(date:string,templateId:string){
    const scheduled=data.scheduled.map(item=>item.date===date&&item.templateId===templateId?{...item,skipped:!item.skipped}:item);
    if(await persistSchedule(scheduled))setData(current=>({...current,scheduled}));
  }
  async function swapPlannedWorkout(nextTemplateId:string){
    if(!swapPlanned)return;
    const {date,templateId}=swapPlanned;
    const withoutCurrent=data.scheduled.filter(item=>!(item.date===date&&item.templateId===templateId));
    const scheduled=withoutCurrent.some(item=>item.date===date&&item.templateId===nextTemplateId)?withoutCurrent:[...withoutCurrent,{date,templateId:nextTemplateId}];
    if(!await persistSchedule(scheduled))return;
    setData(current=>({...current,scheduled}));
    setExpandedPlanned(current=>{const next=new Set(current);next.delete(templateId);next.add(nextTemplateId);return next});
    setSwapPlanned(null);
  }
  function scheduleEnduranceWorkout(){
    if(!scheduleEnduranceTemplateId)return;const template=enduranceTemplates.find(item=>item.id===scheduleEnduranceTemplateId);if(!template)return;
    const intervalDays=scheduleRepeat==="weekly"?7:scheduleRepeat==="fortnightly"?14:0;const count=intervalDays?Math.max(1,Math.ceil((scheduleWeeks*7)/intervalDays)):1;
    const dates=recurrenceDateKeys(scheduleDate,intervalDays,count);
    const additions=dates.filter(date=>!enduranceSessions.some(session=>session.status==="planned"&&session.templateId===template.id&&session.date===date)).map((date):EnduranceSession=>({id:createWorkoutId("endurance"),templateId:template.id,activityType:template.activityType,status:"planned",title:template.title,date,plannedDurationMinutes:template.plannedDurationMinutes,plannedDistanceKm:template.plannedDistanceKm,targetRpe:template.targetRpe,environment:template.environment,category:template.category,notes:template.notes,blocks:structuredClone(template.blocks),source:"template"}));
    const accepted=additions.filter(session=>{const key=`endurance-session:${session.id}`;const queued=queuePendingDiaryChange({key,kind:"save_endurance_session",payload:{session}},user?.id);if(!queued.ok){setCloudState("error");setCloudMessage("One or more planned sessions could not be saved on this device.");return false}runTrainingCloud(service=>service.save(session,queued))?.then(version=>{if(version!=null)removePendingDiaryChange(key,queued.operationId,user?.id,version)});return true});
    if(accepted.length&&data.scheduled.length===0&&!enduranceSessions.some(session=>session.status==="planned")&&user?.id)trackMilestoneOnce(user.id,"first_session_planned",{modality:"endurance",source:"schedule"});
    if(accepted.length)setEnduranceSessions(current=>[...accepted,...current].sort((a,b)=>b.date.localeCompare(a.date)));if(accepted.length===additions.length){setSelectedDate(scheduleDate);setScheduleEnduranceTemplateId(null)}
  }
  function openFeedback(){
    setFeedbackCategory("general");setFeedbackMessage("");setFeedbackError("");setFeedbackSent(false);setFeedbackOpen(true);
  }
  async function submitFeedback(event:React.FormEvent){
    event.preventDefault();if(!feedbackService||feedbackBusy)return;
    setFeedbackBusy(true);setFeedbackError("");
    try{await feedbackService.submit(feedbackCategory,feedbackMessage);setFeedbackSent(true);setFeedbackMessage("")}
    catch(error){setFeedbackError(error instanceof Error?error.message:"We couldn’t send your feedback. Please try again.")}
    finally{setFeedbackBusy(false)}
  }
  return (
    <main className="app-shell" data-light-accent={contrastColour(appColour)==="#0F172A"} data-theme={resolvedAppearance} style={createSetraTheme(appColour,resolvedAppearance,textScale)}>
      <header className="topbar">
        <button className="brand" onClick={() => navigateTab("today")} aria-label="Go to today"><span className="brand-mark">S</span><span>setra</span></button>
        <Link className="avatar" href="/profile" aria-label="Open profile">{profileInitials(user?.user_metadata?.display_name,user?.email)}</Link>
      </header>

      <section className={`content content-${tab}`}>
        {tab === "today" && <>
          {configured&&cloudState==="error"&&(syncIssues.length?<button className="cloud-sync-chip" title={cloudMessage} onClick={()=>setSyncRecoveryOpen(true)}><i/>Sync needs attention <span>Review</span></button>:<Link className="cloud-sync-chip" title={cloudMessage} href="/profile"><i/>Sync delayed <span>Details</span></Link>)}
          {configured&&(cloudState==="pending"||cloudState==="loading")&&<div className="cloud-sync-chip" role="status"><i/>{cloudState==="loading"?"Syncing changes…":"Changes waiting to sync"}</div>}
          {recoveryBackups.length>0&&cloudState!=="error"&&<button className="cloud-sync-chip" onClick={()=>setSyncRecoveryOpen(true)}><i/>Recovery backups <span>Review</span></button>}
          {configured&&showImport&&<div className="cloud-notice"><b>Bring your existing diary into your account</b><p>Your templates, schedule and real workout history can be copied safely. Demo workout history is excluded, and the browser copy stays here.</p><button disabled={importBusy} onClick={importBrowserDiary}>{importBusy?"Importing…":"Import browser diary"}</button></div>}
          {betaFeedbackEnabled&&<aside className="beta-feedback-card"><span>BETA</span><div><b>Help shape Setra</b><small>Found something or have an idea?</small></div><button onClick={openFeedback}>Share feedback</button></aside>}
          <div className="eyebrow">{formatDate(selectedDate).toUpperCase()}</div>
          <div className="page-heading today-heading"><div><h1>{motivation}</h1><p>{todayMessage}</p></div><div className="week-score"><strong>{weeklyPreviewItems.filter(item=>item.status==="completed"||item.status==="partial").length}</strong><span>recorded this week</span></div></div>
          <div className={`calendar-controls ${selectedDate!==today?"has-today-action":""}`}><button aria-label="Previous week" onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()-7);setSelectedDate(localDateKey(date))}}>‹</button><button className="calendar-label" onClick={()=>setCalendarOpen(!calendarOpen)}>{new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric"}).format(new Date(`${selectedDate}T12:00:00`))} <span>{calendarOpen?"⌃":"⌄"}</span></button>{selectedDate!==today&&<button className="calendar-today-button" onClick={()=>{setSelectedDate(today);setCalendarOpen(false)}}>Today</button>}<button aria-label="Next week" onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+7);setSelectedDate(localDateKey(date))}}>›</button></div>
          {!calendarOpen?<div className="week-strip" aria-label="Selected training week">{weekDays.map(date => {const d=new Date(`${date}T12:00:00`);const counts=calendarCounts(date);return <button onClick={()=>setSelectedDate(date)} aria-label={calendarDateLabel(date,counts,date===selectedDate)} aria-pressed={date===selectedDate} className={`day ${date===selectedDate?"active-day":""}`} key={date}><span aria-hidden="true">{["S","M","T","W","T","F","S"][d.getDay()]}</span><b aria-hidden="true">{d.getDate()}</b><span className="day-dots" aria-hidden="true">{Array.from({length:counts.planned},(_,index)=><i className="planned-dot" key={`p-${index}`}/>)}{Array.from({length:counts.completed},(_,index)=><i className="completed-dot" key={`c-${index}`}/>)}{Array.from({length:counts.partial},(_,index)=><i className="partial-dot" key={`a-${index}`}/>)}{Array.from({length:counts.skipped},(_,index)=><i className="skipped-dot" key={`s-${index}`}/>)}</span></button>})}</div>:<div className="month-calendar"><div className="month-weekdays" aria-hidden="true">{monthWeekdayInitials.map((day,i)=><span key={`${day}-${i}`}>{day}</span>)}</div><div className="month-grid">{monthDays.map(date=>{const d=new Date(`${date}T12:00:00`);const inMonth=d.getMonth()===new Date(`${selectedDate}T12:00:00`).getMonth();const counts=calendarCounts(date);return <button key={date} aria-label={calendarDateLabel(date,counts,date===selectedDate)} aria-pressed={date===selectedDate} className={`${date===selectedDate?"selected-date":""} ${!inMonth?"outside-month":""}`} onClick={()=>{setSelectedDate(date);setCalendarOpen(false)}}><span aria-hidden="true">{d.getDate()}</span><span className="month-dots" aria-hidden="true">{Array.from({length:counts.planned},(_,index)=><i className="planned-dot" key={`p-${index}`}/>)}{Array.from({length:counts.completed},(_,index)=><i className="completed-dot" key={`c-${index}`}/>)}{Array.from({length:counts.partial},(_,index)=><i className="partial-dot" key={`a-${index}`}/>)}{Array.from({length:counts.skipped},(_,index)=><i className="skipped-dot" key={`s-${index}`}/>)}</span></button>})}</div></div>}
          <button className="weekly-preview-trigger" onClick={openWeeklyPreview}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2m3 0h2m3 0h1M7 17h2m3 0h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>Weekly Preview</button>
          <HomeStreak accent={appColour} suppressNotice={workoutInProgress||prominentLayerOpen}/>
          <section className="weekly-actual-summary" aria-label={`Recorded training for ${compactDateRange(displayedWeekDates)}`}><div><span>{displayedWeekDates.includes(today)?"THIS WEEK SO FAR":"RECORDED"} · {compactDateRange(displayedWeekDates)}</span><b>{weeklyActuals.displayed.total} {weeklyActuals.displayed.total===1?"session":"sessions"}</b><small>{weeklyActuals.displayed.strength} strength · {weeklyActuals.displayed.endurance} endurance{weeklyActuals.displayed.minutes>0?` · ${Math.round(weeklyActuals.displayed.minutes)} min`:" · time not recorded"}</small></div><p><span>PREVIOUS FULL WEEK</span><b>{weeklyActuals.previous.total}</b><small>{weeklyActuals.previous.total===1?"recorded session":"recorded sessions"}</small></p></section>

          {showEndurance&&<section className={`training-quick-actions preference-${trainingPreference}`}><span>QUICK ACTIONS</span><div><button className="quick-action-button" onClick={()=>isHybrid?setTrainingAction("plan"):setTab("plan")}><NavIcon name="plan"/><span className="quick-action-copy"><b>Plan session</b><small>Choose or build a reusable workout</small></span><em aria-hidden="true">›</em></button><button className="quick-action-button" onClick={()=>isHybrid?setTrainingAction("log"):setEnduranceEditor({mode:"log"})}><NavIcon name="today"/><span className="quick-action-copy"><b>Log activity</b><small>{selectedDate===today?"Record today’s training":`Record training for ${formatDate(selectedDate)}`}</small></span><em aria-hidden="true">›</em></button></div></section>}

          {showStrength&&savedDraft?.date===selectedDate&&<article className="resume-card"><div><span>WORKOUT IN PROGRESS</span><h2>{savedDraft.name}</h2><p>{savedDraft.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0)} of {savedDraft.exercises.reduce((sum,e)=>sum+e.sets.length,0)} sets complete</p></div><button onClick={()=>{const restoredDraft=restoreMissingTemplateExercises(savedDraft,data.templates.find(template=>template.id===savedDraft.templateId));setExpandedLiveExercises(new Set());setWarmupExpanded(!(restoredDraft.warmup?.length&&restoredDraft.warmup.every(item=>item.done)));setActive(restoredDraft);setSavedDraft(null)}}>Resume →</button></article>}

          {showEndurance&&plannedEndurance.map(session=><article className="endurance-planned-card compact-planned-endurance" key={session.id}><button className="endurance-card-open" onClick={()=>setEnduranceDetailId(session.id)} aria-label={`View ${session.title}`}/><header><ActivityIcon type={session.activityType}/><div><small>PLANNED {activityLabel(session.activityType).toUpperCase()}</small><h2>{session.title}</h2><p>{enduranceSummary(session)}</p></div><span aria-hidden="true">›</span></header>{session.blocks.length>0&&<div className="endurance-block-preview"><EnduranceStructureView session={session}/></div>}</article>)}

          {showStrength&&(scheduledTemplates.length>0?scheduledTemplates.map(template=>{const expanded=expandedPlanned.has(template.id);const scheduledItem=data.scheduled.find(item=>item.date===selectedDate&&item.templateId===template.id);const skipped=Boolean(scheduledItem?.skipped);return <article className={`hero-card planned-card ${expanded?"expanded":""} ${skipped?"planned-card-skipped":""}`} key={template.id}>
            <button className="planned-expand" onClick={()=>setExpandedPlanned(current=>{const next=new Set(current);if(next.has(template.id))next.delete(template.id);else next.add(template.id);return next})} aria-label={expanded?"Hide workout exercises":"Show workout exercises"}>{expanded?"⌃":"⌄"}</button>
            <h2>{template.name}</h2><p>{template.focus}</p>{skipped&&<span className="planned-skipped-label">SKIPPED THIS WEEK</span>}
            {expanded&&<div className="exercise-preview">{Boolean(template.warmup?.length)&&<div className="planned-warmup-summary"><b>Warm-up</b><em>{template.warmup!.length} {template.warmup!.length===1?"item":"items"}</em></div>}{template.exercises.map((item) => {const groups=[...new Set(template.exercises.map(exercise=>exercise.group).filter(Boolean))];const groupIndex=groups.indexOf(item.group);const defaultName=`Superset ${String.fromCharCode(65+groupIndex)}`;return <div className={item.group?`preview-superset superset-color-${groupIndex%4}`:""} key={item.exerciseId}><b>{exerciseName(item.exerciseId)}</b><em>{item.sets} × {item.reps}</em>{item.group&&<small>{(template.supersetNames?.[item.group]||defaultName).toUpperCase()}</small>}</div>})}</div>}
            {!skipped&&(selectedDate===today?<button className="primary-button" disabled={workoutInProgress} onClick={() => startWorkout(template,selectedDate)}>{workoutInProgress?"Workout in progress":"Start workout"} <span>{workoutInProgress?"":"→"}</span></button>:<button className="primary-button" onClick={()=>setEditor(structuredClone(template))}>Edit workout <span>→</span></button>)}
            {expanded&&<div className="planned-session-actions"><button onClick={()=>setSwapPlanned({date:selectedDate,templateId:template.id})}>Swap workout</button><button onClick={()=>togglePlannedWorkoutSkipped(selectedDate,template.id)}>{skipped?"Unskip session":"Skip this week"}</button></div>}
          </article>}):!isHybrid?<article className="empty-card"><span className="empty-icon">＋</span><h2>No workout planned</h2><p>{selectedDate!==today?"Plan or edit workouts for this day.":workoutInProgress?"Finish your live workout before starting another.":"Choose a template and get moving."}</p><button className="secondary-button" disabled={selectedDate===today&&workoutInProgress} onClick={() => selectedDate===today?setPicker(true):setTab("plan")}>{selectedDate!==today?"View workout plans":workoutInProgress?"Workout in progress":"Choose workout"}</button></article>:null)}

          {((showStrength&&completedWorkouts.length>0)||(showEndurance&&completedEndurance.length>0))&&<section className="completed-today"><span className="completed-heading">{selectedDate===today?"COMPLETED TODAY":"COMPLETED"}</span>{showEndurance&&completedEndurance.map(session=><button key={session.id} className="completed-card endurance-diary-card" onClick={()=>setEnduranceDetailId(session.id)}><ActivityIcon type={session.activityType}/><span><b>{session.title}</b><small>{enduranceSummary(session)}</small></span><em>View ›</em></button>)}{showStrength&&completedWorkouts.map(workout=>{const completion=strengthCompletion(workout);const exercises=completedExercises(workout);return <button key={workout.id} className="completed-card" onClick={()=>setDetailId(workout.id)}><span className="completed-check">{completion.status==="partial"?"◐":"✓"}</span><span><b>{workout.name}</b><small>{completion.status==="partial"?"Partial · ":""}{exercises.length} {exercises.length===1?"exercise":"exercises"} · {completion.completedSets} {completion.completedSets===1?"set":"sets"} completed</small></span><em>View ›</em></button>})}</section>}

          <div className="section-title"><div><span>RECENT SESSIONS</span><h2>Recent work</h2></div><button onClick={() => setTab("history")}>See all</button></div>
          <div className="recent-training-list">{recentHistory.map(item=>item.kind==="strength"?<button className="recent-card" key={`recent-strength-${item.id}`} onClick={()=>setDetailId(item.id)}><span className="recent-date"><b>{new Date(`${item.date}T12:00:00`).getDate()}</b>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${item.date}T12:00:00`))}</span><span className="recent-main"><b>{item.title}</b><small>{isHybrid?"Strength · ":""}{strengthCompletion(item.workout).status==="partial"?"Partial · ":""}{completedExercises(item.workout).length} {completedExercises(item.workout).length===1?"exercise":"exercises"}</small></span><span className="chevron">›</span></button>:<button className="recent-card" key={`recent-endurance-${item.id}`} onClick={()=>setEnduranceDetailId(item.id)}><ActivityIcon type={item.session.activityType}/><span className="recent-main"><b>{item.title}</b><small>{formatDate(item.date)}{enduranceSummary(item.session)!==activityLabel(item.session.activityType)?` · ${enduranceSummary(item.session)}`:""}</small></span><span className="chevron">›</span></button>)}</div>
        </>}

        {tab === "plan" && <>
          <div className="eyebrow">YOUR PROGRAM</div><div className="page-heading"><div><h1>{trainingPreference==="strength"?"Workout templates":trainingPreference==="endurance"?"Endurance templates":"Plan your training"}</h1><p>{trainingPreference==="strength"?"Build once. Train without thinking.":trainingPreference==="endurance"?"Build once. Schedule when ready.":"Strength and endurance, in one diary."}</p></div>{trainingPreference==="strength"&&<button className="round-add" aria-label="Create strength template" onClick={() => setEditor({id:createRecordId("template"),name:"",focus:"",color:"#409ECE",icon:"◆",exercises:[]})}>＋</button>}</div>
          {showEndurance&&<div className={`plan-type-actions preference-${trainingPreference}`}><button onClick={()=>setEnduranceEditor({mode:"template"})}><b>New endurance template</b><small>Build once, then add or schedule it</small></button>{isHybrid&&<button onClick={() => setEditor({id:createRecordId("template"),name:"",focus:"",color:"#409ECE",icon:"◆",exercises:[]})}><b>New strength template</b><small>Exercises, sets and supersets</small></button>}</div>}
          <Link className="import-session-link" href="/import"><span aria-hidden="true">↧</span><span><b>Import session</b><small>Turn pasted text or a workout file into a template</small></span><em>›</em></Link>
          {showEndurance&&<><div className="section-title plan-section-title"><div><span>ENDURANCE</span><h2>Workout templates</h2></div></div><div className="template-grid endurance-template-grid">{enduranceTemplates.length?enduranceTemplates.map(template=><article className="template-card endurance-template-card" key={template.id}><ActivityIcon type={template.activityType}/><div className="template-copy"><h2>{template.title}</h2><span className="template-focus">{activityLabel(template.activityType)}</span><p>{[template.plannedDurationMinutes?formatMinutes(template.plannedDurationMinutes):"",template.plannedDistanceKm?`${Number(template.plannedDistanceKm.toFixed(2))} km`:"",template.blocks.length?`${template.blocks.length} steps`:""].filter(Boolean).join(" · ")||"Simple session"}</p></div><div className="template-actions"><button onClick={()=>{setScheduleEnduranceTemplateId(template.id);setScheduleDate(today);setScheduleRepeat("once");setScheduleWeeks(4)}}>Schedule</button><button onClick={()=>setEnduranceEditor({mode:"template",initial:structuredClone(template)})}>Edit</button><button className="template-delete-action" onClick={()=>setDeleteEnduranceTemplateId(template.id)}>Delete</button></div></article>):<p className="empty-template-copy">Create an endurance template, then add it to any day or repeat it across your plan.</p>}</div></>}
          {showEndurance&&outstandingEndurancePlans.length>0&&<><div className="section-title plan-section-title"><div><span>ENDURANCE OCCURRENCES</span><h2>Planned sessions</h2></div></div><div className="endurance-plan-list">{outstandingEndurancePlans.map(session=><button className={session.date<today?"overdue":""} key={session.id} onClick={()=>setEnduranceDetailId(session.id)}><ActivityIcon type={session.activityType}/><span><b>{session.title}</b><small>{session.date<today?"OVERDUE · ":""}{formatDate(session.date)} · {enduranceSummary(session)}</small></span><em>›</em></button>)}</div></>}
          {isHybrid&&<div className="section-title plan-section-title"><div><span>STRENGTH</span><h2>Workout templates</h2></div></div>}
          {showStrength&&<div className="template-grid">{data.templates.map(template => <article className="template-card" key={template.id}>
            <div className="template-copy"><h2>{template.name}</h2>{template.focus&&<span className="template-focus">{template.focus}</span>}<p>{template.exercises.length} {template.exercises.length===1?"exercise":"exercises"} · {template.exercises.reduce((sum,item)=>sum+item.sets,0)} {template.exercises.reduce((sum,item)=>sum+item.sets,0)===1?"set":"sets"}</p></div>
            <div className="template-actions"><button disabled={workoutInProgress} onClick={() => startWorkout(template,today)}>{workoutInProgress?"Workout live":"Start today"}</button><button onClick={() => setEditor(structuredClone(template))}>Edit</button><button onClick={() => openSchedule(template.id)}>Schedule</button></div>
          </article>)}</div>}
        </>}

        {tab === "history" && <>
          <div className="eyebrow">TRAINING LOG</div><div className="page-heading"><div><h1>Your history</h1><p>Small steps, adding up.</p></div></div>
          {isHybrid&&<div className="history-scope">{([['all','All training'],['strength','Strength'],['endurance','Endurance']] as const).map(([value,label])=><button key={value} className={historyScope===value?"active":""} onClick={()=>setHistoryScope(value)}>{label}</button>)}</div>}
          <div className="history-tabs"><button className={effectiveHistoryMode==="sessions"?"active":""} onClick={()=>setHistoryMode("sessions")}>Sessions</button>{showStrength&&<button disabled={isHybrid&&historyScope==="endurance"} className={effectiveHistoryMode==="exercises"?"active":""} onClick={()=>setHistoryMode("exercises")}>Exercises</button>}<button className={effectiveHistoryMode==="progress"?"active":""} onClick={()=>setHistoryMode("progress")}>Progress</button></div>
          {(showEndurance||isHybrid)&&<p className="history-period">CURRENT TRAINING WEEK · {compactDateRange(currentWeekDates)}</p>}
          {showEndurance&&(!isHybrid||historyScope==="endurance")&&<section className="endurance-week-stats"><div><strong>{enduranceThisWeek.distanceCoverage?Number(enduranceThisWeek.distance.toFixed(1)):"—"}</strong><span>{enduranceThisWeek.distanceCoverage?"KM RECORDED":"DISTANCE UNKNOWN"}</span></div><div><strong>{enduranceThisWeek.durationCoverage?Math.round(enduranceThisWeek.minutes):"—"}</strong><span>{enduranceThisWeek.durationCoverage?"MINUTES RECORDED":"DURATION UNKNOWN"}</span></div><div><strong>{enduranceThisWeek.sessions}</strong><span>SESSIONS RECORDED</span></div></section>}
          {isHybrid&&historyScope==="all"&&<section className="endurance-week-stats"><div><strong>{strengthThisWeek.sessions+enduranceThisWeek.sessions}</strong><span>ALL SESSIONS</span></div><div><strong>{strengthThisWeek.durationCoverage+enduranceThisWeek.durationCoverage?Math.round(strengthThisWeek.minutes+enduranceThisWeek.minutes):"—"}</strong><span>{strengthThisWeek.durationCoverage+enduranceThisWeek.durationCoverage?"TRAINING MIN":"DURATION UNKNOWN"}</span></div><div><strong>{enduranceThisWeek.distanceCoverage?Number(enduranceThisWeek.distance.toFixed(1)):"—"}</strong><span>{enduranceThisWeek.distanceCoverage?"ENDURANCE KM":"DISTANCE UNKNOWN"}</span></div></section>}
          {effectiveHistoryMode==="progress"?<ProgressOverview weeks={progressWeeks} showStrength={progressShowStrength} showEndurance={progressShowEndurance} strengthTrends={strengthTrends} enduranceTrends={enduranceTrends} preferredUnit={preferredUnit} onExercise={setExerciseHistoryId}/>:effectiveHistoryMode==="sessions"?<>{showEndurance&&(!isHybrid||historyScope!=="strength")&&<label className="history-activity-filter">ACTIVITY<select value={activityFilter} onChange={event=>setActivityFilter(event.target.value)}><option value="all">All activity types</option>{Array.from(new Set(enduranceSessions.map(session=>session.activityType))).map(type=><option key={type} value={type}>{activityLabel(type)}</option>)}</select></label>}{filteredSessionHistory.length?<div className="history-list">{filteredSessionHistory.map(item=>item.kind==="strength"?<button key={`strength-${item.id}`} className="history-row" onClick={() => setDetailId(item.id)}><span className="history-date"><b>{new Date(`${item.date}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${item.date}T12:00:00`))}</small></span><span className="history-info"><small>{isHybrid?"STRENGTH":formatDate(item.date).split(",")[0].toUpperCase()}</small><b>{item.title}</b><em>{strengthCompletion(item.workout).status==="partial"?"Partial · ":""}{completedExercises(item.workout).length} {completedExercises(item.workout).length===1?"exercise":"exercises"}</em></span><span className="chevron">›</span></button>:<button key={`endurance-${item.id}`} className="history-row endurance-history-row" onClick={()=>setEnduranceDetailId(item.id)}><span className="history-date"><b>{new Date(`${item.date}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${item.date}T12:00:00`))}</small></span><span className="history-info"><small>{activityLabel(item.session.activityType).toUpperCase()}</small><b>{item.title}</b><em>{enduranceSummary(item.session)}</em></span><span className="chevron">›</span></button>)}</div>:<div className="filtered-empty"><b>No matching activities</b><p>Try another training type or show all activity types.</p><button onClick={()=>{setHistoryScope("all");setActivityFilter("all")}}>Clear filters</button></div>}</>:<><label className="search"><span>⌕</span><input value={libraryQuery} onChange={event=>setLibraryQuery(event.target.value)} placeholder="Search exercise history" /></label>{filteredExerciseHistory.length?<div className="library-list">{filteredExerciseHistory.map(exercise=>{const sessions=data.workouts.filter(workout=>workout.exercises.some(item=>item.exerciseId===exercise.id&&completedSets(item).length>0));return <button className="library-row" key={exercise.id} onClick={()=>setExerciseHistoryId(exercise.id)}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>{sessions.length} {sessions.length===1?"session":"sessions"}</em><span className="chevron">›</span></button>})}</div>:<div className="filtered-empty"><b>No matching exercise history</b><p>Try another exercise name.</p><button onClick={()=>setLibraryQuery("")}>Clear search</button></div>}</>}
        </>}

        {showStrength&&tab === "pbs" && <>
          <div className="eyebrow">PERSONAL BESTS</div><div className="page-heading"><div><h1>Your PBs</h1><p>Your strongest recorded sets, all in one place.</p></div><div className="pb-count"><strong>{personalBests.length}</strong><span>records</span></div></div>
          {personalBests.length?<div className="pb-list">{personalBests.map(({exercise,best},index)=><button key={exercise.id} onClick={()=>setExerciseHistoryId(exercise.id)}><span className={`pb-medal pb-${index%3}`}>{index+1}</span><span className="pb-info"><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><span className="pb-result"><b>{formatLoad(best.set.weight,preferredUnit)}</b><small>Highest load · {best.set.reps} reps · {formatDate(best.workout.date)}</small></span><span className="chevron">›</span></button>)}</div>:<div className="filtered-empty"><b>No strength PBs yet</b><p>Complete a weighted set to establish your first highest-load record.</p><button onClick={()=>navigateTab("today")}>Go to Today</button></div>}
        </>}

        {showStrength&&tab === "library" && <>
          <div className="eyebrow">MOVEMENT LIBRARY</div><div className="page-heading"><div><h1>Exercises</h1><p>Your complete movement index.</p></div><button className="round-add" onClick={() => { const name=prompt("Exercise name"); if(name) setData(c=>({...c,exercises:[...c.exercises,{id:createRecordId("exercise"),name,group:"Other",equipment:"Other"}]})); }}>＋</button></div>
          <label className="search"><span>⌕</span><input value={libraryQuery} onChange={event=>setLibraryQuery(event.target.value)} placeholder="Search exercises" /></label>
          <div className="library-list">{data.exercises.filter(exercise => exercise.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(exercise => {
            const sessions = data.workouts.filter(workout => workout.exercises.some(item => item.exerciseId === exercise.id&&completedSets(item).length>0));
            return <button key={exercise.id} className="library-row" onClick={() => setExerciseHistoryId(exercise.id)}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.group} · {exercise.equipment}</small></span><em>{sessions.length ? `${sessions.length} sessions` : "No history"}</em><span className="chevron">›</span></button>
          })}</div>
        </>}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation" style={{gridTemplateColumns:`repeat(${showStrength?4:3},1fr)`}}>{([
        ["today","Today"],["plan","Plan"],["history","History"],...(showStrength?[["pbs","PBs"]] as [Tab,string][]:[])
      ] as [Tab,string][]).map(([id,label]) => <button key={id} className={tab===id?"selected":""} onClick={()=>navigateTab(id)}><NavIcon name={id as NavIconName}/><small>{label}</small></button>)}</nav>

      {picker && <div className="overlay" onMouseDown={()=>setPicker(false)}><section className="sheet picker-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>LOG FOR {formatDate(selectedDate).toUpperCase()}</span><h2>What are we training?</h2></div><button onClick={()=>setPicker(false)} aria-label="Close workout picker">×</button></div><p className="picker-date-note">This workout will be saved to {formatDate(selectedDate)}.</p><button className="picker-row blank-workout-row" disabled={workoutInProgress} onClick={startBlankWorkout}><span className="blank-workout-icon">＋</span><span><b>Add as I go</b><small>{workoutInProgress?"Finish your live workout first":"Start blank and add exercises during your session"}</small></span><em>{workoutInProgress?"Unavailable":"Start →"}</em></button>{data.templates.map(template=><button className="picker-row" disabled={workoutInProgress} key={template.id} onClick={()=>startWorkout(template,selectedDate)}><span><b>{template.name}</b><small>{template.focus} · {template.exercises.length} exercises</small></span><em>{workoutInProgress?"Unavailable":"Start →"}</em></button>)}</section></div>}

      {swapPlanned&&<div className="overlay high-overlay" onMouseDown={()=>setSwapPlanned(null)}><section className="sheet planned-swap-sheet" onMouseDown={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>PLANNED SESSION</span><h2>Swap workout</h2><p>{formatDate(swapPlanned.date)}</p></div><button onClick={()=>setSwapPlanned(null)} aria-label="Close">×</button></div><div className="planned-swap-list">{data.templates.filter(template=>template.id!==swapPlanned.templateId).map(template=><button className="picker-row" key={template.id} onClick={()=>swapPlannedWorkout(template.id)}><span><b>{template.name}</b><small>{template.focus||"Strength"} · {template.exercises.length} exercises</small></span><em>Choose</em></button>)}</div>{data.templates.length<2&&<p className="planned-swap-empty">Create another strength template before swapping this session.</p>}</section></div>}

      {(scheduleTemplateId||scheduleEnduranceTemplateId) && <div className="overlay high-overlay" onMouseDown={()=>{setScheduleTemplateId(null);setScheduleEnduranceTemplateId(null)}}>
        <section className="sheet schedule-sheet" onMouseDown={event=>event.stopPropagation()}>
          <div className="sheet-handle"/>
          <div className="sheet-title"><div><span>SCHEDULE WORKOUT</span><h2>{scheduleTemplateId?data.templates.find(template=>template.id===scheduleTemplateId)?.name:enduranceTemplates.find(template=>template.id===scheduleEnduranceTemplateId)?.title}</h2></div><button onClick={()=>{setScheduleTemplateId(null);setScheduleEnduranceTemplateId(null)}} aria-label="Close">×</button></div>
          <label className="schedule-field">START DATE
            <span className="schedule-date-control">
              <span>{new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${scheduleDate}T12:00:00`))}</span>
              <b aria-hidden="true">⌄</b>
              <input aria-label="Start date" type="date" value={scheduleDate} min={today} onChange={event=>setScheduleDate(event.target.value)}/>
            </span>
          </label>
          <fieldset className="repeat-options"><legend>REPEAT</legend>{([['once','Once'],['weekly','Weekly'],['fortnightly','Fortnightly']] as const).map(([value,label])=><button type="button" key={value} className={scheduleRepeat===value?'selected':''} onClick={()=>setScheduleRepeat(value)}>{label}</button>)}</fieldset>
          {scheduleRepeat!=="once"&&<label className="schedule-field">SCHEDULE FOR<select value={scheduleWeeks} onChange={event=>setScheduleWeeks(Number(event.target.value))}>{[2,4,6,8,12,16,24,52].map(weeks=><option value={weeks} key={weeks}>{weeks} weeks</option>)}</select></label>}
          <p className="schedule-summary">{scheduleRepeat==="once"?`Scheduled once on ${formatDate(scheduleDate)}.`:`Schedules ${scheduleRepeat} from ${formatDate(scheduleDate)} for ${scheduleWeeks} weeks.`}</p>
          <button className="primary-button schedule-confirm" onClick={scheduleEnduranceTemplateId?scheduleEnduranceWorkout:scheduleWorkout}>Add to plan <span>→</span></button>
        </section>
      </div>}

      {active && <div className="workout-screen">
        <header className="workout-header live-header"><button className="view-app-button" onClick={editingWorkoutId?closeCompletedWorkoutEditor:saveDraft} aria-label={editingWorkoutId?"Close workout editor":"Save workout and view other workouts"}>‹</button><div><small>{editingWorkoutId?"EDIT WORKOUT":"LIVE WORKOUT"}</small><b>{active.name}</b></div><button className="save-draft-button" onClick={editingWorkoutId?()=>saveWorkout():saveDraft}>Save</button><button className="finish-button" onClick={editingWorkoutId?()=>saveWorkout():openFinishDialog}>{editingWorkoutId?"Update":"Finish"}</button></header>
        {(()=>{const included=active.exercises.filter(exercise=>!exercise.skipped);const completed=included.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0);const total=included.reduce((sum,exercise)=>sum+exercise.sets.length,0);const saveLabel=draftSaveState==="saving"?"Saving…":draftSaveState==="saved"?"Saved":draftSaveState==="device"?"Saved on this device":draftSaveState==="pending"?"Saved on this device · sync pending":draftSaveState==="error"?"Draft save needs attention":"Auto-save on";return <div className="live-progress"><span>{completed} / {total} sets</span><small className={`live-save-status state-${draftSaveState}`} role="status">{saveLabel}</small><div><i style={{width:`${total?100*completed/total:0}%`}} /></div></div>})()}
        <div className="workout-body">{Boolean(active.warmup?.length)&&<section className={`live-warmup ${active.warmup!.every(item=>item.done)?"warmup-complete":""}`}><button className="live-warmup-heading" onClick={()=>setWarmupExpanded(value=>!value)}><span><small>WARM-UP</small><b>{active.warmup!.filter(item=>item.done).length} / {active.warmup!.length} complete</b></span><em>{warmupExpanded?"⌃":"⌄"}</em></button>{warmupExpanded&&<div className="live-warmup-items">{active.warmup!.map((item,index)=><label className={item.done?"done":""} key={item.id}><input type="checkbox" checked={Boolean(item.done)} onChange={event=>updateWarmupItemDone(index,event.target.checked)}/><span><b>{item.kind==="exercise"?exerciseName(item.exerciseId||""):item.title?.trim()||"Instructions"}</b>{item.instructions&&<small>{item.instructions}</small>}</span></label>)}</div>}</section>}{active.exercises.map((exercise, exerciseIndex) => { const prev = previousSets(exercise.exerciseId,exercise.loadMode||"kg"); const groupIndex=[...new Set(active.exercises.map(item=>item.group).filter(Boolean))].indexOf(exercise.group);const allDone=exercise.sets.length>0&&exercise.sets.every(set=>set.done);const minimized=(exercise.skipped||allDone)&&!expandedLiveExercises.has(exerciseIndex);return <article className={`live-exercise ${exercise.group ? `superset-exercise superset-color-${groupIndex%4}` : ""} ${exercise.skipped?"skipped-exercise":""} ${minimized?"minimized-exercise":""}`} key={`${exercise.exerciseId}-${exerciseIndex}`}>
          {minimized?<button className="minimized-exercise-row" onClick={()=>setExpandedLiveExercises(current=>new Set(current).add(exerciseIndex))}><span className="minimized-status">{exercise.skipped?"—":"✓"}</span><span><b>{exerciseName(exercise.exerciseId)}</b><small>{exercise.skipped?"Skipped for today":`${exercise.sets.length} sets completed`}</small></span><em>Open ⌄</em></button>:<>
          {exercise.group && <span className="superset-badge">{(active.supersetNames?.[exercise.group]||`Superset ${String.fromCharCode(65+groupIndex)}`).toUpperCase()}</span>}<div className="live-exercise-title"><div><span>{String(exerciseIndex+1).padStart(2,"0")}</span><h2>{exerciseName(exercise.exerciseId)}</h2></div><div className="exercise-title-actions"><label className="load-mode"><span>Load</span><select aria-label={`Load entry type for ${exerciseName(exercise.exerciseId)}`} value={exercise.loadMode==="text"?"band":exercise.loadMode||"kg"} onChange={event=>{const loadMode=event.target.value as "kg"|"band"|"bw";updateWorkoutExercise(exerciseIndex,{loadMode,sets:exercise.sets.map(set=>({...set,weight:loadMode==="bw"?"BW":""}))})}}><option value="kg">KG</option><option value="band">BAND</option><option value="bw">BW</option></select></label><button onClick={()=>setExerciseHistoryId(exercise.exerciseId)}>History</button><button className="manage-exercise" onClick={()=>setLiveEditIndex(exerciseIndex)} aria-label={`Edit ${exerciseName(exercise.exerciseId)}`}>•••</button></div></div>
          {(exercise.skipped||allDone)&&<div className="exercise-state-actions"><button onClick={()=>setExpandedLiveExercises(current=>{const next=new Set(current);next.delete(exerciseIndex);return next})}>Minimise ↑</button></div>}
          <div className="set-head"><span>SET</span><span>PREV</span><span>{exercise.loadMode==="band"||exercise.loadMode==="text"?"BAND":exercise.loadMode==="bw"?"BW":preferredUnit.toUpperCase()}</span><span>REPS</span><span>RPE</span><span /></div>
          {exercise.sets.map((set,setIndex)=>{const previous=prev[setIndex];const compatiblePrevious=previous&&(exercise.loadMode==="kg"||!exercise.loadMode||exercise.loadMode==="band"||exercise.loadMode==="text")?previous:undefined;const previousLabel=compatiblePrevious?`${exercise.loadMode==="kg"||!exercise.loadMode?formatLoad(compatiblePrevious.weight,preferredUnit,false):compatiblePrevious.weight||"—"} × ${compatiblePrevious.reps||"—"}`:undefined;const plannedPlaceholder=exercise.plannedLoad?.mode==="kg"?formatLoad(exercise.plannedLoad.value,preferredUnit,false):exercise.plannedLoad?.value;return <div className={`set-row ${set.done?"complete":""}`} key={setIndex}><b>{setIndex+1}</b><PreviousSetButton label={previousLabel} accessibleLabel={compatiblePrevious?`Use previous set ${setIndex+1}: ${compatiblePrevious.weight||"no load"}, ${compatiblePrevious.reps||"no reps"}`:undefined} onUse={()=>{if(!compatiblePrevious)return;setActive(current=>current?applyPreviousSetValues(current,exerciseIndex,setIndex,compatiblePrevious):current)}}/>{exercise.loadMode==="bw"?<span className="bodyweight-load" aria-label={`Set ${setIndex+1} bodyweight`}>BW</span>:exercise.loadMode==="band"||exercise.loadMode==="text"?<input aria-label={`Set ${setIndex+1} band`} inputMode="text" enterKeyHint="next" maxLength={12} value={set.weight} placeholder={plannedPlaceholder||"Band / level"} onChange={event=>updateSet(exerciseIndex,setIndex,"weight",event.target.value.slice(0,12))}/>:<LoadInput canonicalValue={set.weight} unit={preferredUnit} ariaLabel={`Set ${setIndex+1} ${preferredUnit==="lb"?"weight in pounds":"weight in kilograms"}`} placeholder={plannedPlaceholder||"Weight"} onCanonicalChange={value=>updateSet(exerciseIndex,setIndex,"weight",value)}/>}<input aria-label={`Set ${setIndex+1} reps`} inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" value={set.reps} placeholder={exercise.repTarget||"Reps"} onChange={e=>updateSet(exerciseIndex,setIndex,"reps",e.target.value)}/><input aria-label={`Set ${setIndex+1} RPE`} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="done" value={set.rpe} placeholder="—" onChange={e=>updateSet(exerciseIndex,setIndex,"rpe",e.target.value)}/><button aria-label={`${set.done?"Mark":"Complete"} set ${setIndex+1}${set.done?" incomplete":""}`} aria-pressed={set.done} onClick={()=>updateSet(exerciseIndex,setIndex,"done",!set.done)}>{set.done?"✓":""}</button></div>})}
          <div className="set-actions"><button className="add-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:[...item.sets,makeSet()]}:item)})}>＋ Add set</button>{exercise.sets.length>1&&<button className="remove-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:item.sets.slice(0,-1)}:item)})}>− Remove last set</button>}</div></>}
        </article>})}<button className="add-live-exercise" onClick={()=>{setLiveAddQuery("");setLiveAddOpen(true)}}><span>＋</span><div><b>Add exercise</b><small>Add another movement to this session</small></div><em>→</em></button><label className="workout-note">SESSION NOTE<textarea value={active.note} onChange={e=>setActive({...active,note:e.target.value})} placeholder="How did it feel? Anything to remember?" /></label></div>
      </div>}

      {active&&finishDialogOpen&&(()=>{const plannedSets=active.exercises.filter(exercise=>!exercise.skipped).reduce((sum,exercise)=>sum+exercise.sets.length,0);const completedSetCount=active.exercises.reduce((sum,exercise)=>sum+completedSets(exercise).length,0);const skippedExercises=active.exercises.filter(exercise=>exercise.skipped).length;const incompleteSets=Math.max(0,plannedSets-completedSetCount);const partial=incompleteSets>0||skippedExercises>0;return <div className="overlay high-overlay finish-time-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setFinishDialogOpen(false)}}><section className="finish-time-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-time-title"><button className="finish-time-close" onClick={()=>setFinishDialogOpen(false)} aria-label="Close">×</button><span>FINISH WORKOUT</span><h2 id="finish-time-title">Confirm session</h2><p>{formatDate(active.date)} · {active.name}</p><div className="finish-summary"><b>{completedSetCount} of {plannedSets} planned sets completed</b>{skippedExercises>0&&<small>{skippedExercises} {skippedExercises===1?"exercise":"exercises"} skipped</small>}{incompleteSets>0&&<small>{incompleteSets} {incompleteSets===1?"set":"sets"} left incomplete</small>}</div>{partial&&<p className="finish-partial-warning">This will finish the session as it stands. Incomplete and skipped work will stay in the record and will not count in history or PBs.</p>}{showWorkoutTimingPopup&&<div className="session-time-fields"><label>START TIME<input type="time" value={sessionStartTime} onChange={event=>setSessionStartTime(event.target.value)}/></label><label>FINISH TIME<input type="time" value={sessionFinishTime} onChange={event=>setSessionFinishTime(event.target.value)}/></label></div>}<button className="primary-button" disabled={completionSaving||(showWorkoutTimingPopup&&(!sessionStartTime||!sessionFinishTime))} onClick={()=>saveWorkout(showWorkoutTimingPopup?{startedAt:sessionStartTime,endedAt:sessionFinishTime}:undefined)}>{completionSaving?"Saving…":partial?"Finish partial workout":"Finish workout"} <span>✓</span></button>{partial&&<button className="finish-return-button" onClick={()=>setFinishDialogOpen(false)}>Return to workout</button>}</section></div>})()}

      {completionReceipt&&(()=>{const completion=strengthCompletion(completionReceipt);return <div className="overlay high-overlay completion-receipt-overlay"><section className="completion-receipt" role="dialog" aria-modal="true" aria-labelledby="completion-receipt-title"><span>TRAINING RECORDED</span><h2 id="completion-receipt-title">{completion.status==="partial"?"Partial workout saved":"Workout complete"}</h2><p>{completionReceipt.name} · {formatDate(completionReceipt.date)}</p><div><b>{completion.completedSets} {completion.completedSets===1?"set":"sets"} completed</b><small>{completion.completedExercises} {completion.completedExercises===1?"exercise":"exercises"}{completionReceipt.duration>0?` · ${completionReceipt.duration} min`:" · time not recorded"}</small><small>{completionReceiptSync==="synced"?"Synced to your Setra account":"Saved on this device · cloud sync pending"}</small>{completionReceiptPbs.length>0&&<small>{completionReceiptPbs.length} new {completionReceiptPbs.length===1?"PB":"PBs"}</small>}</div><div className="completion-receipt-actions"><button onClick={()=>{setCompletionReceipt(null);if(queuedTemplatePrompt){setSaveTemplatePrompt(queuedTemplatePrompt);setQueuedTemplatePrompt(null)}}}>Done</button><button className="primary-button" onClick={()=>{setCompletedShare(completionReceipt);setNewPBs(completionReceiptPbs);setCompletionReceipt(null)}}>Share <span>↗</span></button></div></section></div>})()}
      {completedEnduranceReceipt&&<div className="overlay high-overlay completion-receipt-overlay"><section className="completion-receipt" role="dialog" aria-modal="true" aria-labelledby="endurance-receipt-title"><span>TRAINING RECORDED</span><h2 id="endurance-receipt-title">Activity saved</h2><p>{completedEnduranceReceipt.title} · {formatDate(completedEnduranceReceipt.date)}</p><div><b>{enduranceSummary(completedEnduranceReceipt)}</b><small>{completedEnduranceReceipt.minimalEntryConfirmed?"Minimal diary entry":"Performance details recorded"}</small><small>{enduranceReceiptSync==="synced"?"Synced to your Setra account":"Saved on this device · cloud sync pending"}</small></div><div className="completion-receipt-actions"><button onClick={()=>setCompletedEnduranceReceipt(null)}>Done</button><button className="primary-button" onClick={()=>{setCompletedEnduranceShare(completedEnduranceReceipt);setCompletedEnduranceReceipt(null)}}>Share <span>↗</span></button></div></section></div>}

      {(completedShare||newPBs.length>0)&&<ShareStudio items={[...(completedShare?[strengthWorkoutShareData(completedShare,preferredUnit)]:[]),...newPBs.map(pb=>strengthPBShareData(pb,preferredUnit))]} accent={appColour} onClose={()=>{setCompletedShare(null);setNewPBs([]);if(queuedTemplatePrompt){setSaveTemplatePrompt(queuedTemplatePrompt);setQueuedTemplatePrompt(null)}}}/>}
      {saveTemplatePrompt&&newPBs.length===0&&<div className="overlay high-overlay save-template-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!sessionTemplateSaved)setSaveTemplatePrompt(null)}}><section className="sheet save-template-dialog" role="dialog" aria-modal="true" aria-labelledby="save-template-title"><div className="sheet-handle"/><div className="sheet-title"><div><span>SAVE FOR NEXT TIME</span><h2 id="save-template-title">{sessionTemplateSaved?"Template saved":"Keep this workout?"}</h2></div><button onClick={()=>setSaveTemplatePrompt(null)} aria-label="Close">×</button></div>{sessionTemplateSaved?<div className="template-save-success"><i>✓</i><p>Your workout is now available in Plan as a reusable template.</p><button onClick={()=>setSaveTemplatePrompt(null)}>Done</button></div>:<div className="save-session-template"><p>Turn this Add as I go session into a reusable workout.</p><input autoFocus value={newTemplateName} onChange={event=>setNewTemplateName(event.target.value)} maxLength={40} placeholder="Template name"/><button disabled={!newTemplateName.trim()||saveTemplatePrompt.exercises.length===0} onClick={saveSessionAsTemplate}>Save template</button><button className="not-now-button" onClick={()=>setSaveTemplatePrompt(null)}>Not now</button></div>}</section></div>}
      {completedEnduranceShare&&<ShareStudio items={[enduranceWorkoutShareData(completedEnduranceShare)]} accent={appColour} onClose={()=>setCompletedEnduranceShare(null)}/>}

      {trainingAction&&<div className="overlay high-overlay training-action-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setTrainingAction(null)}}><section className="sheet training-type-sheet" role="dialog" aria-modal="true"><div className="sheet-handle"/><div className="sheet-title"><div><span>{trainingAction==="plan"?"PLAN SESSION":"LOG ACTIVITY"}</span><h2>{trainingAction==="plan"?"What are you planning?":"What did you train?"}</h2></div><button onClick={()=>setTrainingAction(null)} aria-label="Close">×</button></div><div className="training-type-options"><button onClick={()=>{setTrainingAction(null);if(trainingAction==="plan")setTab("plan");else{setSelectedDate(today);setPicker(true)}}}><div><b>Strength</b><small>{trainingAction==="plan"?"Create or schedule a strength workout":"Choose a workout or add exercises as you go"}</small></div><em>›</em></button><button onClick={()=>{const action=trainingAction;setTrainingAction(null);if(action==="plan")setTab("plan");else setEnduranceEditor({mode:"log"})}}><div><b>Endurance</b><small>{trainingAction==="plan"?"Choose or create an endurance template":"Log a run, ride, swim or other activity"}</small></div><em>›</em></button></div></section></div>}
      {enduranceEditor&&
        <EnduranceSessionSheet mode={enduranceEditor.mode} date={selectedDate} initial={enduranceEditor.initial} onClose={closeEnduranceEditor} onSave={saveEnduranceValue} onDraftChange={persistEnduranceEditorDraft}/>
      }
      {enduranceDetail&&<EnduranceWorkoutView session={enduranceDetail} onClose={()=>setEnduranceDetailId(null)} onEdit={()=>{setEnduranceDetailId(null);setEnduranceEditor({mode:enduranceDetail.status==="completed"?"log":"plan",initial:enduranceDetail})}} onEditTemplate={enduranceDetail.status==="planned"&&enduranceDetail.templateId?()=>{const template=enduranceTemplates.find(item=>item.id===enduranceDetail.templateId);if(template){setEnduranceDetailId(null);setEnduranceEditor({mode:"template",initial:structuredClone(template)})}}:undefined} onComplete={enduranceDetail.status==="planned"&&!enduranceDetail.skipped?()=>{setEnduranceDetailId(null);setEnduranceEditor({mode:"log",initial:enduranceDetail})}:undefined} onShare={enduranceDetail.status==="completed"?()=>{setCompletedEnduranceShare(enduranceDetail);setEnduranceDetailId(null)}:undefined} onToggleSkip={enduranceDetail.status==="planned"?()=>toggleEnduranceSkipped(enduranceDetail):undefined} onDelete={()=>setDeleteEnduranceId(enduranceDetail.id)}/>}
      {deleteEnduranceId&&<div className="overlay high-overlay confirm-overlay"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-endurance-title"><span className="confirm-icon">!</span><h2 id="delete-endurance-title">Delete this session?</h2><p>This will permanently remove the planned or completed activity from your diary.</p><div className="confirm-actions"><button onClick={()=>setDeleteEnduranceId(null)}>Cancel</button><button className="confirm-delete" onClick={()=>{const session=enduranceSessions.find(item=>item.id===deleteEnduranceId);if(session)deleteEnduranceSession(session)}}>Delete session</button></div></section></div>}
      {deleteEnduranceTemplateId&&<div className="overlay high-overlay confirm-overlay"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-endurance-template-title"><span className="confirm-icon">!</span><h2 id="delete-endurance-template-title">Delete this template?</h2><p>Scheduled and completed sessions will stay in your diary.</p><div className="confirm-actions"><button onClick={()=>setDeleteEnduranceTemplateId(null)}>Cancel</button><button className="confirm-delete" onClick={deleteEnduranceTemplate}>Delete template</button></div></section></div>}

      {detail && <div className="overlay" onMouseDown={()=>setDetailId(null)}><section className="sheet detail-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{formatDate(detail.date).toUpperCase()}{strengthCompletion(detail).status==="partial"?` · PARTIAL · ${strengthCompletion(detail).completedSets}/${strengthCompletion(detail).plannedSets} SETS`:""}</span><h2>{detail.name}</h2></div><div className="detail-title-actions"><button className="edit-workout-button" onClick={()=>{setEditingWorkoutId(detail.id);completionLockRef.current=false;setCompletionSaving(false);setActive(structuredClone(detail));setDetailId(null)}}>Edit</button><button onClick={()=>setDetailId(null)} aria-label="Close">×</button></div></div>{Boolean(detail.warmup?.length)&&<div className="detail-warmup"><span>WARM-UP</span>{detail.warmup!.map(item=><div key={item.id}><i>{item.done?"✓":"○"}</i><p><b>{item.kind==="exercise"?exerciseName(item.exerciseId||""):item.title?.trim()||"Instructions"}</b>{item.instructions&&<small>{item.instructions}</small>}</p></div>)}</div>}{completedExercises(detail).map(exercise=><button className="detail-exercise" key={exercise.exerciseId} onClick={()=>setExerciseHistoryId(exercise.exerciseId)}><span><b>{exerciseName(exercise.exerciseId)}</b><small>{completedSets(exercise).length} working {completedSets(exercise).length===1?"set":"sets"}</small></span><div>{completedSets(exercise).map((set,i)=><small key={i}>{exercise.loadMode==="kg"||!exercise.loadMode?formatLoad(set.weight,preferredUnit):(exercise.loadMode==="bw"?"BW":set.weight||"—")} × {set.reps || "—"} {set.rpe&&`@ ${set.rpe}`}</small>)}</div><em>›</em></button>)}{detail.note&&<p className="detail-note">“{detail.note}”</p>}<button className="share-completed-button detail-share-button" onClick={()=>{setCompletedShare(detail);setDetailId(null)}}>Share workout <span>↗</span></button><button className="delete-workout-button" onClick={()=>setDeleteWorkoutId(detail.id)}>Delete workout</button></section></div>}
      {deleteWorkoutId && <div className="overlay high-overlay confirm-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteWorkoutId(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-workout-title"><span className="confirm-icon">!</span><h2 id="delete-workout-title">Delete this workout?</h2><p>This will permanently remove the completed workout and its exercise history.</p><div className="confirm-actions"><button onClick={()=>setDeleteWorkoutId(null)}>Cancel</button><button className="confirm-delete" onClick={deleteCompletedWorkout}>Delete workout</button></div></section></div>}
      {deleteTemplateId && <div className="overlay high-overlay confirm-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteTemplateId(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-template-title"><span className="confirm-icon">!</span><h2 id="delete-template-title">Delete this template?</h2><p>This will remove the template and any workouts scheduled from it. Completed workout history will stay untouched.</p><div className="confirm-actions"><button onClick={()=>setDeleteTemplateId(null)}>Cancel</button><button className="confirm-delete" onClick={deleteTemplate}>Delete template</button></div></section></div>}

      {active && liveEditIndex !== null && active.exercises[liveEditIndex] && <div className="overlay high-overlay live-edit-overlay" onMouseDown={()=>setLiveEditIndex(null)}>
        <section className="sheet live-edit-sheet" onMouseDown={e=>e.stopPropagation()}>
          <div className="sheet-handle"/>
          <div className="sheet-title"><div><span>EDIT LIVE SESSION</span><h2>{exerciseName(active.exercises[liveEditIndex].exerciseId)}</h2></div><button onClick={()=>setLiveEditIndex(null)}>×</button></div>
          <div className="live-edit-actions"><button className="move-menu-action" disabled={liveEditIndex===0} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex-1)}><b>↑</b><span>Move earlier</span></button><button className="move-menu-action" disabled={liveEditIndex===active.exercises.length-1} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex+1)}><b>↓</b><span>Move later</span></button>{active.exercises[liveEditIndex].group?<button className="superset-menu-action ungroup-action" onClick={()=>ungroupLiveExercise(liveEditIndex)}><b>⊘</b><span>Remove from superset</span></button>:<button className="superset-menu-action" disabled={active.exercises.length<2} onClick={()=>groupLiveExercise(liveEditIndex,liveEditIndex>0?liveEditIndex-1:1)}><b>⇄</b><span>Superset with {liveEditIndex>0?"previous":"next"}</span></button>}<button className="skip-menu-action" onClick={()=>{toggleExerciseSkipped(liveEditIndex);setLiveEditIndex(null)}}><b>{active.exercises[liveEditIndex].skipped?"↩":"—"}</b><span>{active.exercises[liveEditIndex].skipped?"Unskip exercise":"Skip for today"}</span></button></div>
          <div className="replace-heading"><span>CHANGE EXERCISE</span><p>Your completed and entered sets will be kept.</p></div>
          <label className="search live-swap-search"><span>⌕</span><input value={liveSwapQuery} onChange={event=>setLiveSwapQuery(event.target.value)} placeholder="Search exercise, equipment or muscle"/></label>
          <div className="replace-list live-swap-results">{data.exercises.filter(exercise=>exercise.id!==active.exercises[liveEditIndex].exerciseId&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(liveSwapQuery.trim().toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:active.exercises.map((item,index)=>index===liveEditIndex?{...item,exerciseId:exercise.id}:item)});setLiveEditIndex(null)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.group} · {exercise.equipment}</small></span><em>Replace</em></button>)}</div>
        </section>
      </div>}

      {active && liveAddOpen && <div className="overlay high-overlay live-add-overlay" onMouseDown={()=>setLiveAddOpen(false)}><section className="sheet add-exercise-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>LIVE SESSION</span><h2>Add an exercise</h2></div><button onClick={()=>setLiveAddOpen(false)}>×</button></div><label className="search"><span>⌕</span><input autoFocus value={liveAddQuery} onChange={event=>setLiveAddQuery(event.target.value)} placeholder="Search exercise, equipment or muscle" /></label><div className="replace-list live-add-results">{data.exercises.filter(exercise=>!active.exercises.some(item=>item.exerciseId===exercise.id)&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(liveAddQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:[...active.exercises,{exerciseId:exercise.id,note:"",loadMode:"kg",repTarget:"8",sets:Array.from({length:3},()=>makeSet())}]});setLiveAddOpen(false)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></section></div>}

      {historyExercise && <div className="overlay high-overlay" onMouseDown={()=>setExerciseHistoryId(null)}><section className="sheet history-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{historyExercise.group.toUpperCase()} · {historyExercise.equipment.toUpperCase()}</span><h2>{historyExercise.name}</h2></div><button onClick={()=>setExerciseHistoryId(null)}>×</button></div>{(() => { const records=data.workouts.flatMap(workout=>workout.exercises.filter(exercise=>exercise.exerciseId===historyExercise.id&&completedSets(exercise).length>0).map(exercise=>({workout,exercise}))); const maxes=records.filter(record=>record.exercise.loadMode==null||record.exercise.loadMode==="kg").map(record=>Math.max(0,...completedSets(record.exercise).map(set=>Number(set.weight)||0))).filter(max=>max>0); return <>{maxes.length>0&&<div className="progress-chart"><div className="chart-bars">{maxes.slice().reverse().map((max,i)=><i key={i} style={{height:`${25+70*max/Math.max(...maxes)}%`}}><span>{formatLoad(max,preferredUnit,false)}</span></i>)}</div><small>Highest load by session ({preferredUnit})</small></div>}<div className="exercise-records">{records.length?records.map(({workout,exercise})=><div key={workout.id}><span><b>{formatDate(workout.date)}</b><small>{workout.name}</small></span><p>{completedSets(exercise).map((set,i)=><em key={i}>{exercise.loadMode==="kg"||!exercise.loadMode?formatLoad(set.weight,preferredUnit):(exercise.loadMode==="bw"?"BW":set.weight||"—")} × {set.reps || "—"}<small>{set.rpe&&` RPE ${set.rpe}`}</small></em>)}</p></div>):<p className="no-records">No completed sets yet. Start a workout to build your history.</p>}</div></>})()}</section></div>}

      {feedbackOpen&&<div className="overlay high-overlay" onMouseDown={()=>setFeedbackOpen(false)}><section className="sheet beta-feedback-sheet" onMouseDown={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>BETA FEEDBACK</span><h2>{feedbackSent?"Thank you.":"Help shape Setra"}</h2></div><button onClick={()=>setFeedbackOpen(false)} aria-label="Close">×</button></div>{feedbackSent?<div className="feedback-success"><i>✓</i><p>Your feedback has been sent. It will help guide what gets improved next.</p><button onClick={()=>setFeedbackOpen(false)}>Done</button></div>:<form onSubmit={submitFeedback}><fieldset><legend>WHAT IS THIS ABOUT?</legend>{([['general','General'],['bug','Something isn’t working'],['idea','Feature idea']] as const).map(([value,label])=><button type="button" key={value} className={feedbackCategory===value?"selected":""} onClick={()=>setFeedbackCategory(value)}>{label}</button>)}</fieldset><label>YOUR FEEDBACK<textarea autoFocus required minLength={5} maxLength={2000} value={feedbackMessage} onChange={event=>setFeedbackMessage(event.target.value)} placeholder="Tell us what happened or what would make Setra better…"/></label><small>{feedbackMessage.length} / 2000</small>{feedbackError&&<p role="alert">{feedbackError}</p>}<button className="primary-button" disabled={feedbackBusy||feedbackMessage.trim().length<5}>{feedbackBusy?"Sending…":"Send feedback"} <span>→</span></button></form>}</section></div>}

      {weeklyPreviewOpen&&<WeeklyPreview items={weeklyPreviewItems} weekStartsOn={weekStartsOn} today={today} anchorDate={selectedDate} onClose={()=>setWeeklyPreviewOpen(false)} onSelect={openWeeklySession} onPlan={()=>{setWeeklyPreviewOpen(false);setTab("plan")}}/>}
      {syncRecoveryOpen&&<div className="overlay high-overlay sync-recovery-overlay"><section className="sync-recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-recovery-title"><header><div><span>SYNC RECOVERY</span><h2 id="sync-recovery-title">Review saved changes</h2><p>Compare what is saved on this device with the latest cloud copy before choosing.</p></div><button onClick={()=>setSyncRecoveryOpen(false)} aria-label="Close sync recovery">×</button></header>{recoveryLoadState==="loading"&&<p role="status">Loading the latest cloud versions…</p>}{recoveryLoadState==="error"&&<p role="alert">The cloud comparison could not be loaded. Your device changes remain safe. Close this window and try again when connected.</p>}<div className="sync-recovery-list">{syncIssues.map(change=>{const cloud=serverRecord(change);const fields=recoveryLoadState==="ready"?recoveryComparison(change,cloud):[];return <article key={change.operationId}><b>{pendingLabel(change)}</b><small>{change.failure?.message}</small>{recoveryLoadState==="ready"&&<div className="recovery-comparison" role="table" aria-label={`Comparison for ${pendingLabel(change)}`}><div role="row"><b role="columnheader">Detail</b><b role="columnheader">This device</b><b role="columnheader">Cloud</b></div>{fields.map(field=><div role="row" className={field.different?"different":""} key={field.label}><span role="cell">{field.label}</span><span role="cell">{field.device}</span><span role="cell">{field.cloud}</span></div>)}</div>}<div className="recovery-actions"><button onClick={()=>retrySyncIssue(change)}>Try device copy again</button><button onClick={()=>setDiscardRecoveryId(change.operationId)}>Use cloud copy</button>{change.kind.startsWith("save_")&&<button className="primary-button" onClick={()=>saveSyncIssueAsCopy(change)}>Save both as separate copies</button>}</div>{discardRecoveryId===change.operationId&&<div className="recovery-confirm" role="alert"><p><b>Replace the device change?</b> Setra will keep a recoverable browser backup, discard this pending version, then reload the cloud copy.</p><div><button onClick={()=>setDiscardRecoveryId(null)}>Keep device copy</button><button onClick={()=>discardSyncIssue(change)}>Confirm use cloud</button></div></div>}</article>})}</div>{recoveryBackups.length>0&&<section className="recovery-backups"><span>RECOVERY BACKUPS</span><p>Setra keeps up to 20 replaced device snapshots in this browser so they are not silently lost.</p>{recoveryBackups.map(change=><article key={change.operationId}><div><b>{pendingLabel(change)}</b><small>Saved {new Intl.DateTimeFormat("en-AU",{dateStyle:"medium",timeStyle:"short"}).format(new Date(change.updatedAt))}</small></div><button onClick={()=>restoreRecoveryBackup(change)}>Restore for sync</button></article>)}</section>}{syncIssues.length===0&&recoveryBackups.length===0&&<p className="sync-recovery-empty">No changes currently need review.</p>}</section></div>}

      {editor && <div className="editor-screen" role="dialog" aria-modal="true" aria-labelledby="strength-editor-title" tabIndex={-1}>
        <header className="workout-header strength-editor-header"><div><small>WORKOUT BUILDER</small><b id="strength-editor-title">{editor.id.startsWith("template-")?"New template":"Edit template"}</b></div><button data-dialog-initial-focus className="strength-editor-close" onClick={closeStrengthEditor} aria-label="Close">×</button></header>
        <div className="editor-body">
          <label>WORKOUT NAME<input value={editor.name} onChange={event=>setEditor({...editor,name:event.target.value})} placeholder="e.g. Lower B" /></label>
          <label>FOCUS<input value={editor.focus} onChange={event=>setEditor({...editor,focus:event.target.value})} placeholder="e.g. Hinge + single-leg" /></label>
          <section className="warmup-builder"><div className="warmup-builder-heading"><span>WARM-UP</span><small>OPTIONAL</small></div><p>Add movements or instructions in the order you want to complete them.</p>{Boolean(editor.warmup?.length)&&<div className="warmup-builder-items">{editor.warmup!.map((item,index)=><div className={`warmup-builder-item ${item.kind==="exercise"?"warmup-exercise-item":"warmup-instruction-item"}`} key={item.id}><span className="warmup-item-type">{item.kind==="exercise"?"EXERCISE":"INSTRUCTIONS"}</span>{item.kind==="exercise"?<b>{exerciseName(item.exerciseId||"")}</b>:<label className="warmup-name-field">NAME<input maxLength={80} value={item.title||""} onChange={event=>updateWarmupItem(index,"title",event.target.value)} placeholder="Instructions"/></label>}<label className="warmup-instructions-field">ADDITIONAL INSTRUCTIONS<textarea aria-label={`Additional instructions for ${item.kind==="exercise"?exerciseName(item.exerciseId||""):item.title?.trim()||"Instructions"}`} maxLength={500} value={item.instructions} onChange={event=>updateWarmupItem(index,"instructions",event.target.value)} placeholder=""/></label><div><button disabled={index===0} onClick={()=>moveWarmupItem(index,-1)} aria-label="Move warm-up item earlier">↑</button><button disabled={index===editor.warmup!.length-1} onClick={()=>moveWarmupItem(index,1)} aria-label="Move warm-up item later">↓</button><button className="remove-warmup-item" onClick={()=>removeWarmupItem(index)}>Remove</button></div></div>)}</div>}<div className="warmup-add-actions"><button onClick={addWarmupInstruction}>＋ Add instructions</button><button onClick={()=>{setWarmupPickerOpen(value=>!value);setWarmupQuery("")}}>＋ Add exercise</button></div>{warmupPickerOpen&&<div className="warmup-exercise-picker"><label className="search"><span>⌕</span><input autoFocus value={warmupQuery} onChange={event=>setWarmupQuery(event.target.value)} placeholder="Search warm-up exercise"/></label><div className="editor-library-list">{data.exercises.filter(exercise=>`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(warmupQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>addWarmupExercise(exercise.id)}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></div>}</section>
          <div className="editor-exercises"><span>EXERCISES <small>PRESS AND DRAG TO REORDER</small></span>{editor.exercises.map((item,index)=>{
            const groups=[...new Set(editor.exercises.map(exercise=>exercise.group).filter((group):group is string=>Boolean(group)))];
            const groupIndex=item.group?groups.indexOf(item.group):-1;
            const firstInGroup=Boolean(item.group)&&editor.exercises.findIndex(exercise=>exercise.group===item.group)===index;
            const fallbackName=`Superset ${String.fromCharCode(65+groupIndex)}`;
            return <div data-editor-index={index} className={`${item.group?`grouped-editor-exercise superset-color-${groupIndex%4}`:""} ${draggedExerciseIndex===index?"dragging-exercise":""}`} key={item.exerciseId}>
              <button type="button" className="drag-handle" aria-label={`Reorder ${exerciseName(item.exerciseId)}`} title="Press and drag to reorder" onPointerDown={event=>beginTemplateReorder(index,event)} onPointerMove={moveTemplateReorder} onPointerUp={endTemplateReorder} onPointerCancel={endTemplateReorder} onKeyDown={event=>{if(event.key==="ArrowUp"&&index>0){event.preventDefault();reorderTemplateExercise(index,index-1)}if(event.key==="ArrowDown"&&index<editor.exercises.length-1){event.preventDefault();reorderTemplateExercise(index,index+1)}}}>⠿</button>
              <b>{exerciseName(item.exerciseId)}</b>
              <label>Sets<input inputMode="numeric" pattern="[0-9]*" enterKeyHint="next" value={item.sets} onChange={event=>setEditor({...editor,exercises:editor.exercises.map((exercise,exerciseIndex)=>exerciseIndex===index?{...exercise,sets:Number(event.target.value)}:exercise)})}/></label>
              <label>Reps<span className="range-target-input"><input inputMode="numeric" pattern="[0-9-]*" enterKeyHint="next" value={item.reps} onChange={event=>setEditor({...editor,exercises:editor.exercises.map((exercise,exerciseIndex)=>exerciseIndex===index?{...exercise,reps:event.target.value}:exercise)})}/><button type="button" aria-label={`Add range separator to ${exerciseName(item.exerciseId)} reps`} title="Add range separator" onPointerDown={event=>event.preventDefault()} onClick={event=>{const input=event.currentTarget.previousElementSibling as HTMLInputElement;const position=input.selectionStart??item.reps.length;const reps=item.reps.includes("-")?item.reps:`${item.reps.slice(0,position)}-${item.reps.slice(position)}`;setEditor({...editor,exercises:editor.exercises.map((exercise,exerciseIndex)=>exerciseIndex===index?{...exercise,reps}:exercise)});requestAnimationFrame(()=>{input.focus();input.setSelectionRange(Math.min(position+1,reps.length),Math.min(position+1,reps.length))})}}>−</button></span></label>
              <button className="remove-template-exercise" onClick={()=>removeTemplateExercise(index)} aria-label={`Remove ${exerciseName(item.exerciseId)}`}>×</button>
              {item.group&&<small className="editor-superset-label">{(editor.supersetNames?.[item.group]||fallbackName).toUpperCase()}</small>}
              {firstInGroup&&item.group&&<label className="superset-name-input">SUPERSET NAME (OPTIONAL)<input maxLength={30} value={editor.supersetNames?.[item.group]||""} placeholder={fallbackName} onChange={event=>setEditor({...editor,supersetNames:{...editor.supersetNames,[item.group!]:event.target.value}})}/></label>}
              {index>0&&<button className={`superset-toggle ${item.group?"active":""}`} onClick={()=>toggleSuperset(index)}>{item.group?"✓ Remove from superset":"⊕ Group with exercise above"}</button>}
            </div>;
          })}</div>
          <div className="exercise-picker"><span>ADD EXERCISE</span><label className="search"><span>⌕</span><input value={editorQuery} onChange={event=>setEditorQuery(event.target.value)} placeholder="Search by exercise, equipment or muscle" /></label><div className="editor-library-list">{data.exercises.filter(exercise=>!editor.exercises.some(item=>item.exerciseId===exercise.id)&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(editorQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>setEditor({...editor,exercises:[...editor.exercises,{exerciseId:exercise.id,sets:3,reps:"8"}]})}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></div>
          {data.templates.some(template=>template.id===editor.id)&&<button className="delete-template-button" onClick={()=>setDeleteTemplateId(editor.id)}>Delete template</button>}
          <button className="primary-button strength-editor-save" onClick={saveTemplate}>Save workout <span>→</span></button>
        </div>
      </div>}
    </main>
  );
}
