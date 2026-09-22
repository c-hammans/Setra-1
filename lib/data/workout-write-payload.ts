import type {Workout} from "@/lib/setra/types";
export function workoutWritePayload(workout:Workout,status:"in_progress"|"completed",timezone:string,now=()=>new Date().toISOString()){
  return{...workout,timezone,completedAt:status==="completed"?(workout.completedAt||workout.updatedAt||now()):undefined};
}
