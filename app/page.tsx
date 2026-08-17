"use client";

import { useEffect, useMemo, useState } from "react";

type Tab = "today" | "plan" | "history" | "pbs" | "library";
type Exercise = { id: string; name: string; group: string; equipment: string };
type TemplateExercise = { exerciseId: string; sets: number; reps: string; group?: string };
type Template = { id: string; name: string; focus: string; exercises: TemplateExercise[]; color?: string; icon?: string };
type SetLog = { reps: string; weight: string; rpe: string; done: boolean };
type WorkoutExercise = { exerciseId: string; sets: SetLog[]; note: string; group?: string };
type Workout = { id: string; templateId?: string; name: string; date: string; startedAt: string; duration: number; exercises: WorkoutExercise[]; note: string };
type AppData = { exercises: Exercise[]; templates: Template[]; workouts: Workout[]; scheduled: { date: string; templateId: string }[] };

const today = new Date().toISOString().slice(0, 10);
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

const makeSet = (reps = ""): SetLog => ({ reps, weight: "", rpe: "", done: false });
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
const motivations = ["Ready when you are.","Built today for what’s next.","A little stronger every session.","Show up. The rest follows.","Today’s work becomes tomorrow’s strength.","Your next strong session starts here.","Progress is waiting for you.","Train today. See further."];
const formatDate = (value: string) => new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));

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
  const [exerciseHistoryId, setExerciseHistoryId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Template | null>(null);
  const [picker, setPicker] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [editorQuery, setEditorQuery] = useState("");
  const [historyMode, setHistoryMode] = useState<"sessions" | "exercises">("sessions");
  const [selectedDate, setSelectedDate] = useState(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [motivation, setMotivation] = useState(motivations[0]);

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
  const scheduledTemplate = data.templates.find(template => template.id === data.scheduled.find(item => item.date === selectedDate)?.templateId);
  const latestWorkout = data.workouts[0];
  const detail = data.workouts.find(workout => workout.id === detailId);
  const historyExercise = data.exercises.find(exercise => exercise.id === exerciseHistoryId);
  const weekDays = useMemo(() => { const base=new Date(`${selectedDate}T12:00:00`); const monday=new Date(base); monday.setDate(base.getDate()-((base.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const day=new Date(monday);day.setDate(monday.getDate()+i);return day.toISOString().slice(0,10)}); },[selectedDate]);
  const monthDays = useMemo(() => { const base=new Date(`${selectedDate}T12:00:00`); const first=new Date(base.getFullYear(),base.getMonth(),1,12); const start=new Date(first);start.setDate(1-((first.getDay()+6)%7));return Array.from({length:42},(_,i)=>{const day=new Date(start);day.setDate(start.getDate()+i);return day.toISOString().slice(0,10)}); },[selectedDate]);
  const personalBests = useMemo(() => data.exercises.map(exercise => { const attempts=data.workouts.flatMap(workout=>workout.exercises.filter(item=>item.exerciseId===exercise.id).flatMap(item=>item.sets.map(set=>({set,workout})))); const best=attempts.sort((a,b)=>(Number(b.set.weight)||0)-(Number(a.set.weight)||0))[0]; return best&&Number(best.set.weight)>0?{exercise,best}:null; }).filter(Boolean) as {exercise:Exercise;best:{set:SetLog;workout:Workout}}[],[data]);

  const previousSets = (exerciseId: string) => data.workouts.find(workout => workout.exercises.some(exercise => exercise.exerciseId === exerciseId))?.exercises.find(exercise => exercise.exerciseId === exerciseId)?.sets ?? [];

  function startWorkout(template: Template) {
    setActive({ id: `workout-${Date.now()}`, templateId: template.id, name: template.name, date: selectedDate, startedAt: "", duration: 0, note: "", exercises: template.exercises.map(item => ({ exerciseId: item.exerciseId, group: item.group, note: "", sets: Array.from({ length: item.sets }, () => makeSet(item.reps.replace(/\D/g, ""))) })) });
    setPicker(false);
  }
  function saveDraft() {
    if (!active) return;
    localStorage.setItem("form-active-workout", JSON.stringify(active));
    setSavedDraft(active); setActive(null); setTab("today");
  }
  function discardActive() {
    if (!confirm("Discard this workout?")) return;
    localStorage.removeItem("form-active-workout"); setSavedDraft(null); setActive(null);
  }
  function saveWorkout() {
    if (!active) return;
    const completed = { ...active, duration: 0 };
    setData(current => ({ ...current, workouts: [completed, ...current.workouts], scheduled: current.scheduled.filter(item => item.date !== active.date) }));
    localStorage.removeItem("form-active-workout"); setSavedDraft(null); setActive(null); setTab("history"); setDetailId(completed.id);
  }
  function updateSet(exerciseIndex: number, setIndex: number, key: keyof SetLog, value: string | boolean) {
    if (!active) return;
    const exercises = active.exercises.map((exercise, ei) => ei !== exerciseIndex ? exercise : { ...exercise, sets: exercise.sets.map((set, si) => si !== setIndex ? set : { ...set, [key]: value }) });
    setActive({ ...active, exercises });
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
    if (exercises[index].group) {
      const oldGroup = exercises[index].group;
      delete exercises[index].group;
      if (exercises.filter(item => item.group === oldGroup).length < 2) exercises.forEach(item => { if (item.group === oldGroup) delete item.group; });
    } else {
      const group = exercises[index - 1].group || `superset-${Date.now()}`;
      exercises[index - 1].group = group; exercises[index].group = group;
    }
    setEditor({ ...editor, exercises });
  }
  function schedule(templateId: string) {
    setData(current => ({ ...current, scheduled: [...current.scheduled.filter(item => item.date !== selectedDate), { date: selectedDate, templateId }] }));
    setPicker(false); setTab("today");
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
          <div className="page-heading"><div><h1>{motivation}</h1><p>Your next session is lined up.</p></div><div className="week-score"><strong>2</strong><span>this week</span></div></div>
          <div className="calendar-controls"><button onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()-7);setSelectedDate(date.toISOString().slice(0,10))}}>‹</button><button className="calendar-label" onClick={()=>setCalendarOpen(!calendarOpen)}>{new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric"}).format(new Date(`${selectedDate}T12:00:00`))} <span>{calendarOpen?"⌃":"⌄"}</span></button><button onClick={()=>{const date=new Date(`${selectedDate}T12:00:00`);date.setDate(date.getDate()+7);setSelectedDate(date.toISOString().slice(0,10))}}>›</button></div>
          {!calendarOpen?<div className="week-strip" aria-label="This week">{weekDays.map(date => {const d=new Date(`${date}T12:00:00`);const trained=data.workouts.some(workout=>workout.date===date);const planned=data.scheduled.some(item=>item.date===date);return <button onClick={()=>setSelectedDate(date)} className={`day ${date===selectedDate?"active-day":""} ${trained?"trained":""} ${planned?"planned-day":""}`} key={date}><span>{["S","M","T","W","T","F","S"][d.getDay()]}</span><b>{d.getDate()}</b><i /></button>})}</div>:<div className="month-calendar"><div className="month-weekdays">{["M","T","W","T","F","S","S"].map((day,i)=><span key={`${day}-${i}`}>{day}</span>)}</div><div className="month-grid">{monthDays.map(date=>{const d=new Date(`${date}T12:00:00`);const inMonth=d.getMonth()===new Date(`${selectedDate}T12:00:00`).getMonth();const trained=data.workouts.some(workout=>workout.date===date);const planned=data.scheduled.some(item=>item.date===date);return <button key={date} className={`${date===selectedDate?"selected-date":""} ${!inMonth?"outside-month":""}`} onClick={()=>{setSelectedDate(date);setCalendarOpen(false)}}><span>{d.getDate()}</span>{(trained||planned)&&<i className={trained?"trained-dot":"planned-dot"}/>}</button>})}</div></div>}

          {scheduledTemplate ? <article className="hero-card">
            <div className="card-top"><span className="status-pill"><i /> PLANNED</span><button className="icon-button" onClick={() => setPicker(true)} aria-label="Change planned workout">•••</button></div>
            <h2>{scheduledTemplate.name}</h2><p>{scheduledTemplate.focus}</p>
            <div className="exercise-preview">{scheduledTemplate.exercises.map((item) => {const groups=[...new Set(scheduledTemplate.exercises.map(exercise=>exercise.group).filter(Boolean))];const groupIndex=groups.indexOf(item.group);return <div className={item.group?`preview-superset superset-color-${groupIndex%4}`:""} key={item.exerciseId}><b>{exerciseName(item.exerciseId)}</b><em>{item.sets} × {item.reps}</em>{item.group&&<small>SUPERSET {String.fromCharCode(65+groupIndex)}</small>}</div>})}</div>
            <button className="primary-button" onClick={() => startWorkout(scheduledTemplate)}>Start workout <span>→</span></button>
          </article> : <article className="empty-card"><span className="empty-icon">＋</span><h2>No workout planned</h2><p>Choose a template and get moving.</p><button className="secondary-button" onClick={() => setPicker(true)}>Choose workout</button></article>}

          {savedDraft && <article className="resume-card"><div><span>WORKOUT SAVED</span><h2>{savedDraft.name}</h2><p>{savedDraft.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0)} of {savedDraft.exercises.reduce((sum,e)=>sum+e.sets.length,0)} sets complete</p></div><button onClick={()=>{setActive(savedDraft);setSavedDraft(null)}}>Resume →</button></article>}

          <div className="section-title"><div><span>LAST SESSION</span><h2>Recent work</h2></div><button onClick={() => setTab("history")}>See all</button></div>
          {latestWorkout && <button className="recent-card" onClick={() => setDetailId(latestWorkout.id)}><span className="recent-date"><b>{new Date(`${latestWorkout.date}T12:00:00`).getDate()}</b>{new Intl.DateTimeFormat("en",{month:"short"}).format(new Date(`${latestWorkout.date}T12:00:00`))}</span><span className="recent-main"><b>{latestWorkout.name}</b><small>{latestWorkout.exercises.length} exercises</small></span><span className="chevron">›</span></button>}
        </>}

        {tab === "plan" && <>
          <div className="eyebrow">YOUR PROGRAM</div><div className="page-heading"><div><h1>Workout templates</h1><p>Build once. Train without thinking.</p></div><button className="round-add" onClick={() => setEditor({id:`template-${Date.now()}`,name:"",focus:"",color:"#409ECE",icon:"◆",exercises:[]})}>＋</button></div>
          <div className="template-grid">{data.templates.map((template, index) => <article className="template-card" key={template.id}>
            <div className="template-number template-symbol" style={{background:template.color||["#409ECE","#B7C7B3","#FF6B6B"][index%3],color:(template.color||"")==="#F2EFEA"?"#0F172A":"white"}}>{template.icon||"◆"}</div><div className="template-copy"><span>{template.focus.toUpperCase()}</span><h2>{template.name}</h2><p>{template.exercises.length} exercises · {template.exercises.reduce((s,e)=>s+e.sets,0)} sets</p><div>{template.exercises.slice(0,3).map(item => <small key={item.exerciseId}>{exerciseName(item.exerciseId)}</small>)}</div></div>
            <div className="template-actions"><button onClick={() => startWorkout(template)}>Start</button><button onClick={() => setEditor(structuredClone(template))}>Edit</button><button onClick={() => schedule(template.id)}>Schedule</button></div>
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
        ["today","⌂","Today"],["plan","▤","Plan"],["history","↗","History"],["pbs","★","PBs"],["library","◇","Library"]
      ] as [Tab,string,string][]).map(([id,icon,label]) => <button key={id} className={tab===id?"selected":""} onClick={()=>setTab(id)}><span>{icon}</span><small>{label}</small></button>)}</nav>

      {picker && <div className="overlay" onMouseDown={()=>setPicker(false)}><section className="sheet picker-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>CHOOSE A SESSION</span><h2>What are we training?</h2></div><button onClick={()=>setPicker(false)}>×</button></div>{data.templates.map(template=><button className="picker-row" key={template.id} onClick={()=>startWorkout(template)}><span><b>{template.name}</b><small>{template.focus} · {template.exercises.length} exercises</small></span><em>Start →</em></button>)}</section></div>}

      {active && <div className="workout-screen">
        <header className="workout-header live-header"><button onClick={discardActive}>×</button><div><small>LIVE WORKOUT</small><b>{active.name}</b></div><button className="save-draft-button" onClick={saveDraft}>Save</button><button className="finish-button" onClick={saveWorkout}>Finish</button></header>
        <div className="live-progress"><span>{active.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0)} / {active.exercises.reduce((sum,e)=>sum+e.sets.length,0)} sets</span><div><i style={{width:`${100*active.exercises.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0)/active.exercises.reduce((sum,e)=>sum+e.sets.length,0)}%`}} /></div></div>
        <div className="workout-body">{active.exercises.map((exercise, exerciseIndex) => { const prev = previousSets(exercise.exerciseId); const groupIndex=[...new Set(active.exercises.map(item=>item.group).filter(Boolean))].indexOf(exercise.group); return <article className={`live-exercise ${exercise.group ? `superset-exercise superset-color-${groupIndex%4}` : ""}`} key={`${exercise.exerciseId}-${exerciseIndex}`}>
          {exercise.group && <span className="superset-badge">SUPERSET {String.fromCharCode(65+groupIndex)}</span>}<div className="live-exercise-title"><div><span>{String(exerciseIndex+1).padStart(2,"0")}</span><h2>{exerciseName(exercise.exerciseId)}</h2></div><div className="exercise-title-actions"><button onClick={()=>setExerciseHistoryId(exercise.exerciseId)}>History</button><button className="manage-exercise" onClick={()=>setLiveEditIndex(exerciseIndex)} aria-label={`Edit ${exerciseName(exercise.exerciseId)}`}>•••</button></div></div>
          <div className="set-head"><span>SET</span><span>PREVIOUS</span><span>KG</span><span>REPS</span><span>RPE</span><span /></div>
          {exercise.sets.map((set,setIndex)=><div className={`set-row ${set.done?"complete":""}`} key={setIndex}><b>{setIndex+1}</b><small>{prev[setIndex] ? `${prev[setIndex].weight} × ${prev[setIndex].reps}` : "—"}</small><input aria-label={`Set ${setIndex+1} weight`} inputMode="decimal" value={set.weight} placeholder={prev[setIndex]?.weight||"0"} onChange={e=>updateSet(exerciseIndex,setIndex,"weight",e.target.value)}/><input aria-label={`Set ${setIndex+1} reps`} inputMode="numeric" value={set.reps} onChange={e=>updateSet(exerciseIndex,setIndex,"reps",e.target.value)}/><input aria-label={`Set ${setIndex+1} RPE`} inputMode="decimal" value={set.rpe} placeholder="—" onChange={e=>updateSet(exerciseIndex,setIndex,"rpe",e.target.value)}/><button aria-label={`Complete set ${setIndex+1}`} onClick={()=>updateSet(exerciseIndex,setIndex,"done",!set.done)}>{set.done?"✓":""}</button></div>)}
          <div className="set-actions"><button className="add-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:[...item.sets,makeSet()]}:item)})}>＋ Add set</button>{exercise.sets.length>1&&<button className="remove-set" onClick={()=>setActive({...active,exercises:active.exercises.map((item,i)=>i===exerciseIndex?{...item,sets:item.sets.slice(0,-1)}:item)})}>− Remove last set</button>}</div>
        </article>})}<button className="add-live-exercise" onClick={()=>{setLiveAddQuery("");setLiveAddOpen(true)}}><span>＋</span><div><b>Add exercise</b><small>Add another movement to this session</small></div><em>→</em></button><label className="workout-note">SESSION NOTE<textarea value={active.note} onChange={e=>setActive({...active,note:e.target.value})} placeholder="How did it feel? Anything to remember?" /></label></div>
      </div>}

      {detail && <div className="overlay" onMouseDown={()=>setDetailId(null)}><section className="sheet detail-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{formatDate(detail.date).toUpperCase()}</span><h2>{detail.name}</h2></div><button onClick={()=>setDetailId(null)}>×</button></div>{detail.exercises.map(exercise=><button className="detail-exercise" key={exercise.exerciseId} onClick={()=>setExerciseHistoryId(exercise.exerciseId)}><span><b>{exerciseName(exercise.exerciseId)}</b><small>{exercise.sets.filter(s=>s.done).length} working sets</small></span><div>{exercise.sets.map((set,i)=><small key={i}>{set.weight || "—"} kg × {set.reps || "—"} {set.rpe&&`@ ${set.rpe}`}</small>)}</div><em>›</em></button>)}{detail.note&&<p className="detail-note">“{detail.note}”</p>}</section></div>}

      {active && liveEditIndex !== null && active.exercises[liveEditIndex] && <div className="overlay high-overlay" onMouseDown={()=>setLiveEditIndex(null)}><section className="sheet live-edit-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>EDIT LIVE SESSION</span><h2>{exerciseName(active.exercises[liveEditIndex].exerciseId)}</h2></div><button onClick={()=>setLiveEditIndex(null)}>×</button></div><div className="live-edit-actions"><button disabled={liveEditIndex===0} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex-1)}><b>↑</b><span>Move earlier</span></button><button disabled={liveEditIndex===active.exercises.length-1} onClick={()=>moveLiveExercise(liveEditIndex,liveEditIndex+1)}><b>↓</b><span>Move later</span></button>{active.exercises[liveEditIndex].group?<button className="ungroup-action" onClick={()=>ungroupLiveExercise(liveEditIndex)}><b>⊘</b><span>Remove from superset</span></button>:<button disabled={active.exercises.length<2} onClick={()=>groupLiveExercise(liveEditIndex,liveEditIndex>0?liveEditIndex-1:1)}><b>⇄</b><span>Superset with {liveEditIndex>0?"previous":"next"}</span></button>}</div><div className="replace-heading"><span>CHANGE EXERCISE</span><p>Your completed and entered sets will be kept.</p></div><div className="replace-list">{data.exercises.filter(exercise=>exercise.id!==active.exercises[liveEditIndex].exerciseId).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:active.exercises.map((item,index)=>index===liveEditIndex?{...item,exerciseId:exercise.id}:item)});setLiveEditIndex(null)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.group} · {exercise.equipment}</small></span><em>Replace</em></button>)}</div></section></div>}

      {active && liveAddOpen && <div className="overlay high-overlay" onMouseDown={()=>setLiveAddOpen(false)}><section className="sheet add-exercise-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>LIVE SESSION</span><h2>Add an exercise</h2></div><button onClick={()=>setLiveAddOpen(false)}>×</button></div><label className="search"><span>⌕</span><input autoFocus value={liveAddQuery} onChange={event=>setLiveAddQuery(event.target.value)} placeholder="Search exercise, equipment or muscle" /></label><div className="replace-list">{data.exercises.filter(exercise=>!active.exercises.some(item=>item.exerciseId===exercise.id)&&`${exercise.name} ${exercise.equipment} ${exercise.group}`.toLowerCase().includes(liveAddQuery.toLowerCase())).map(exercise=><button key={exercise.id} onClick={()=>{setActive({...active,exercises:[...active.exercises,{exerciseId:exercise.id,note:"",sets:Array.from({length:3},()=>makeSet("8"))}]});setLiveAddOpen(false)}}><span className="movement-icon">{exercise.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{exercise.name}</b><small>{exercise.equipment} · {exercise.group}</small></span><em>＋ Add</em></button>)}</div></section></div>}

      {historyExercise && <div className="overlay high-overlay" onMouseDown={()=>setExerciseHistoryId(null)}><section className="sheet history-sheet" onMouseDown={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><span>{historyExercise.group.toUpperCase()} · {historyExercise.equipment.toUpperCase()}</span><h2>{historyExercise.name}</h2></div><button onClick={()=>setExerciseHistoryId(null)}>×</button></div>{(() => { const records=data.workouts.flatMap(w=>w.exercises.filter(e=>e.exerciseId===historyExercise.id).map(e=>({workout:w,exercise:e}))); const maxes=records.map(r=>Math.max(...r.exercise.sets.map(s=>Number(s.weight)||0))); return <>{records.length>0&&<div className="progress-chart"><div className="chart-bars">{maxes.slice().reverse().map((max,i)=><i key={i} style={{height:`${25+70*max/Math.max(...maxes)}%`}}><span>{max}</span></i>)}</div><small>Best load by session (kg)</small></div>}<div className="exercise-records">{records.length?records.map(({workout,exercise})=><div key={workout.id}><span><b>{formatDate(workout.date)}</b><small>{workout.name}</small></span><p>{exercise.sets.map((set,i)=><em key={i}>{set.weight || "—"} × {set.reps || "—"}<small>{set.rpe&&` RPE ${set.rpe}`}</small></em>)}</p></div>):<p className="no-records">No completed sets yet. Start a workout to build your history.</p>}</div></>})()}</section></div>}

      {editor && <div className="editor-screen"><header className="workout-header"><button onClick={()=>setEditor(null)}>×</button><div><small>WORKOUT BUILDER</small><b>{editor.id.startsWith("template-")?"New template":"Edit template"}</b></div><button className="finish-button" onClick={saveTemplate}>Save</button></header><div className="editor-body"><label>WORKOUT NAME<input value={editor.name} onChange={e=>setEditor({...editor,name:e.target.value})} placeholder="e.g. Lower B" /></label><label>FOCUS<input value={editor.focus} onChange={e=>setEditor({...editor,focus:e.target.value})} placeholder="e.g. Hinge + single-leg" /></label><div className="template-style-picker"><span>TEMPLATE STYLE</span><div className="style-preview" style={{background:editor.color||"#7B61FF"}}>{editor.icon||"◆"}</div><div><small>COLOUR</small><div className="color-options">{["#7B61FF","#B7C7B3","#F2EFEA","#E6E9EE","#FF6B6B","#0F172A"].map(color=><button aria-label={`Choose ${color}`} className={editor.color===color?"selected":""} style={{background:color}} key={color} onClick={()=>setEditor({...editor,color})}/>)}</div><small>ICON</small><div className="icon-options">{["◆","✦","↗","●","▲","≈","＋","◇"].map(icon=><button className={editor.icon===icon?"selected":""} key={icon} onClick={()=>setEditor({...editor,icon})}>{icon}</button>)}</div></div></div><div className="editor-exercises"><span>EXERCISES</span>{editor.exercises.map((item,index)=>{const groups=[...new Set(editor.exercises.map(exercise=>exercise.group).filter(Boolean))];const groupIndex=groups.indexOf(item.group);return <div className={item.group?`grouped-editor-exercise superset-color-${groupIndex%4}`:""} key={`${item.exerciseId}-${index}`}><b>{exerciseName(item.exerciseId)}</b><label>Sets<input inputMode="numeric" value={item.sets} onChange={e=>setEditor({...editor,exercises:editor.exercises.map((x,i)=>i===index?{...x,sets:Number(e.target.value)}:x)})}/></label><label>Reps<input value={item.reps} onChange={e=>setEditor({...editor,exercises:editor.exercises.map((x,i)=>i===index?{...x,reps:e.target.value}:x)})}/></label><button onClick={()=>setEditor({...editor,exercises:editor.exercises.filter((_,i)=>i!==index)})}>×</button>{item.group&&<small className="editor-superset-label">SUPERSET {String.fromCharCode(65+groupIndex)}</small>}{index>0&&<button className={`superset-toggle ${item.group?"active":""}`} onClick={()=>toggleSuperset(index)}>{item.group?"✓ Grouped with exercise above":"⊕ Group with exercise above (superset)"}</button>}</div>})}</div><div className="exercise-picker"><span>ADD EXERCISE</span><label className="search"><span>⌕</span><input value={editorQuery} onChange={event=>setEditorQuery(event.target.value)} placeholder="Search by exercise, equipment or muscle" /></label><div className="editor-library-list">{data.exercises.filter(ex=>!editor.exercises.some(item=>item.exerciseId===ex.id)&&`${ex.name} ${ex.equipment} ${ex.group}`.toLowerCase().includes(editorQuery.toLowerCase())).map(ex=><button key={ex.id} onClick={()=>setEditor({...editor,exercises:[...editor.exercises,{exerciseId:ex.id,sets:3,reps:"8"}]})}><span className="movement-icon">{ex.name.split(" ").map(word=>word[0]).slice(0,2).join("")}</span><span><b>{ex.name}</b><small>{ex.equipment} · {ex.group}</small></span><em>＋ Add</em></button>)}</div></div></div></div>}
    </main>
  );
}
