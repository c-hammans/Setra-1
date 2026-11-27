import type {AskSetraIntent} from "./ask-setra-types";

const matches=(value:string,terms:string[])=>terms.some(term=>value.includes(term));
const groups:Array<[AskSetraIntent,string[]]>=[
  ["medical",["pain","injury","injured","illness","sick","medical","diagnose","overtrain","recovery","ready to train"]],
  ["strength",["strength","squat","deadlift","bench","press","load","weight","reps","sets","muscle"]],
  ["endurance",["run","running","ride","cycling","bike","swim","rowing","row","pace","speed","distance","kilomet","elevation","heart rate","5k","10k","marathon","race"]],
  ["goal",["goal","target","5k","10k","marathon","race","personal best","pb"]],
  ["feedback",["rpe","felt","feel","hardest","easier","harder","expected","comment"]],
  ["program",["program","block","week of","phase","coach assigned"]],
  ["week",["this week","last week","previous week","weekly","compare","recent weeks"]],
  ["recommendation",["next week","what should","recommend","consider","change","focus on"]],
];

export function selectAskSetraIntents(question:string):AskSetraIntent[]{
  const normalized=question.trim().toLowerCase();const selected=groups.filter(([,terms])=>matches(normalized,terms)).map(([intent])=>intent);
  return selected.length?[...new Set(selected)]:["general"];
}

export const isMedicalAskSetraQuestion=(intents:AskSetraIntent[])=>intents.includes("medical");

export function askSetraContextSections(intents:AskSetraIntent[]){
  const all=intents.includes("general");
  return {strength:all||intents.includes("strength"),endurance:all||intents.includes("endurance"),feedback:all||intents.includes("feedback")||intents.includes("medical"),goals:all||intents.includes("goal"),reviews:all||intents.some(intent=>["week","recommendation","program"].includes(intent)),upcoming:all||intents.some(intent=>["week","recommendation","program"].includes(intent))};
}
