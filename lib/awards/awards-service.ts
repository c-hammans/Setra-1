import type {AwardEvaluation} from "./types";

export type AwardsResponse=AwardEvaluation&{timezone:string;weekStartsOn:number;weeklySessionGoal:number|null;preferredUnit:"kg"|"lb"};

export async function syncAwards(timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC"):Promise<AwardsResponse>{
  const response=await fetch("/api/awards",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({timezone}),cache:"no-store"});
  const payload=await response.json().catch(()=>({error:"Awards could not be loaded."}));
  if(!response.ok)throw new Error(payload.error||"Awards could not be loaded.");
  return payload as AwardsResponse;
}
