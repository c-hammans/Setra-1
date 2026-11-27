"use client";

import {notFound,useSearchParams} from "next/navigation";
import {Suspense,useState} from "react";
import {PlanAdjustments,ProposePlanChange} from "@/components/adaptive/plan-adjustments";
import {IntegrationsPage} from "@/components/integrations/activity-integration";
import {PlusFeatureHub} from "@/components/premium/plus-feature-hub";
import {ShareStudio} from "@/components/share/share-studio";
import type {ShareCardData} from "@/lib/share/share-types";
import type {IndividualPlan} from "@/lib/premium/access";
import "../plan-adjustments.css";
import "../share.css";
import "../integrations/integrations.css";

const shareWorkout:ShareCardData={id:"audit-workout",kind:"workout",sport:"strength",label:"Strength",title:"Long Wednesday Strength Session",result:"6 sets",metrics:[{label:"Sets",value:"6"},{label:"Reps",value:"26"},{label:"Duration",value:"48m"},{label:"Volume",value:"1,220 kg"}]};
const sharePb:ShareCardData={id:"audit-pb",kind:"pb",sport:"strength",label:"Strength",title:"Single Arm Dumbbell Overhead Press",result:"20 kg",secondary:"× 5",improvement:"↑ 2 kg",metrics:[]};

function Harness(){
  const params=useSearchParams();
  const plan=(params.get("plan")??"adaptive") as IndividualPlan;
  const access={plan,roles:["athlete" as const]};
  const [refreshes,setRefreshes]=useState(0);
  const [shareOpen,setShareOpen]=useState(false);
  if(params.has("shareStudio"))return <main><button onClick={()=>setShareOpen(true)}>Open share card</button>{shareOpen&&<ShareStudio items={[shareWorkout,sharePb]} accent="#409ECE" onClose={()=>setShareOpen(false)}/>}</main>;
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
