import type {Template} from "../setra/types.ts";

export const planChangeFeatures = ["adaptive_programming", "user_approved_plan_changes"] as const;
export type Scalar = string | number;
export type PrescriptionField = {key:string; label:string; value:Scalar; unit?:string};
export type PlanSnapshot = {
  id:string; modality:"strength"|"endurance"; date:string; title:string; stamp:string;
  fields:PrescriptionField[]; blocked:boolean; state:string; activityType?:string; simple?:boolean;
};
export type PlanOption = {
  id:string; session:PlanSnapshot; field:PrescriptionField; proposed:Scalar;
  min?:number; max?:number; step?:number; evidence?:string[];
};
export type PlanSource = {kind:"recommendation"|"ask"|"review"; id:string};
export type PlanChange = {option:PlanOption; value:Scalar};
export type PlanProposal = {
  id:string; status:"proposed"|"applied"|"declined"|"expired"|"reverted";
  reason:string; evidence:string[]; options:PlanOption[]; accepted:PlanChange[]; createdAt:string;
};
export type StrengthOverrides = Record<string, number>;

export function withStrengthPrescription(template:Template, overrides?:StrengthOverrides):Template {
  if (!overrides || template.coachAssignmentId) return template;
  return {...template, exercises:template.exercises.map((exercise,index)=>{
    const key=`exercise:${index}:`;
    const load=overrides[key+"load"];
    return {...exercise, sets:overrides[key+"sets"]??exercise.sets,
      reps:overrides[key+"reps"]?.toString()??exercise.reps,
      plannedLoad:load!=null&&exercise.plannedLoad?.mode==="kg"
        ?{...exercise.plannedLoad,value:String(load)}:exercise.plannedLoad};
  })};
}

export function dateBetween(value:string, first:string, last:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00Z");
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value&&value>=first&&value<=last;
}

export function selectPlanOptions(raw:unknown, options:PlanOption[]) {
  const ids=(raw as {optionIds?:unknown})?.optionIds;
  if(!Array.isArray(ids)||ids.length>3||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=="string"||!options.some(item=>item.id===id))) throw new Error("Setra returned an unsupported proposal.");
  const selected=ids.map(id=>options.find(item=>item.id===id)!);
  if(new Set(selected.map(item=>item.session.id)).size!==selected.length) throw new Error("Choose only one change per session in a preview.");
  return selected;
}

export function validatePlanChanges(raw:unknown,options:PlanOption[],first:string,last:string):PlanChange[]{
  if(!Array.isArray(raw)||raw.length<1||raw.length>3) throw new Error("Select at least one change.");
  const selected=selectPlanOptions({optionIds:raw.map(item=>item?.optionId)},options);
  return selected.map((option,index)=>{
    const value:unknown=raw[index]?.value;
    const valid=option.field.key==="date"||option.field.key==="add"
      ? typeof value==="string"&&dateBetween(value,first,last)
      : typeof option.proposed==="number"
        ? typeof value==="number"&&Number.isFinite(value)&&value>=(option.min??value)&&value<=(option.max??value)&&
          Math.abs(value/(option.step??1)-Math.round(value/(option.step??1)))<1e-7
        : value===option.proposed;
    if(!valid||value===option.field.value) throw new Error(`Choose a valid changed value for ${option.field.label}.`);
    return {option,value:value as Scalar};
  });
}
