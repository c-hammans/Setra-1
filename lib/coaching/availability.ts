import type {ClientTrainingAvailability,TrainingAvailabilityStatus,TrainingWeekday} from "./types.ts";
import {parseLocalDate} from "../setra/week.ts";

export const WEEKDAY_LABELS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;

export function availabilityStatus(value:ClientTrainingAvailability,day:TrainingWeekday):TrainingAvailabilityStatus{
  if(value.unavailableDays.includes(day))return "unavailable";
  if(value.restDays.includes(day))return "rest";
  if(value.preferredDays.includes(day))return "preferred";
  return "available";
}

export function availabilityForDate(value:ClientTrainingAvailability,date:string){
  const oneOff=value.oneOffDates.find(item=>item.date===date);
  const day=parseLocalDate(date).getDay() as TrainingWeekday;
  return{day,status:oneOff?"unavailable" as const:availabilityStatus(value,day),time:value.preferredSessionTimes[day]||"",note:oneOff?.note||"",oneOff:Boolean(oneOff)};
}

export function unavailableAssignmentWarnings(value:ClientTrainingAvailability,dates:string[]){
  return [...new Set(dates)].map(date=>({date,...availabilityForDate(value,date)})).filter(item=>item.status==="unavailable");
}
