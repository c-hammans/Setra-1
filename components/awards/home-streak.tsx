"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {syncAwards,type AwardsResponse} from "@/lib/awards/awards-service";
import type {AwardProgress} from "@/lib/awards/types";
import {awardShareData} from "@/lib/share/share-data";
import {ShareStudio} from "@/components/share/share-studio";
import {useDialogFocusTrap} from "@/components/ui/use-dialog-focus-trap";

const weekLabel=(weeks:number)=>`${weeks} ${weeks===1?"week":"weeks"}`;
const messages=[(weeks:number)=>`${weekLabel(weeks)} and counting`,(weeks:number)=>`Still building · ${weekLabel(weeks)}`,(weeks:number)=>`${weekLabel(weeks)} consistent`,()=>"Another week in the bank"];
export function HomeStreak({accent,suppressNotice=false}:{accent:string;suppressNotice?:boolean}){
  const [data,setData]=useState<AwardsResponse|null>(null);const [notice,setNotice]=useState<AwardProgress|null>(null);const [sharing,setSharing]=useState<AwardProgress|null>(null);
  useDialogFocusTrap(Boolean(notice||sharing));
  useEffect(()=>{if(!notice&&!sharing)return;const close=(event:KeyboardEvent)=>{if(event.key!=="Escape")return;if(sharing)setSharing(null);else setNotice(null)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[notice,sharing]);
  useEffect(()=>{let cancelled=false;const refresh=()=>syncAwards().then(result=>{if(cancelled)return;setData(result);const latest=result.newlyEarned.at(-1);if(latest){const award=result.awards.find(item=>item.definition.id===latest.achievementId);if(award)setNotice(award)}}).catch(()=>{});void refresh();window.addEventListener("setra-training-changed",refresh);return()=>{cancelled=true;window.removeEventListener("setra-training-changed",refresh)}},[]);
  const copy=useMemo(()=>{if(!data)return"Your training record";const weeks=data.streaks.activeWeeks.current;if(weeks>0){const day=new Date().getDate();return messages[day%messages.length](weeks)}if(data.streaks.plannedWeeks.current>0)return`${data.streaks.plannedWeeks.current} planned weeks and counting`;if(data.streaks.setraUse.current>=3)return`${data.streaks.setraUse.current} days with Setra`;return"The work adds up."},[data]);
  return <><Link className="home-streak" href="/awards"><span>◆</span><b>{copy}</b><em>View awards ›</em></Link>{notice&&!suppressNotice?<div className="new-award-overlay"><section className="new-award-toast" role="dialog" aria-modal="true"><button onClick={()=>setNotice(null)} aria-label="Close award notification">×</button><small>NEW AWARD</small><h3>{notice.definition.title}</h3><p>{notice.definition.description}</p><div><Link href="/awards">View</Link><button onClick={()=>{setSharing(notice);setNotice(null)}}>Share ↗</button></div></section></div>:null}{sharing?<ShareStudio items={[awardShareData(sharing)]} accent={accent} onClose={()=>setSharing(null)}/>:null}</>;
}
