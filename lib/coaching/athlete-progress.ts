import type {AthleteCoachingWeekItem} from "./types.ts";

export const athleteWeekSummary=(items:AthleteCoachingWeekItem[],today:string)=>({
  planned:items.filter(item=>item.status!=="cancelled"&&item.status!=="rescheduled").length,
  completed:items.filter(item=>item.status==="completed"||item.status==="partial").length,
  skipped:items.filter(item=>item.status==="skipped").length,
  rescheduled:items.filter(item=>item.status==="rescheduled").length,
  missed:items.filter(item=>item.status==="planned"&&item.date<today).length,
});

export const nextCoachedSession=(items:AthleteCoachingWeekItem[],today:string)=>
  [...items].filter(item=>item.status==="planned"&&item.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
