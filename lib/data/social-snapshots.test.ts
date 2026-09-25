import assert from "node:assert/strict";
import test from "node:test";
import {enduranceWorkoutSnapshot,strengthTemplateSnapshot,strengthWorkoutSnapshot} from "../social/snapshots.ts";
import type {EnduranceSession,Exercise,Template,Workout} from "../setra/types.ts";

const exercises:Exercise[]=[{id:"squat",name:"Back Squat",group:"Quads",equipment:"Barbell"}];

test("completed workout snapshots include completed training but exclude private notes",()=>{
  const workout:Workout={id:"workout",name:"Lower",date:"2026-09-25",startedAt:"08:00",duration:45,note:"private session note",exercises:[{exerciseId:"squat",note:"private exercise note",sets:[{weight:"100",reps:"5",rpe:"8",done:true,note:"private set note"},{weight:"105",reps:"5",rpe:"9",done:false}]},{exerciseId:"not-completed",note:"private incomplete exercise",sets:[{weight:"40",reps:"8",rpe:"",done:false}]}]};
  const draft=strengthWorkoutSnapshot(workout,exercises);
  assert.equal(JSON.stringify(draft).includes("private"),false);
  assert.equal((draft.snapshot.exercises as unknown[]).length,1);
  assert.deepEqual((draft.snapshot.exercises as {sets:unknown[]}[])[0].sets,[{weight:"100",reps:"5",rpe:"8"}]);
});

test("endurance workout snapshots exclude session notes and retain structured performance",()=>{
  const session:EnduranceSession={id:"run",activityType:"run",status:"completed",title:"Intervals",date:"2026-09-25",durationMinutes:40,distanceKm:8,notes:"private note",blocks:[{id:"step",type:"interval",title:"Work",instructions:"400 m repeats",distanceMetres:400}]};
  const draft=enduranceWorkoutSnapshot(session);
  assert.equal(JSON.stringify(draft).includes("private note"),false);
  assert.equal((draft.snapshot.blocks as unknown[]).length,1);
});

test("template snapshots carry stable exercise identity and a name fallback",()=>{
  const template:Template={id:"template",name:"Lower",focus:"Strength",exercises:[{exerciseId:"squat",sets:3,reps:"5"}]};
  const draft=strengthTemplateSnapshot(template,exercises);
  assert.equal((draft.snapshot.exercises as {exerciseName:string}[])[0].exerciseName,"Back Squat");
});
