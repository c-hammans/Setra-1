"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "today" | "plan" | "history" | "pbs" | "library";
type Exercise = { id: string; name: string; group: string; equipment: string };
type TemplateExercise = { exerciseId: string; sets: number; reps: string; group?: string; note?: string };
type Template = { id: string; name: string; focus: string; exercises: TemplateExercise[]; color?: string; icon?: string; supersetNames?: Record<string,string> };
type SetLog = { reps: string; weight: string; rpe: string; done: boolean; note?: string };
type WorkoutExercise = { exerciseId: string; sets: SetLog[]; note: string; group?: string; loadMode?: "kg"|"text"; planNote?: string; repTarget?: string; skipped?: boolean };
type Workout = { id: string; templateId?: string; name: string; date: string; startedAt: string; endedAt?: string; duration: number; exercises: WorkoutExercise[]; note: string; supersetNames?: Record<string,string> };
type AppData = { exercises: Exercise[]; templates: Template[]; workouts: Workout[]; scheduled: { date: string; templateId: string; skipped?: boolean }[] };
type PBResult = { exerciseId: string; name: string; weight: number; reps: string };

const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
const today = localDateKey();
const localTime = (date = new Date()) => `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
const daysAgo = (days: number) => { const date = new Date(); date.setDate(date.getDate() - days); return date.toISOString().slice(0, 10); };

const sampleExercises: Exercise[] = [
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
  { id: "machine-hip-thrust", name: "Machine Hip Thrust", group: "Glutes", equipment: "Machine" },
  { id: "cable-kickback", name: "Cable Glute Kickback", group: "Glutes", equipment: "Cable" },
  { id: "machine-chest-press", name: "Machine Chest Press", group: "Chest", equipment: "Machine" },
  { id: "incline-barbell-press", name: "Incline Barbell Bench Press", group: "Chest", equipment: "Barbell" },
  { id: "incline-machine-press", name: "Incline Machine Chest Press", group: "Chest", equipment: "Machine" },
  { id: "cable-chest-fly", name: "Cable Chest Fly", group: "Chest", equipment: "Cable" },
  { id: "chest-supported-row", name: "Chest Supported Dumbbell Row", group: "Back", equipment: "Dumbbell" },
  { id: "machine-row", name: "Machine Seated Row", group: "Back", equipment: "Machine" },
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
];

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

const initialData: AppData = { exercises: sampleExercises, templates: sampleTemplates, workouts: sampleWorkouts, scheduled: [{ date: today, templateId: "lower-a" }] };
const motivations = ["Ready when you are.","Built for what’s next.","Strong starts here.","Show up and get stronger.","One set at a time.","Make today count.","Progress starts now.","Your strength is building.","Keep the momentum.","Today is yours.","Put in the work.","Go build something strong.","Small steps. Big strength.","Stronger with every set.","This is your time.","Earn tomorrow’s strength.","Move well. Finish strong.","Start steady. End strong.","You’ve got this.","Ready. Set. Strong.","Build the next version.","Train with purpose.","Make this session count.","Good work starts now.","Own every rep.","Keep showing up.","Strength happens here.","One more strong day.","Begin where you are.","Let’s get stronger."];
const setraColours = [{name:"Blue",value:"#409ECE"},{name:"Coral",value:"#FF6B6B"},{name:"Yellow",value:"#F6C445"},{name:"Green",value:"#55B96D"},{name:"Purple",value:"#8B72D9"},{name:"Black",value:"#000000"},{name:"White",value:"#FFFFFF"}];
const pbGraphics = [{name:"Trophy",index:0},{name:"Dumbbell",index:1},{name:"Barbell",index:2},{name:"Kettlebell",index:3},{name:"Strength",index:4},{name:"Crown",index:5}];
const formatDate = (value: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
const formatLongDate = (value: string) => new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const isLightColour = (value?: string) => ["#FFFFFF","#F6C445"].includes((value||"").toUpperCase());
const formatSessionDuration = (start: string, finish?: string) => {
  if (!start || !finish) return "Time not recorded";
  const [startHour,startMinute]=start.split(":").map(Number);const [finishHour,finishMinute]=finish.split(":").map(Number);
  let minutes=(finishHour*60+finishMinute)-(startHour*60+startMinute);if(minutes<0)minutes+=24*60;
  const hours=Math.floor(minutes/60);const remainder=minutes%60;
  return [hours?`${hours} ${hours===1?"hr":"hrs"}`:"",remainder?`${remainder} min`:""].filter(Boolean).join(" ")||"0 min";
};

export default function Home() {
  const [data, setData] = useState<AppData>(initialData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [active, setActive] = useState<Workout | null>(null);
  const [savedDraft, setSavedDraft] = useState<Workout | null>(null);
  const [liveEditIndex, setLiveEditIndex] = useState<number | null>(null);
  const [liveAddOpen, setLiveAddOpen] = useState(false);
  const [liveAddQuery, setLiveAddQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteWorkoutId, setDeleteWorkoutId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [exerciseHistoryId, setExerciseHistoryId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Template | null>(null);
  const [picker, setPicker] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [editorQuery, setEditorQuery] = useState("");
  const [historyMode, setHistoryMode] = useState<"sessions" | "exercises">("sessions");
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [motivation, setMotivation] = useState(motivations[0]);
  const [newPBs, setNewPBs] = useState<PBResult[]>([]);
  const [pbTileStyle, setPbTileStyle] = useState<"colour"|"transparent">("colour");
  const [pbColour, setPbColour] = useState("#409ECE");
  const [pbGraphic, setPbGraphic] = useState(0);
  const [selectedPBIndex, setSelectedPBIndex] = useState(0);
  const [pbShareMessage, setPbShareMessage] = useState("");
  const [expandedPlanned, setExpandedPlanned] = useState<Set<string>>(new Set());
  const [expandedLiveExercises, setExpandedLiveExercises] = useState<Set<number>>(new Set());
  const [scheduleTemplateId, setScheduleTemplateId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleRepeat, setScheduleRepeat] = useState<"once"|"weekly"|"fortnightly">("once");
  const [scheduleWeeks, setScheduleWeeks] = useState(4);
  const [draggedExerciseIndex, setDraggedExerciseIndex] = useState<number | null>(null);
  const [finishDialogOpen, setFinishDialogOpen] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState("");
  const [sessionFinishTime, setSessionFinishTime] = useState("");
  const [completedShare, setCompletedShare] = useState<Workout | null>(null);
  const [sessionShareMessage, setSessionShareMessage] = useState("");
  const [sessionShareColour, setSessionShareColour] = useState("#409ECE");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [sessionTemplateSaved, setSessionTemplateSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("form-strength-diary"); if (stored) { const parsed: AppData=JSON.parse(stored); setData({...parsed,templates:parsed.templates.map(template=>({...template,color:template.color?.toUpperCase()==="#7B61FF"?"#409ECE":template.color})),exercises:[...parsed.exercises,...sampleExercises.filter(sample=>!parsed.exercises.some(exercise=>exercise.id===sample.id))]}); }
      const draft = localStorage.getItem("form-active-workout"); if (draft) setSavedDraft(JSON.parse(draft));
    } catch { /* keep samples */ }
    setLoaded(true);
    setMotivation(motivations[Math.floor(Math.random()*motivations.length)]);
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem("form-strength-diary", JSON.stringify(data)); }, [data, loaded]);

  const exerciseName = (id: string) => data.exercises.find(exercise => exercise.id === id)?.name ?? "Exercise";
  const scheduledTemplates = data.scheduled.filter(item=>item.date===selectedDate).map(item=>data.templates.find(template=>template.id===item.templateId)).filter((template):template is Template=>Boolean(template)).filter(template=>!(savedDraft?.date===selectedDate&&savedDraft.templateId===template.id));
  const completedWorkouts = data.workouts.filter(workout => workout.date === selectedDate);
  const latestWorkout = data.workouts[0];
  const detail = data.workouts.find(workout => workout.id === detailId);
  const historyExercise = data.exercises.find(exercise => exercise.id === exerciseHistoryId);
  const weekDays = useMemo(() => { const base=new Date(`${selectedDate}T12:00:00`); const monday=new Date(base); monday.setDate(base.getDate()-((base.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);return day.toISOString().slice(0,10)}); },[selectedDate]);
  const monthDays = useMemo(() => { const base=new Date(`${selectedDate}T12:00:00`); const first=new Date(base.getFullYear(),base.getMonth(),1,12); const start=new Date(first);start.setDate(1-((first.getDay()+6)%7));return Array.from({length:42},(_,i)=>{const day=new Date(start);day.setDate(start.getDate()+i);return day.toISOString().slice(0,10)}); },[selectedDate]);
  const personalBests = useMemo(() => data.exercises.map(exercise => { const attempts=data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.id).flatMap(item=>item.sets.map(set=>({set,workout})))); const best=attempts.sort((a,b)=>(Number(b.set.weight)||0)-(Number(a.set.weight)||0))[0]; return best&&Number(best.set.weight)>0?{exercise,best}:null; }).filter(Boolean) as {exercise:Exercise;best:{set:SetLog;workout:Workout}}[],[data]);
  const workoutInProgress = Boolean(active || savedDraft?.date === today);

  const previousSets = (exerciseId: string) => data.workouts.find(workout => workout.exercises.some(exercise => exercise.exerciseId === exerciseId))?.exercises.find(exercise => exercise.exerciseId === exerciseId)?.sets ?? [];

  function startWorkout(template: Template, workoutDate = today) {
    if (workoutInProgress || workoutDate !== today) return;
    setExpandedLiveExercises(new Set());
    setEditingWorkoutId(null);
    setActive({ id: `workout-${workoutDate}-${data.workouts.length+1}-${template.id}`, templateId: template.id, name: template.name, date: workoutDate, startedAt: localTime(), duration: 0, note: "", supersetNames: template.supersetNames, exercises: template.exercises.map(item => {
      const isRange = (item.reps.match(/\d+/g)?.length ?? 0) > 1;
      return { exerciseId: item.exerciseId, group: item.group, note: "", planNote:item.note||"", repTarget:item.reps, loadMode:"kg" as const, sets: Array.from({ length: item.sets }, () => makeSet(isRange ? "" : item.reps.replace(/\D/g, ""))) };
    }) });
    setPicker(false);
  }
  function startBlankWorkout() {
    if (workoutInProgress || selectedDate !== today) return;
    setExpandedLiveExercises(new Set());
    setEditingWorkoutId(null);
    setActive({id:`workout-${today}-${data.workouts.length+1}-quick`,name:"Add as I go",date:today,startedAt:localTime(),duration:0,note:"",exercises:[]});
    setPicker(false);
  }
  function saveDraft() {
    if (!active) return;
    localStorage.setItem("form-active-workout", JSON.stringify(active));
    if(active.templateId)setData(current=>({...current,scheduled:current.scheduled.filter(item=>!(item.date===active.date&&item.templateId===active.templateId))}));
    setSavedDraft(active); setActive(null); setTab("today");
  }
  function saveWorkout(timing?:{startedAt:string;endedAt:string}) {
    if (!active) return;
    const completed = { ...active, ...timing, duration: 0 };
    if (!editingWorkoutId) {
      const records = completed.exercises.flatMap(exercise => {
        if (exercise.loadMode === "text") return [];
        const bestSet = exercise.sets.filter(set=>set.done&&Number(set.weight)>0).sort((a,b)=>Number(b.weight)-Number(a.weight))[0];
        if (!bestSet) return [];
        const previousBest = Math.max(0,...data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.exerciseId).flatMap(item=>item.sets.map(set=>Number(set.weight)||0))));
        return Number(bestSet.weight)>previousBest?[{exerciseId:exercise.exerciseId,name:exerciseName(exercise.exerciseId),weight:Number(bestSet.weight),reps:bestSet.reps}]:[];
      });
      if (records.length) { setNewPBs(records); setPbTileStyle("colour"); setPbColour("#409ECE"); setPbGraphic(0); setSelectedPBIndex(0); setPbShareMessage(""); }
    }
    if (timing && !editingWorkoutId) {
      setCompletedShare(completed);
      setSessionShareMessage("");
      setSessionShareColour("#409ECE");
      setNewTemplateName("");
      setSessionTemplateSaved(false);
    }
    setData(current => ({ ...current, workouts: editingWorkoutId ? current.workouts.map(workout=>workout.id===editingWorkoutId?completed:workout) : [completed, ...current.workouts], scheduled: active.templateId?current.scheduled.filter(item => !(item.date===active.date&&item.templateId===active.templateId)):current.scheduled }));
    localStorage.removeItem("form-active-workout"); setSavedDraft(null); setActive(null); setEditingWorkoutId(null); setSelectedDate(completed.date); setTab("today"); setDetailId(null); setFinishDialogOpen(false);
  }
  function openFinishDialog() {
    if (!active) return;
    const fallbackStart=new Date();fallbackStart.setHours(fallbackStart.getHours()-1);
    setSessionStartTime(active.startedAt||localTime(fallbackStart));
    setSessionFinishTime(active.endedAt||localTime());
    setFinishDialogOpen(true);
  }
  function deleteCompletedWorkout() {
    if (!deleteWorkoutId) return;
    setData(current => ({ ...current, workouts: current.workouts.filter(workout => workout.id !== deleteWorkoutId) }));
    setDetailId(null);
    setDeleteWorkoutId(null);
  }
  function deleteTemplate() {
    if (!deleteTemplateId) return;
    setData(current=>({...current,templates:current.templates.filter(template=>template.id!==deleteTemplateId),scheduled:current.scheduled.filter(item=>item.templateId!==deleteTemplateId)}));
    if (editor?.id===deleteTemplateId) setEditor(null);
    setDeleteTemplateId(null);
  }
  function createPBImage(style: "colour"|"transparent") {
    return new Promise<Blob>((resolve,reject)=>{
      const canvas=document.createElement("canvas"); canvas.width=1080; canvas.height=1080;
      const context=canvas.getContext("2d"); if(!context){reject(new Error("Image unavailable"));return;}
      const pb=newPBs[selectedPBIndex]||newPBs[0]; const ink=style==="colour"?(isLightColour(pbColour)?"#000000":"#FFFFFF"):pbColour;
      if(style==="colour"){context.fillStyle=pbColour;context.fillRect(0,0,1080,1080);}else context.clearRect(0,0,1080,1080);
      context.fillStyle=ink;context.textAlign="center";
      context.font="900 72px Arial";context.fillText("NEW PB",540,370);
      context.font="800 50px Arial";context.fillText(pb.name.toUpperCase(),540,435,920);
      context.font="900 144px Arial";context.fillText(`${pb.weight} KG`,540,585,940);
      context.font="900 68px Arial";context.fillText(`× ${pb.reps || "—"} REPS`,540,670);
      context.font="900 76px Arial";context.fillText("setra",540,810);
      context.font="600 25px Arial";context.fillText(formatDate(today).toUpperCase(),540,875);
      const sprite=new Image();sprite.onload=()=>{const iconCanvas=document.createElement("canvas");iconCanvas.width=360;iconCanvas.height=240;const iconContext=iconCanvas.getContext("2d");if(iconContext){iconContext.drawImage(sprite,pbGraphic*360,0,360,240,0,0,360,240);iconContext.globalCompositeOperation="source-in";iconContext.fillStyle=ink;iconContext.fillRect(0,0,360,240);context.drawImage(iconCanvas,300,35,480,320);}canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image unavailable")),"image/png");};sprite.onerror=()=>reject(new Error("Graphic unavailable"));sprite.src="/pb-icons.png";
    });
  }
  async function savePBImage() {
    const blob=await createPBImage(pbTileStyle); const url=URL.createObjectURL(blob); const link=document.createElement("a");link.href=url;link.download=`setra-pb-${today}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setPbShareMessage("Image saved. On iPhone, choose Save Image from the download or share menu.");
  }
  async function sharePBImage() {
    const blob=await createPBImage(pbTileStyle); const file=new File([blob],`setra-pb-${today}.png`,{type:"image/png"});
    try { if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:"My new Setra PB",text:"A new personal best 💪",files:[file]});}else{await savePBImage();} } catch(error){if((error as Error).name!=="AbortError")setPbShareMessage("Sharing was unavailable. Use Save image instead.");}
  }
  function createSessionImage() {
    return new Promise<Blob>((resolve,reject)=>{
      if (!completedShare) { reject(new Error("Workout unavailable")); return; }
      const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1080;
      const context=canvas.getContext("2d");if(!context){reject(new Error("Image unavailable"));return;}
      const completedSets=completedShare.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0);
      const exercises=completedShare.exercises.filter(exercise=>!exercise.skipped).length;
      const tileInk=isLightColour(sessionShareColour)?"#000000":"#FFFFFF";
      context.fillStyle=sessionShareColour;context.fillRect(0,0,1080,1080);context.fillStyle=tileInk;context.textAlign="center";
      context.beginPath();context.arc(540,190,92,0,Math.PI*2);context.fillStyle=tileInk;context.fill();
      context.strokeStyle=sessionShareColour;context.lineWidth=22;context.lineCap="round";context.beginPath();context.moveTo(495,190);context.lineTo(530,225);context.lineTo(592,151);context.stroke();
      context.fillStyle=tileInk;context.font="900 52px Arial";context.fillText("WORKOUT COMPLETE",540,365);
      context.font="800 46px Arial";context.fillText(formatLongDate(completedShare.date).toUpperCase(),540,465,920);
      context.font="900 96px Arial";context.fillText(formatSessionDuration(completedShare.startedAt,completedShare.endedAt).toUpperCase(),540,600,920);
      context.font="800 42px Arial";context.fillText(`${exercises} EXERCISES  ·  ${completedSets} SETS`,540,700);
      context.font="900 84px Arial";context.fillText("setra",540,860);
      canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image unavailable")),"image/png");
    });
  }
  async function saveSessionImage() {
    const blob=await createSessionImage();const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`setra-workout-${completedShare?.date||today}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setSessionShareMessage("Image saved. On iPhone, choose Save Image from the download or share menu.");
  }
  async function shareSessionImage() {
    const blob=await createSessionImage();const file=new File([blob],`setra-workout-${completedShare?.date||today}.png`,{type:"image/png"});
    try { if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:"My Setra workout",text:"Workout complete ✓",files:[file]});}else await saveSessionImage(); } catch(error){if((error as Error).name!=="AbortError")setSessionShareMessage("Sharing was unavailable. Use Save instead.");}
  }
  function saveSessionAsTemplate() {
    if (!completedShare || !newTemplateName.trim() || sessionTemplateSaved) return;
    const exercises=completedShare.exercises.filter(exercise=>!exercise.skipped).map(exercise=>({exerciseId:exercise.exerciseId,sets:Math.max(1,exercise.sets.length),reps:exercise.repTarget||exercise.sets.find(set=>set.reps)?.reps||"8",group:exercise.group,note:exercise.planNote||exercise.note||""}));
    if (!exercises.length) return;
    const template:Template={id:`template-${Date.now()}`,name:newTemplateName.trim(),focus:"Saved from Add as I go",color:"#409ECE",icon:"◆",exercises,supersetNames:completedShare.supersetNames};
    setData(current=>({...current,templates:[...current.templates,template]}));setSessionTemplateSaved(true);
  }
  function updateSet(exerciseIndex: number, setIndex: number, key: keyof SetLog, value: string | boolean) {
    if (!active) return;
    const exercises = active.exercises.map((exercise, ei) => ei !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.map((set, si) => si !== setIndex ? set : { ...set, [key]: value }) });
    setActive({ ...active, exercises });
    if (key==="done"&&value===true&&exercises[exerciseIndex].sets.every(set=>set.done)) setExpandedLiveExercises(current=>{const next=new Set(current);next.delete(exerciseIndex);return next;});
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
    const normalized = { ...editor, color: editor.color?.toUpperCase() === "#7B61FF" ? "#409ECE" : editor.color };
    setData(current => ({ ...current, templates: current.templates.some(item => item.id === normalized.id) ? current.templates.map(item => item.id === normalized.id ? normalized : item) : [...current.templates, normalized] }));
    setEditor(null);
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
    if (!editor || from===to || from<0 || to<0 || from>=editor.exercises.length || to>=editor.exercises.length) return;
    const exercises=[...editor.exercises];
    const [moved]=exercises.splice(from,1);
    exercises.splice(to,0,moved);
    setEditor({...editor,exercises});
    setDraggedExerciseIndex(null);
  }
  function openSchedule(templateId: string) {
    setScheduleTemplateId(templateId);
    setScheduleDate(today);
    setScheduleRepeat("once");
    setScheduleWeeks(4);
  }
  function scheduleWorkout() {
    if (!scheduleTemplateId) return;
    const intervalDays=scheduleRepeat==="weekly"?7:scheduleRepeat==="fortnightly"?14:0;
    const count=intervalDays?Math.max(1,Math.ceil((scheduleWeeks*7)/intervalDays)):1;
    const dates=Array.from({length:count},(_,index)=>{const date=new Date(`${scheduleDate}T12:00:00`);date.setDate(date.getDate()+index*intervalDays);return date.toISOString().slice(0,10)});
    setData(current=>{
      const additions=dates.filter(date=>!current.scheduled.some(item=>item.date===date&&item.templateId===scheduleTemplateId)).map(date=>({date,templateId:scheduleTemplateId}));
      return {...current,scheduled:[...current.scheduled,...additions]};
    });
    setSelectedDate(scheduleDate);
    setScheduleTemplateId(null);
  }
  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab("today")} aria-label="Go to today"><span className="brand-mark">S</span><span>setra</span></button>
        <button className="avatar" aria-label="Profile">CH</button>
      </header>

      <section className="content">
        {tab === "today" && <>
          <div className="eyebrow">{formatDate(selectedDate).toUpperCase()}</div>
          <div className="page-heading today-heading"><div><h1>{motivation}</h1><p>Your next session is lined up.</p></div><div className="week-score"><strong>2</strong><span>this week</span></div></div>
          <div className="calendar-controls"><button onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()-7);setSelectedDate(date.toISOString().slice(0,10))}}>‹</button><button className="calendar-label" onClick={()=>setCalendarOpen(!calendarOpen)}>{new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric"}).format(new Date(`${selectedDate}T12:00:00`))} <span>{calendarOpen?"⌃":"⌄"}</span></button><button onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+7);setSelectedDate(date.toISOString().slice(0,10))}}>›</button></div>
          {!calendarOpen?<div className="week-strip" aria-label="This week">{weekDays.map(date => {const d=new Date(`${date}T12:00:00`);const completedCount=data.workouts.filter(workout=>workout.date===date).length;const plannedCount=data.scheduled.filter(item=>item.date===date).length;return <button onClick={()=>setSelectedDate(date)} className={`day ${date===selectedDate?"active-day":""}`} key={date}><span>{["S","M","T","W","T","F","S"][d.getDay()]}</span><b>{d.getDate()}</b><span className="day-dots">{Array.from({length:plannedCount},(_,index)=><i className="planned-dot" key={`p-${index}`}/>)}{Array.from({length:completedCount},(_,index)=><i className="completed-dot" key={`c-${index}`}/>)}</span></button>})}</div>:<div className="month-calendar"><div className="month-weekdays">{["M","T","W","T","F","S","S"].map((day,i)=><span key={`${day}-${i}`}>{day}</span>)}</div><div className="month-grid">{monthDays.map(date=>{const d=new Date(`${date}T12:00:00`);const inMonth=d.getMonth()===new Date(`${selectedDate}T12:00:00`).getMonth();const completedCount=data.workouts.filter(workout=>workout.date===date).length;const plannedCount=data.scheduled.filter(item=>item.date===date).length;return <button key={date} className={`${date===selectedDate?"selected-date":""} ${!inMonth?"outside-month":""}`} onClick={()=>{setSelectedDate(date);setCalendarOpen(false)}}><span>{d.getDate()}</span><span className="month-dots">{Array.from({length:plannedCount},(_,index)=><i className="planned-dot" key={`p-${index}`}/>)}{Array.from({length:completedCount},(_,index)=><i className="completed-dot" key={`c-${index}`}/>)}</span></button>})}</div></div>}

          {savedDraft?.date===selectedDate&&<article className="resume-card"><div><span>WORKOUT IN PROGRESS</span><h2>{savedDraft.name}</h2><p>{savedDraft.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0)} of {savedDraft.exercises.reduce((sum,e)=>sum+e.sets.length,0)} sets complete</p></div><button onClick={()=>{setExpandedLiveExercises(new Set());setActive(savedDraft);setSavedDraft(null)}}>Resume →</button></article>}

          {completedWorkouts.length>0&&<section className="completed-today"><span className="completed-heading">{selectedDate===today?"COMPLETED TODAY":"COMPLETED"}</span>{completedWorkouts.map(workout=><button key={workout.id} className="completed-card" onClick={()=>setDetailId(workout.id)}><span className="completed-check">✓</span><span><b>{workout.name}</b><small>{workout.exercises.length} exercises · {workout.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0)} sets completed</small></span><em>View ›</em></button>)}</section>}

          {scheduledTemplates.length>0?scheduledTemplates.map(template=>{const expanded=expandedPlanned.has(template.id);return <article className={`hero-card planned-card ${expanded?"expanded":""}`} key={template.id}>
            <button className="planned-expand" onClick={()=>setExpandedPlanned(current=>{const next=new Set(current);if(next.has(template.id))next.delete(template.id);else next.add(template.id);return next})} aria-label={expanded?"Hide workout exercises":"Show workout exercises"}>{expanded?"⌃":"⌄"}</button>
            <h2>{template.name}</h2><p>{template.focus}</p>
            {expanded&&<div className="exercise-preview">{template.exercises.map((item) => {const groups=[...new Set(template.exercises.map(exercise=>exercise.group).filter(Boolean))];const groupIndex=groups.indexOf(item.group);const defaultName=`Superset ${String.fromCharCode(65+groupIndex)}`;return <div className={item.group?`preview-superset superset-color-${groupIndex%4}`:""} key={item.exerciseId}><b>{exerciseName(item.exerciseId)}</b><em>{item.sets} × {item.reps}</em>{item.group&&<small>{(template.supersetNames?.[item.group]||defaultName).toUpperCase()}</small>}</div>})}</div>}
            {selectedDate===today?<button className="primary-button" disabled={workoutInProgress} onClick={() => startWorkout(template,selectedDate)}>{workoutInProgress?"Workout in progress":"Start workout"} <span>{workoutInProgress?"":"→"}</span></button>:<button className="primary-button" onClick={()=>setEditor(structuredClone(template))}>Edit workout <span>→</span></button>}
          </article>}):<article className="empty-card"><span className="empty-icon">＋</span><h2>No workout planned</h2><p>{selectedDate!==today?"Plan or edit workouts for this day.":workoutInProgress?"Finish your live workout before starting another.":"Choose a template and get moving."}</p><button className="secondary-button" disabled={selectedDate===today&&workoutInProgress} onClick={() => selectedDate===today?setPicker(true):setTab("plan")}>{selectedDate!==today?"View workout plans":workoutInProgress?"Workout in progress":"Choose workout"}</button></article>}

          <div className="section-title"><div><span>LAST SESSION</span><h2>Recent work</h2></div><button onClick={() => setTab("history")}>See all</button></div>
          {latestWorkout && <button className="recent-card" onClick={() => setDetailId(latestWorkout.id)}><span className="recent-date"><b>{new Date(`${latestWorkout.date}T12:00:00`).getDate()}</b>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${latestWorkout.date}T12:00:00`))}</span><span className="recent-main"><b>{latestWorkout.name}</b><small>{latestWorkout.exercises.length} exercises</small></span><span className="chevron">›</span></button>}
        </>}

        {tab === "plan" && <>
          <div className="eyebrow">YOUR PROGRAM</div><div className="page-heading"><div><h1>Workout templates</h1><p>Build once. Train without thinking.</p></div><button className="round-add" onClick={() => setEditor({id:`template-${Date.now()}`,name:"",focus:"",color:"#409ECE",icon:"◆",exercises:[]})}>＋</button></div>
          <div className="template-grid">{data.templates.map((template, index) => <article className="template-card" key={template.id}>
            <div className="template-number template-symbol" style={{background:template.color||["#409ECE","#55B96D","#FF6B6B"][index%3],color:isLightColour(template.color)?"#000000":"#FFFFFF",border:template.color==="#FFFFFF"?"1px solid #E6E9EE":"none"}}>{template.icon||"◆"}</div><div className="template-copy"><span>{template.focus.toUpperCase()}</span><h2>{template.name}</h2><p>{template.exercises.length} exercises · {template.exercises.reduce((s,e)=>s+e.sets,0)} sets</p><div>{template.exercises.slice(0,3).map(item => <small key={item.exerciseId}>{exerciseName(item.exerciseId)}</small>)}</div></div>
            <div className="template-actions"><button disabled={workoutInProgress} onClick={() => startWorkout(template,today)}>{workoutInProgress?"Workout live":"Start today"}</button><button onClick={() => setEditor(structuredClone(template))}>Edit</button><button onClick={() => openSchedule(template.id)}>Schedule</button></div>
          </article>)}</div>
        </>}

        {tab === "history" && <>
          <div className="eyebrow">TRAINING LOG</div><div className="page-heading"><div><h1>Your history</h1><p>Small steps, adding up.</p></div></div>
          <div className="history-tabs"><button className={historyMode==="sessions"?"active":""} onClick={()=>setHistoryMode("sessions")}>By session</button><button className={historyMode==="exercises"?"active":""} onClick={()=>setHistoryMode("exercises")}>By exercise</button></div>
          {historyMode==="sessions"?<div className="history-list">{data.workouts.map(workout => <button key={workout.id} className="history-row" onClick={() => setDetailId(workout.id)}><span className="history-date"><b>{new Date(`${workout.date}T12:00:00`).getDate()}</b><small>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${workout.date}T12:00:00`))}</small></span><span className="history-info"><small>{formatDate(workout.date).split(",")[0].toUpperCase()}</small><b>{workout.name}</b><em>{workout.exercises.length} exercises</em></span><span className="chevron">›</span></button>)}</div>:<><label className="search"><span>⌕</span><input value={libraryQuery} onChange={event=>setLibraryQuery(event.target.value)} placeholder="Search exercise history" /></label><div className="library-list">{data.exercises.filter(exercise=>data.workouts.some(workout=>workout.exercises.some(item=>item.exerciseId===exercise.id))&&exercise.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(exercise=>{const sessions=data.workouts.filter(workout=>workout.exercises.some(item=>item.exerciseId===exercise.id));return <button className="library-row" key={exercise.id} onClick={()=>setExerciseHistoryId(exercise.id)}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>{sessions.length} sessions</em><span className="chevron">›</span></button>})}</div></>}
        </>}

        {tab === "pbs" && <>
          <div className="eyebrow">PERSONAL BESTS</div><div className="page-heading"><div><h1>Your PBs</h1><p>Your strongest recorded sets, all in one place.</p></div><div className="pb-count"><strong>{personalBests.length}</strong><span>records</span></div></div>
          <div className="pb-list">{personalBests.map(({exercise,best},index)=><button key={exercise.id} onClick={()=>setExerciseHistoryId(exercise.id)}><span className={`pb-medal pb-${index%3}`}>{index+1}</span><span className="pb-info"><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><span className="pb-result"><b>{best.set.weight} kg</b><small>{best.set.reps} reps · {formatDate(best.workout.date)}</small></span><span className="chevron">›</span></button>)}</div>
        </>}

        {tab === "library" && <>
          <div className="eyebrow">MOVEMENT LIBRARY</div><div className="page-heading"><div><h1>Exercises</h1><p>Your complete movement index.</p></div><button className="round-add" onClick={() => { const name=prompt("Exercise name"); if(name) setData(c=>({...c,exercises:[...c.exercises,{id:`exercise-${Date.now()}`,name,group:"Other",equipment:"Other"}]})); }}>＋</button></div>
          <label className="search"><span>⌕</span><input value={libraryQuery} onChange={event=>setLibraryQuery(event.target.value)} placeholder="Search exercises" /></label>
          <div className="library-list">{data.exercises.filter(exercise => exercise.name.toLowerCase().includes(libraryQuery.toLowerCase())).map(exercise => {
            const sessions = data.workouts.filter(workout => workout.exercises.some(item => item.exerciseId === exercise.id));
            return <button key={exercise.id} className="library-row" onClick={() => setExerciseHistoryId(exercise.id)}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.group} · {exercise.equipment}</small></span><em>{sessions.length ? `${sessions.length} sessions` : "No history"}</em><span className="chevron">›</span></button>
          })}</div>
        </>}
      </section>

      <nav className="bottom-nav" aria-label="Main navigation">{([
        ["today","⌂","Today"],["plan","▤","Plan"],["history","↗","History"],["pbs","★","PBs"]
      ] as [Tab,string,string][]).map(([id,icon,label]) => <button key={id} className={tab===id?"selected":""} onClick={()=>setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>

      {picker && <div className="overlay" onMouseDown={()=>setPicker(false)}><section className="sheet picker-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>CHOOSE A SESSION</span><h2>What are we training?</h2></div><button onClick={()=>setPicker(false)}>×</button></div><button className="picker-row blank-workout-row" disabled={workoutInProgress} onClick={startBlankWorkout}><span className="blank-workout-icon">＋</span><span><b>Add as I go</b><small>{workoutInProgress?"Finish your live workout first":"Start blank and add exercises during your session"}</small></span><em>{workoutInProgress?"Unavailable":"Start →"}</em></button>{data.templates.map(template=><button className="picker-row" disabled={workoutInProgress} key={template.id} onClick={()=>startWorkout(template)}><span><b>{template.name}</b><small>{template.focus} · {template.exercises.length} exercises</small></span><em>{workoutInProgress?"Unavailable":"Start →"}</em></button>)}</section></div>}

      {scheduleTemplateId && <div className="overlay high-overlay" onMouseDown={()=>setScheduleTemplateId(null)}><section className="sheet schedule-sheet" onMouseDown={event=>event.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>SCHEDULE WORKOUT</span><h2>{data.templates.find(template=>template.id===scheduleTemplateId)?.name}</h2></div><button onClick={()=>setScheduleTemplateId(null)} aria-label="Close">×</button></div><label className="schedule-field">START DATE<input type="date" value={scheduleDate} min={today} onChange={event=>setScheduleDate(event.target.value)}/></label><fieldset className="repeat-options"><legend>REPEAT</legend>{([['once','Once'],['weekly','Weekly'],['fortnightly','Fortnightly']] as const).map(([value,label])=><button type="button" key={value} className={scheduleRepeat===value?'selected':''} onClick={()=>setScheduleRepeat(value)}>{label}</button>)}</fieldset>{scheduleRepeat!=="once"&&<label className="schedule-field">SCHEDULE FOR<select value={scheduleWeeks} onChange={event=>setScheduleWeeks(Number(event.target.value))}>{[2,4,6,8,12,16,24,52].map(weeks=><option value={weeks} key={weeks}>{weeks} weeks</option>)}</select></label>}<p className="schedule-summary">{scheduleRepeat==="once"?`Scheduled once on ${formatDate(scheduleDate)}.`:`Schedules ${scheduleRepeat} from ${formatDate(scheduleDate)} for ${scheduleWeeks} weeks.`}</p><button className="primary-button schedule-confirm" onClick={scheduleWorkout}>Add to plan <span>→</span></button></section></div>}

      {active && <div className="workout-screen">
        <header className="workout-header live-header"><button className="view-app-button" onClick={editingWorkoutId?()=>{setActive(null);setEditingWorkoutId(null)}:saveDraft} aria-label={editingWorkoutId?"Close workout editor":"Save workout and view other workouts"}>‹</button><div><small>{editingWorkoutId?"EDIT WORKOUT":"LIVE WORKOUT"}</small><b>{active.name}</b></div><button className="save-draft-button" onClick={editingWorkoutId?()=>saveWorkout():saveDraft}>Save</button><button className="finish-button" onClick={editingWorkoutId?()=>saveWorkout():openFinishDialog}>{editingWorkoutId?"Update":"Finish"}</button></header>
        {(()=>{const included=active.exercises.filter(exercise=>!exercise.skipped);const completed=included.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0);const total=included.reduce((sum,exercise)=>sum+exercise.sets.length,0);return <div className="live-progress"><span>{completed} / {total} sets</span><div><i style={{width:`${total?100*completed/total:0}%`}} /></div></div>})()}
        <div className="workout-body">{active.exercises.map((exercise, exerciseIndex) => { const prev = previousSets(exercise.exerciseId); const groupIndex=[...new Set(active.exercises.map(item=>item.group).filter(Boolean))].indexOf(exercise.group);const allDone=exercise.sets.length>0&&exercise.sets.every(set=>set.done);const minimized=(exercise.skipped||allDone)&&!expandedLiveExercises.has(exerciseIndex);return <article className={`live-exercise ${exercise.group ? `superset-exercise superset-color-${groupIndex%4}` : ""} ${exercise.skipped?"skipped-exercise":""} ${minimized?"minimized-exercise":""}`} key={`${exercise.exerciseId}-${exerciseIndex}`}>
          {minimized?<button className="minimized-exercise-row" onClick={()=>setExpandedLiveExercises(current=>new Set(current).add(exerciseIndex))}><span className="minimized-status">{exercise.skipped?"—":"✓"}</span><span><b>{exerciseName(exercise.exerciseId)}</b><small>{exercise.skipped?"Skipped for today":`${exercise.sets.length} sets completed`}</small></span><em>Open ⌄</em></button>:<>
          {exercise.group && <span className="superset-badge">{(active.supersetNames?.[exercise.group]||`Superset ${String.fromCharCode(65+groupIndex)}`).toUpperCase()}</span>}<div className="live-exercise-title"><div><span>{String(exerciseIndex+1).padStart(2,"0")}</span><h2>{exerciseName(exercise.exerciseId)}</h2></div><div className="exercise-title-actions"><label className="load-mode"><span>Load</span><select aria-label={`Load entry type for ${exerciseName(exercise.exerciseId)}`} value={exercise.loadMode||"kg"} onChange={event=>updateWorkoutExercise(exerciseIndex,{loadMode:event.target.value as "kg"|"text",sets:exercise.sets.map(set=>({...set,weight:""}))})}><option value="kg">KG</option><option value="text">Text</option></select></label><button onClick={()=>setExerciseHistoryId(exercise.exerciseId)}>History</button><button className="manage-exercise" onClick={()=>setLiveEditIndex(exerciseIndex)} aria-label={`Edit ${exerciseName(exercise.exerciseId)}`}>•••</button></div></div>
          {(exercise.skipped||allDone)&&<div className="exercise-state-actions"><button onClick={()=>setExpandedLiveExercises(current=>{const next=new Set(current);next.delete(exerciseIndex);return next})}>Minimise ↑</button></div>}
          <div className="set-head"><span>SET</span><span>PREVIOUS</span><span>{exercise.loadMode==="text"?"TEXT":"KG"}</span><span>REPS</span><span>RPE</span><span /></div>
          {exercise.sets.map((set,setIndex)=><div className={`set-row ${set.done?"complete":""}`} key={setIndex}><b>{setIndex+1}</b><small>{prev[setIndex] ? `${prev[setIndex].weight} × ${prev[setIndex].reps}` : "—"}</small><input aria-label={`Set ${setIndex+1} ${exercise.loadMode==="text"?"text load":"weight"}`} inputMode={exercise.loadMode==="text"?"text":"decimal"} maxLength={exercise.loadMode==="text"?12:undefined} value={set.weight} placeholder={exercise.loadMode==="text"?"Band / level":prev[setIndex]?.weight||"0"} onChange={e=>updateSet(exerciseIndex,setIndex,"weight",exercise.loadMode==="text"?e.target.value.slice(0,12):e.target.value)}/><input aria-label={`Set ${setIndex+1} reps`} inputMode="numeric" value={set.reps} placeholder={exercise.repTarget||prev[setIndex]?.reps||"0"} onChange={e=>updateSet(exerciseIndex,setIndex,"reps",e.target.value)}/><input aria-label={`Set ${setIndex+1} RPE`} inputMode="decimal" value={set.rpe} placeholder="—" onChange={e=>updateSet(exerciseIndex,setIndex,"rpe",e.target.value)}/><button aria-label={`Complete set ${setIndex+1}`} onClick={()=>updateSet(exerciseIndex,setIndex,"done",!set.done)}>{set.done?"✓":""}</button></div>)}
          <div className="set-actions"><button className="add-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:[...item.sets,makeSet()]}:item)})}>＋ Add set</button>{exercise.sets.length>1&&<button className="remove-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:item.sets.slice(0,-1)}:item)})}>− Remove last set</button>}</div></>}
        </article>})}<button className="add-live-exercise" onClick={()=>{setLiveAddQuery("");setLiveAddOpen(true)}}><span>＋</span><div><b>Add exercise</b><small>Add another movement to this session</small></div><em>→</em></button><label className="workout-note">SESSION NOTE<textarea value={active.note} onChange={e=>setActive({...active,note:e.target.value})} placeholder="How did it feel? Anything to remember?" /></label></div>
      </div>}

      {active&&finishDialogOpen&&<div className="overlay high-overlay finish-time-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setFinishDialogOpen(false)}}><section className="finish-time-dialog" role="dialog" aria-modal="true" aria-labelledby="finish-time-title"><button className="finish-time-close" onClick={()=>setFinishDialogOpen(false)} aria-label="Close">×</button><span>FINISH WORKOUT</span><h2 id="finish-time-title">Confirm session time</h2><p>{formatDate(active.date)} · {active.name}</p><div className="session-time-fields"><label>START TIME<input type="time" value={sessionStartTime} onChange={event=>setSessionStartTime(event.target.value)}/></label><label>FINISH TIME<input type="time" value={sessionFinishTime} onChange={event=>setSessionFinishTime(event.target.value)}/></label></div><button className="primary-button" disabled={!sessionStartTime||!sessionFinishTime} onClick={()=>saveWorkout({startedAt:sessionStartTime,endedAt:sessionFinishTime})}>Finish workout <span>✓</span></button></section></div>}

      {newPBs.length>0&&<div className="overlay high-overlay pb-overlay"><section className="sheet pb-celebration"><button className="pb-close" onClick={()=>setNewPBs([])} aria-label="Close">×</button><small>NEW PERSONAL BEST</small><h2>Make it share-worthy</h2>{newPBs.length>1&&<div className="pb-record-selector">{newPBs.map((pb,index)=><button className={selectedPBIndex===index?"selected":""} key={pb.exerciseId} onClick={()=>setSelectedPBIndex(index)}>{pb.name}</button>)}</div>}{(()=>{const pb=newPBs[selectedPBIndex]||newPBs[0];const previewColour=pbTileStyle==="colour"?(isLightColour(pbColour)?"#000000":"#FFFFFF"):pbColour;return <div className={`pb-tile-preview ${pbTileStyle}`} style={pbTileStyle==="colour"?{background:pbColour,color:previewColour}:{color:previewColour}}><span className="pb-preview-graphic" style={{WebkitMaskPosition:`${pbGraphic*20}% 50%`,maskPosition:`${pbGraphic*20}% 50%`}}/><b>NEW PB</b><span className="pb-exercise-name">{pb.name}</span><strong>{pb.weight} kg</strong><span className="pb-reps">× {pb.reps||"—"} reps</span><em>setra</em></div>})()}<div className="pb-customise"><span>STYLE</span><div className="pb-style-options"><button className={pbTileStyle==="colour"?"selected":""} onClick={()=>setPbTileStyle("colour")}><i className="colour-swatch"/><b>Colour tile</b></button><button className={pbTileStyle==="transparent"?"selected":""} onClick={()=>setPbTileStyle("transparent")}><i className="transparent-swatch"/><b>Transparent</b></button></div><span>COLOUR</span><div className="pb-colour-options">{setraColours.map(colour=><button key={colour.value} className={pbColour===colour.value?"selected":""} aria-label={colour.name} title={colour.name} style={{background:colour.value}} onClick={()=>setPbColour(colour.value)}/>)}</div><span>GRAPHIC</span><div className="pb-graphic-options">{pbGraphics.map(graphic=><button key={graphic.name} className={pbGraphic===graphic.index?"selected":""} onClick={()=>setPbGraphic(graphic.index)}><b className="pb-option-graphic" style={{WebkitMaskPosition:`${graphic.index*20}% 50%`,maskPosition:`${graphic.index*20}% 50%`}}/><small>{graphic.name}</small></button>)}</div></div><div className="pb-share-actions"><button onClick={savePBImage}>Save image</button><button className="primary-share" onClick={sharePBImage}>Share image ↑</button></div>{pbShareMessage&&<small className="pb-share-message">{pbShareMessage}</small>}</section></div>}
      {completedShare&&<div className="overlay high-overlay session-share-overlay"><section className="session-share-dialog" role="dialog" aria-modal="true"><button className="pb-close" onClick={()=>setCompletedShare(null)} aria-label="Close">×</button><small>SESSION COMPLETE</small><h2>Share the work</h2><div className="session-share-tile" style={{background:sessionShareColour,color:isLightColour(sessionShareColour)?"#000000":"#FFFFFF",border:sessionShareColour==="#FFFFFF"?"1px solid #E6E9EE":"none"}}><span className="session-share-check" style={{background:isLightColour(sessionShareColour)?"#000000":"#FFFFFF",color:sessionShareColour}}>✓</span><b>WORKOUT COMPLETE</b><span>{formatLongDate(completedShare.date)}</span><em>{formatSessionDuration(completedShare.startedAt,completedShare.endedAt)}</em><p>{completedShare.exercises.filter(exercise=>!exercise.skipped).length} exercises · {completedShare.exercises.reduce((sum,exercise)=>sum+exercise.sets.filter(set=>set.done).length,0)} sets</p><footer>setra</footer></div><div className="session-colour-picker"><span>COLOUR</span><div className="pb-colour-options">{setraColours.map(colour=><button key={colour.value} className={sessionShareColour===colour.value?"selected":""} aria-label={colour.name} title={colour.name} style={{background:colour.value}} onClick={()=>setSessionShareColour(colour.value)}/>)}</div></div><div className="pb-share-actions"><button onClick={saveSessionImage}>Save</button><button className="primary-share" onClick={shareSessionImage}>Share</button></div>{sessionShareMessage&&<small className="pb-share-message">{sessionShareMessage}</small>}{!completedShare.templateId&&<div className="save-session-template"><span>SAVE FOR NEXT TIME</span><p>Turn this Add as I go session into a reusable workout.</p><input value={newTemplateName} disabled={sessionTemplateSaved} onChange={event=>setNewTemplateName(event.target.value)} maxLength={40} placeholder="Template name"/><button disabled={!newTemplateName.trim()||sessionTemplateSaved||completedShare.exercises.length===0} onClick={saveSessionAsTemplate}>{sessionTemplateSaved?"Added to templates ✓":"Add as template"}</button></div>}</section></div>}

      {detail && <div className="overlay" onMouseDown={()=>setDetailId(null)}><section className="sheet detail-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{formatDate(detail.date).toUpperCase()}</span><h2>{detail.name}</h2></div><div className="detail-title-actions"><button className="edit-workout-button" onClick={()=>{setEditingWorkoutId(detail.id);setActive(structuredClone(detail));setDetailId(null)}}>Edit</button><button onClick={()=>setDetailId(null)} aria-label="Close">×</button></div></div>{detail.exercises.map(exercise=><button className="detail-exercise" key={exercise.exerciseId} onClick={()=>setExerciseHistoryId(exercise.exerciseId)}><span><b>{exerciseName(exercise.exerciseId)}</b><small>{exercise.sets.filter(s=>s.done).length} working sets</small></span><div>{exercise.sets.map((set,i)=><small key={i}>{set.weight || "—"} kg × {set.reps || "—"} {set.rpe&&`@ ${set.rpe}`}</small>)}</div><em>›</em></button>)}{detail.note&&<p className="detail-note">“{detail.note}”</p>}<button className="delete-workout-button" onClick={()=>setDeleteWorkoutId(detail.id)}>Delete workout</button></section></div>}
      {deleteWorkoutId && <div className="overlay high-overlay confirm-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteWorkoutId(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-workout-title"><span className="confirm-icon">!</span><h2 id="delete-workout-title">Delete this workout?</h2><p>This will permanently remove the completed workout and its exercise history.</p><div className="confirm-actions"><button onClick={()=>setDeleteWorkoutId(null)}>Cancel</button><button className="confirm-delete" onClick={deleteCompletedWorkout}>Delete workout</button></div></section></div>}
      {deleteTemplateId && <div className="overlay high-overlay confirm-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setDeleteTemplateId(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-template-title"><span className="confirm-icon">!</span><h2 id="delete-template-title">Delete this template?</h2><p>This will remove the template and any workouts scheduled from it. Completed workout history will stay untouched.</p><div className="confirm-actions"><button onClick={()=>setDeleteTemplateId(null)}>Cancel</button><button className="confirm-delete" onClick={deleteTemplate}>Delete template</button></div></section></div>}

      {active && liveEditIndex !== null && active.exercises[liveEditIndex] && <div className="overlay high-overlay" onMouseDown={()=>setLiveEditIndex(null)}><section className="sheet live-edit-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>EDIT LIVE SESSION</span><h2>{exerciseName(active.exercises[liveEditIndex].exerciseId)}</h2></div><button onClick={()=>setLiveEditIndex(null)}>×</button></div><div className="live-edit-actions"><button disabled={liveEditIndex===0} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex-1)}><b>↑</b><span>Move earlier</span></button><button disabled={liveEditIndex===active.exercises.length-1} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex+1)}><b>↓</b><span>Move later</span></button>{active.exercises[liveEditIndex].group?<button className="ungroup-action" onClick={()=>ungroupLiveExercise(liveEditIndex)}><b>⊘</b><span>Remove from superset</span></button>:<button disabled={active.exercises.length<2} onClick={()=>groupLiveExercise(liveEditIndex,liveEditIndex>0?liveEditIndex-1:1)}><b>⇄</b><span>Superset with {liveEditIndex>0?"previous":"next"}</span></button>}<button className="skip-menu-action" onClick={()=>{toggleExerciseSkipped(liveEditIndex);setLiveEditIndex(null)}}><b>{active.exercises[liveEditIndex].skipped?"↩":"—"}</b><span>{active.exercises[liveEditIndex].skipped?"Unskip exercise":"Skip for today"}</span></button></div><div className="replace-heading"><span>CHANGE EXERCISE</span><p>Your completed and entered sets will be kept.</p></div><div className="replace-list">{data.exercises.filter(exercise=>exercise.id!==active.exercises[liveEditIndex].exerciseId).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:active.exercises.map((item,index)=>index===liveEditIndex?{...item,exerciseId:exercise.id}:item)});setLiveEditIndex(null)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.group} · {exercise.equipment}</small></span><em>Replace</em></button>)}</div></section></div>}

      {active && liveAddOpen && <div className="overlay high-overlay" onMouseDown={()=>setLiveAddOpen(false)}><section className="sheet add-exercise-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>LIVE SESSION</span><h2>Add an exercise</h2></div><button onClick={()=>setLiveAddOpen(false)}>×</button></div><label className="search"><span>⌕</span><input autoFocus value={liveAddQuery} onChange={event=>setLiveAddQuery(event.target.value)} placeholder="Search exercise, equipment or muscle" /></label><div className="replace-list">{data.exercises.filter(exercise=>!active.exercises.some(item=>item.exerciseId===exercise.id)&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(liveAddQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:[...active.exercises,{exerciseId:exercise.id,note:"",loadMode:"kg",sets:Array.from({length:3},()=>makeSet("8"))}]});setLiveAddOpen(false)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></section></div>}

      {historyExercise && <div className="overlay high-overlay" onMouseDown={()=>setExerciseHistoryId(null)}><section className="sheet history-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{historyExercise.group.toUpperCase()} · {historyExercise.equipment.toUpperCase()}</span><h2>{historyExercise.name}</h2></div><button onClick={()=>setExerciseHistoryId(null)}>×</button></div>{(() => { const records=data.workouts.flatMap(w=>w.exercises.filter(e=>e.exerciseId===historyExercise.id).map(e=>({workout:w,exercise:e}))); const maxes=records.map(r=>Math.max(...r.exercise.sets.map(s=>Number(s.weight)||0))); return <>{records.length>0&&<div className="progress-chart"><div className="chart-bars">{maxes.slice().reverse().map((max,i)=><i key={i} style={{height:`${25+70*max/Math.max(...maxes)}%`}}><span>{max}</span></i>)}</div><small>Best load by session (kg)</small></div>}<div className="exercise-records">{records.length?records.map(({workout,exercise})=><div key={workout.id}><span><b>{formatDate(workout.date)}</b><small>{workout.name}</small></span><p>{exercise.sets.map((set,i)=><em key={i}>{set.weight || "—"} × {set.reps || "—"}<small>{set.rpe&&` RPE ${set.rpe}`}</small></em>)}</p></div>):<p className="no-records">No completed sets yet. Start a workout to build your history.</p>}</div></>})()}</section></div>}

      {editor && <div className="editor-screen">
        <header className="workout-header"><button onClick={()=>setEditor(null)}>×</button><div><small>WORKOUT BUILDER</small><b>{editor.id.startsWith("template-")?"New template":"Edit template"}</b></div><button className="finish-button" onClick={saveTemplate}>Save</button></header>
        <div className="editor-body">
          <label>WORKOUT NAME<input value={editor.name} onChange={event=>setEditor({...editor,name:event.target.value})} placeholder="e.g. Lower B" /></label>
          <label>FOCUS<input value={editor.focus} onChange={event=>setEditor({...editor,focus:event.target.value})} placeholder="e.g. Hinge + single-leg" /></label>
          <div className="template-style-picker"><span>TEMPLATE STYLE</span><div className="style-preview" style={{background:editor.color||"#409ECE",color:isLightColour(editor.color)?"#000000":"#FFFFFF",border:editor.color==="#FFFFFF"?"1px solid #E6E9EE":"none"}}>{editor.icon||"◆"}</div><div><small>COLOUR</small><div className="color-options">{setraColours.map(colour=><button aria-label={`Choose ${colour.name}`} title={colour.name} className={editor.color===colour.value?"selected":""} style={{background:colour.value}} key={colour.value} onClick={()=>setEditor({...editor,color:colour.value})}/>)}</div><small>ICON</small><div className="icon-options">{["◆","✦","↗","●","▲","≈","＋","◇"].map(icon=><button className={editor.icon===icon?"selected":""} key={icon} onClick={()=>setEditor({...editor,icon})}>{icon}</button>)}</div></div></div>
          <div className="editor-exercises"><span>EXERCISES</span>{editor.exercises.map((item,index)=>{
            const groups=[...new Set(editor.exercises.map(exercise=>exercise.group).filter((group):group is string=>Boolean(group)))];
            const groupIndex=item.group?groups.indexOf(item.group):-1;
            const firstInGroup=Boolean(item.group)&&editor.exercises.findIndex(exercise=>exercise.group===item.group)===index;
            const fallbackName=`Superset ${String.fromCharCode(65+groupIndex)}`;
            return <div draggable className={`${item.group?`grouped-editor-exercise superset-color-${groupIndex%4}`:""} ${draggedExerciseIndex===index?"dragging-exercise":""}`} key={`${item.exerciseId}-${index}`} onDragStart={event=>{setDraggedExerciseIndex(index);event.dataTransfer.effectAllowed="move"}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move"}} onDrop={event=>{event.preventDefault();if(draggedExerciseIndex!==null)reorderTemplateExercise(draggedExerciseIndex,index)}} onDragEnd={()=>setDraggedExerciseIndex(null)}>
              <span className="drag-handle" aria-hidden="true">⋮⋮</span>
              <b>{exerciseName(item.exerciseId)}</b>
              <label>Sets<input inputMode="numeric" value={item.sets} onChange={event=>setEditor({...editor,exercises:editor.exercises.map((exercise,exerciseIndex)=>exerciseIndex===index?{...exercise,sets:Number(event.target.value)}:exercise)})}/></label>
              <label>Reps<input value={item.reps} onChange={event=>setEditor({...editor,exercises:editor.exercises.map((exercise,exerciseIndex)=>exerciseIndex===index?{...exercise,reps:event.target.value}:exercise)})}/></label>
              <button className="remove-template-exercise" onClick={()=>removeTemplateExercise(index)} aria-label={`Remove ${exerciseName(item.exerciseId)}`}>×</button>
              {item.group&&<small className="editor-superset-label">{(editor.supersetNames?.[item.group]||fallbackName).toUpperCase()}</small>}
              {firstInGroup&&item.group&&<label className="superset-name-input">SUPERSET NAME (OPTIONAL)<input maxLength={30} value={editor.supersetNames?.[item.group]||""} placeholder={fallbackName} onChange={event=>setEditor({...editor,supersetNames:{...editor.supersetNames,[item.group!]:event.target.value}})}/></label>}
              {index>0&&<button className={`superset-toggle ${item.group?"active":""}`} onClick={()=>toggleSuperset(index)}>{item.group?"✓ Remove from superset":"⊕ Group with exercise above"}</button>}
            </div>;
          })}</div>
          <div className="exercise-picker"><span>ADD EXERCISE</span><label className="search"><span>⌕</span><input value={editorQuery} onChange={event=>setEditorQuery(event.target.value)} placeholder="Search by exercise, equipment or muscle" /></label><div className="editor-library-list">{data.exercises.filter(exercise=>!editor.exercises.some(item=>item.exerciseId===exercise.id)&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(editorQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>setEditor({...editor,exercises:[...editor.exercises,{exerciseId:exercise.id,sets:3,reps:"8"}]})}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></div>
          {data.templates.some(template=>template.id===editor.id)&&<button className="delete-template-button" onClick={()=>setDeleteTemplateId(editor.id)}>Delete template</button>}
        </div>
      </div>}
    </main>
  );
}
