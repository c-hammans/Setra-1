import {dateBetween,type PlanOption,type PlanSnapshot} from "./plan-adjustments.ts";
import {addCalendarDays} from "../setra/week.ts";

export function buildPlanOptions(sessions:PlanSnapshot[],mode:"progress"|"maintain"|"reduce"|"schedule",today:string,exerciseKey?:string,latestLoadKg?:number) {
  const first=addCalendarDays(today,1), last=addCalendarDays(today,28);
  const available=sessions.filter(item=>!item.blocked&&item.state==="planned"&&dateBetween(item.date,first,last));
  const used=new Set(sessions.map(item=>item.date));
  const candidates:PlanOption[]=[];
  for(const session of available.slice(0,8)){
    const offer=(field:PlanOption["field"],proposed:PlanOption["proposed"],min?:number,max?:number,step?:number)=>
      candidates.push({id:`${session.id}:${field.key}`,session,field,proposed,min,max,step});
    if(mode==="schedule"){
      const next=addCalendarDays(session.date,1);
      if(next<=last&&!used.has(next)) offer({key:"date",label:"Scheduled date",value:session.date},next);
    }
    for(const field of session.fields){
      if(typeof field.value!=="number"||!Number.isFinite(field.value)||field.value<=0) continue;
      const n=field.value, key=field.key.split(":").at(-1)!;
      if(session.modality==="strength"){
        const matchingLoad=session.fields.find(item=>item.key===field.key.replace(/:[^:]+$/,":load"))?.value;
        if(mode==="progress"&&exerciseKey&&field.label.split(" · ")[0].toLowerCase().replace(/[^a-z0-9]+/g,"-")===exerciseKey&&
          typeof matchingLoad==="number"&&(latestLoadKg==null||matchingLoad<=latestLoadKg)){
          // No change to lifts without a recorded, comparable prescription.
          const step=key==="load"?0.25:1;
          const cap=key==="load"?Math.min(n+2.5,n*1.05):key==="sets"?n>=4&&n<6?n+1:n:n>=5&&n<15?n+1:n;
          const up=Math.floor(cap/step)*step;
          if(up>n) offer(field,up,(Math.floor(n/step)+1)*step,up,step);
        }else if(mode==="reduce"&&(key==="sets"&&n>=3||key==="load"&&n>=5||key==="reps"&&n>=5)){
          const step=key==="load"?0.25:1, down=key==="load"?Math.ceil(n*.95/step)*step:n-1;
          if(down<n)offer(field,down,down,down,step);
        }
        continue;
      }
      if(!["maintain","reduce"].includes(mode)) continue;
      if(key==="targetRpe"&&n>=4)offer(field,n-1,Math.max(3,n-2),n-1,0.5);
      if((key==="plannedDurationMinutes"&&session.simple||key==="durationSeconds")&&n>=10){
        const down=Math.ceil(n*.9);
        if(down<n)offer(field,down,Math.ceil(n*.8),n-1,1);
      }
      if((key==="plannedDistanceMetres"&&session.simple||key==="distanceMetres")&&n>=50){
        const down=Math.ceil(n*.9);
        if(down<n)offer(field,down,Math.ceil(n*.8),Math.floor(n-1),1);
      }
      if(key==="repetitions"&&n>=4)offer(field,n-1,n-1,n-1,1);
      if(key==="targetMaxValue"&&["seconds_per_km","seconds_per_100m","seconds_per_500m"].includes(field.unit??"")&&n>=20){
        const up=Math.floor(n*1.03);
        if(up>n)offer(field,up,Math.floor(n)+1,up,1);
      }
    }
    if(session.modality==="endurance"&&session.simple&&mode==="reduce"){
      offer({key:"remove",label:"Session status",value:"Planned"},"Cancel session");
      if((session.fields.find(f=>f.key==="plannedDurationMinutes")?.value as number)>=20&&
         (session.fields.find(f=>f.key==="targetRpe")?.value as number)>=4)
        offer({key:"replace",label:"Session prescription",value:session.title},"15 minutes easy · RPE 3/10");
    }
    if(session.modality==="endurance"&&session.simple&&mode==="schedule"&&["walk_hike","bike"].includes(session.activityType??"")&&
      (session.fields.find(f=>f.key==="targetRpe")?.value as number)<=3&&
      (session.fields.find(f=>f.key==="plannedDurationMinutes")?.value as number)>=15){
      const next=addCalendarDays(session.date,2);
      if(next<=last&&!used.has(next)&&!used.has(addCalendarDays(next,-1))&&!used.has(addCalendarDays(next,1)))
        offer({key:"add",label:"Add 15-minute easy session · RPE 3/10",value:"No added session"},next);
    }
    if(mode==="progress"&&candidates.length)break;
  }
  return candidates.slice(0,60);
}
