import type {AppData,EnduranceSession,EnduranceTemplate} from "../setra/types.ts";
import type {PendingDiaryChange} from "./local-diary.ts";

const ordered=(changes:PendingDiaryChange[])=>[...changes].sort((a,b)=>a.revision-b.revision);

export function overlayPendingStrength(cloud:AppData,changes:PendingDiaryChange[]):AppData{
  const next:AppData={...cloud,templates:[...cloud.templates],workouts:[...cloud.workouts],scheduled:[...cloud.scheduled]};
  for(const change of ordered(changes)){
    if(change.kind==="replace_schedule")next.scheduled=structuredClone(change.payload.items);
    else if(change.kind==="save_strength_template")next.templates=[change.payload.template,...next.templates.filter(item=>item.id!==change.payload.template.id)];
    else if(change.kind==="delete_strength_template")next.templates=next.templates.filter(item=>item.id!==change.payload.clientId);
    else if(change.kind==="save_workout"&&change.payload.status==="completed")next.workouts=[change.payload.workout,...next.workouts.filter(item=>item.id!==change.payload.workout.id)];
    else if(change.kind==="delete_workout")next.workouts=next.workouts.filter(item=>item.id!==change.payload.clientId);
  }
  return next;
}

export function overlayPendingEndurance(sessions:EnduranceSession[],templates:EnduranceTemplate[],changes:PendingDiaryChange[]){
  let nextSessions=[...sessions],nextTemplates=[...templates];
  for(const change of ordered(changes)){
    if(change.kind==="save_endurance_session")nextSessions=[change.payload.session,...nextSessions.filter(item=>item.id!==change.payload.session.id)];
    else if(change.kind==="delete_endurance_session")nextSessions=nextSessions.filter(item=>item.id!==change.payload.clientId);
    else if(change.kind==="save_endurance_template")nextTemplates=[change.payload.template,...nextTemplates.filter(item=>item.id!==change.payload.template.id)];
    else if(change.kind==="delete_endurance_template")nextTemplates=nextTemplates.filter(item=>item.id!==change.payload.clientId);
  }
  return {sessions:nextSessions.sort((a,b)=>b.date.localeCompare(a.date)),templates:nextTemplates};
}
