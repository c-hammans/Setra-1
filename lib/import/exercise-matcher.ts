import type {Exercise} from "@/lib/setra/types";
import type {ExerciseMatch} from "./types";

export const normalizedExerciseName=(value:string)=>value.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");

const aliases:Record<string,string>={
  "rdl":"romanian deadlift",
  "bb rdl":"barbell romanian deadlift",
  "db rdl":"dumbbell romanian deadlift",
  "kb rdl":"kettlebell romanian deadlift",
  "ohp":"overhead press",
  "db press":"dumbbell shoulder press",
  "lat pull down":"lat pulldown",
  "pullup":"pull up",
  "chinup":"chin up",
  "rear delt fly":"reverse dumbbell flyes",
  "pec fly":"pec deck",
  "cable rows":"seated cable row",
};

const tokens=(value:string)=>new Set(normalizedExerciseName(value).split(" ").filter(Boolean));
const similarity=(left:string,right:string)=>{const a=tokens(left),b=tokens(right);if(!a.size||!b.size)return 0;let overlap=0;a.forEach(token=>{if(b.has(token))overlap++});return overlap/Math.max(a.size,b.size)};

export function matchExercise(name:string,catalogue:Exercise[]):ExerciseMatch{
  const key=normalizedExerciseName(name);
  const exact=catalogue.filter(item=>normalizedExerciseName(item.name)===key);
  if(exact.length===1)return {status:"matched",exercise:exact[0],suggestions:exact};
  const alias=aliases[key];
  if(alias){const matches=catalogue.filter(item=>normalizedExerciseName(item.name)===alias);if(matches.length===1)return {status:"matched",exercise:matches[0],suggestions:matches}}
  const ranked=catalogue.map(exercise=>({exercise,score:similarity(key,exercise.name)})).filter(item=>item.score>=.45).sort((a,b)=>b.score-a.score).slice(0,5).map(item=>item.exercise);
  return {status:ranked.length?"needs_review":"unmatched",suggestions:ranked};
}

