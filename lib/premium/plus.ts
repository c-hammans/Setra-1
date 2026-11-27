import {FEATURE_CATALOGUE,PLAN_CATALOGUE,getRequiredPlan,hasFeature,type AccessState,type FeatureKey} from "./access.ts";

const destinations:Partial<Record<FeatureKey,string>>={
  advanced_analytics:"advanced-analytics",
  ai_weekly_review:"adaptive-weekly-review",
  ai_recommendations:"adaptive-recommendations",
  adaptive_programming:"adaptive-plan-adjustments",
  ask_setra_training:"ask-setra",
  user_approved_plan_changes:"adaptive-plan-adjustments",
};
export const plusTiers=["premium","adaptive"] as const;
export const plusFeatures=(tier:(typeof plusTiers)[number]):readonly FeatureKey[]=>PLAN_CATALOGUE[tier].entitlements;
export const plusOfferedPlans=(feature:FeatureKey)=>{
  const required=getRequiredPlan(feature);
  return required==="adaptive"?["adaptive"] as const:plusTiers;
};
export function plusFeatureStatus(access:AccessState,feature:FeatureKey){
  const target=destinations[feature];
  if(FEATURE_CATALOGUE[feature].availability!=="available_now"||!target)return {state:"upcoming"} as const;
  if(!hasFeature(access,feature))return {state:"locked"} as const;
  return {state:"open",href:`/?tab=history&view=progress#${target}`} as const;
}
export function progressLink(search:string,hash:string){
  const query=new URLSearchParams(search),tab=query.get("tab"),anchor=hash.slice(1);
  const known=Object.values(destinations).includes(anchor);
  return {requested:(tab==="history"&&query.get("view")==="progress")||((tab==="history"||tab==="pbs")&&known),
    anchor:known?anchor:null};
}
