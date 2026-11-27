"use client";

import {notFound,useSearchParams} from "next/navigation";
import {Suspense,useState} from "react";
import {PlanAdjustments,ProposePlanChange} from "@/components/adaptive/plan-adjustments";
import {IntegrationsPage} from "@/components/integrations/activity-integration";
import {PlusFeatureHub} from "@/components/premium/plus-feature-hub";
import type {IndividualPlan} from "@/lib/premium/access";
import "../plan-adjustments.css";
import "../integrations/integrations.css";

function Harness(){
  const params=useSearchParams();
  const plan=(params.get("plan")??"adaptive") as IndividualPlan;
  const access={plan,roles:["athlete" as const]};
  const [refreshes,setRefreshes]=useState(0);
  if(params.has("plusHub"))return <main><PlusFeatureHub access={access}/></main>;
  if(params.has("activityImport"))return <IntegrationsPage/>;
  return <main><ProposePlanChange access={access} source={{kind:"review",id:"00000000-0000-4000-8000-000000000001"}}/>
    <PlanAdjustments access={access} canChange={()=>true} onChanged={()=>setRefreshes(value=>value+1)}/>
    <output aria-label="Plan refresh calls">{refreshes}</output>
  </main>;
}
export default function TestPlanAdjustment(){
  if(process.env.NODE_ENV==="production")notFound();
  return <Suspense><Harness/></Suspense>;
}
