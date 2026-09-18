"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {AwardBadge,AwardMark} from "@/components/awards/award-badge";
import {ShareStudio} from "@/components/share/share-studio";
import {awardCategoryLabels} from "@/lib/awards/definitions";
import {syncAwards,type AwardsResponse} from "@/lib/awards/awards-service";
import type {AwardCategory,AwardProgress} from "@/lib/awards/types";
import {loadLocalAppearance,loadLocalAppColour,loadLocalTextScale} from "@/lib/data/local-diary";
import {awardShareData} from "@/lib/share/share-data";
import {createSetraTheme,useResolvedAppearance} from "@/lib/setra/appearance";
import "../share.css";
import "./awards.css";

const categories:AwardCategory[]=["consistency","training","strength","endurance","hybrid","setra","special"];
const displayAward=(award:AwardProgress,unit:"kg"|"lb")=>{if(unit!=="lb"||award.definition.metric!=="strength_volume_kg")return award;const threshold=Math.round(award.threshold*2.20462),value=award.value*2.20462;return{...award,value,threshold,definition:{...award.definition,title:`${threshold.toLocaleString()} lb Lifted`,description:`Record ${threshold.toLocaleString()} pounds of completed strength volume.`,requirement:`Record ${threshold.toLocaleString()} pounds of completed strength volume.`,threshold,unit:"lb"}}};
const progressText=(award:AwardProgress)=>{const unit=award.definition.unit;if(unit==="kg"||unit==="lb")return `${Math.round(award.value).toLocaleString()} / ${award.threshold.toLocaleString()} ${unit}`;if(unit==="km")return `${Number(award.value.toFixed(1)).toLocaleString()} / ${award.threshold.toLocaleString()} km`;if(unit==="hours")return `${Math.floor(award.value)} / ${award.threshold} hours`;return `${Math.floor(award.value).toLocaleString()} / ${award.threshold.toLocaleString()}${unit?` ${unit}`:""}`};

export default function AwardsPage(){
  const {user}=useAuth();const [data,setData]=useState<AwardsResponse|null>(null);const [error,setError]=useState("");const [selected,setSelected]=useState<AwardProgress|null>(null);const [sharing,setSharing]=useState<AwardProgress|null>(null);const [openSection,setOpenSection]=useState<AwardCategory|null>(null);
  const colour=loadLocalAppColour(user?.id)||"#409ECE",appearance=loadLocalAppearance(user?.id)||"system",textScale=loadLocalTextScale(user?.id)||1,resolved=useResolvedAppearance(appearance),theme=createSetraTheme(colour,resolved,textScale);
  useEffect(()=>{let cancelled=false;syncAwards().then(result=>{if(!cancelled)setData(result)}).catch(reason=>{if(!cancelled)setError(reason instanceof Error?reason.message:"Awards could not be loaded.")});return()=>{cancelled=true}},[]);
  const earned=useMemo(()=>data?.awards.filter(item=>item.earned).sort((a,b)=>(b.earnedAt||"").localeCompare(a.earnedAt||""))||[],[data]);
  const recent=earned.slice(0,3);
  return <main className="awards-screen" style={theme} data-theme={resolved}>
    <header className="awards-header"><Link href="/profile" aria-label="Back to profile">‹</Link><b>Awards</b><span/></header>
    <div className="awards-content">
      <section className="awards-intro"><small>THE WORK ADDS UP.</small><h1>Your training record</h1><p>Consistency and meaningful milestones, collected over time.</p></section>
      {error?<section className="awards-error"><b>Awards need one final setup step</b><p>{error}</p></section>:!data?<section className="awards-loading">Building your training record…</section>:<>
        <section className="awards-summary"><div><strong>{earned.length}</strong><span>AWARDS EARNED</span></div><div><strong>{data.streaks.activeWeeks.current}</strong><span>CURRENT WEEKS</span></div><div><strong>{data.streaks.activeWeeks.longest}</strong><span>LONGEST</span></div></section>
        <section className="streak-record"><header><span>CONSISTENCY</span><h2>Current and best</h2></header><div>{([['Active weeks',data.streaks.activeWeeks],['Training days',data.streaks.trainingDays],['Weekly goal',data.streaks.weeklyGoal],['Planned weeks',data.streaks.plannedWeeks],['Days with Setra',data.streaks.setraUse]] as const).map(([label,streak])=><article key={label}><span>{label}</span><b>{streak.current} current</b><small>{streak.longest} best</small></article>)}</div><p>Rest days do not affect Active Weeks. Training Days is a separate literal day-to-day record.</p></section>
        {recent.length?<section className="recent-awards"><header><span>RECENTLY EARNED</span><h2>Latest additions</h2></header><div>{recent.map(item=>{const award=displayAward(item,data.preferredUnit);return <AwardBadge key={award.definition.id} award={award} onClick={()=>setSelected(award)}/>})}</div></section>:null}
        <section className="awards-sections" aria-label="Award sections">
          {categories.map(category=>{const visible=data.awards.filter(item=>item.definition.category===category).filter(item=>!item.definition.secret||item.earned),earnedCount=visible.filter(item=>item.earned).length;if(!visible.length)return null;return <button key={category} aria-expanded={openSection===category} className={openSection===category?"is-open":""} onClick={()=>setOpenSection(current=>current===category?null:category)}><span><small>{awardCategoryLabels[category].toUpperCase()}</small><b>{awardCategoryLabels[category]}</b><em>{earnedCount} of {visible.length} earned</em></span><i>›</i></button>})}
        </section>
        {categories.map(category=>{if(openSection!==category)return null;const items=data.awards.filter(item=>item.definition.category===category).filter(item=>!item.definition.secret||item.earned).map(item=>displayAward(item,data.preferredUnit));if(!items.length)return null;return <section className="award-category expanded-awards-section" key={category}><header><span>{awardCategoryLabels[category].toUpperCase()}</span><h2>{awardCategoryLabels[category]}</h2></header><div>{items.map(award=><AwardBadge key={award.definition.id} award={award} onClick={()=>setSelected(award)}/>)}</div></section>})}
      </>}
    </div>
    {selected?<div className="award-detail-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setSelected(null)}}><section className="award-detail" role="dialog" aria-modal="true"><button className="award-close" onClick={()=>setSelected(null)} aria-label="Close award">×</button><AwardMark icon={selected.definition.icon} locked={!selected.earned} large/><small>{selected.earned?"AWARD EARNED":"IN PROGRESS"}</small><h2>{selected.definition.title}</h2><p>{selected.definition.description}</p>{selected.earned?<><b>Earned {new Intl.DateTimeFormat("en-AU",{day:"numeric",month:"long",year:"numeric"}).format(new Date(selected.earnedAt!))}</b>{selected.definition.secret?<em>Hidden achievement</em>:null}<button className="award-share" onClick={()=>{setSharing(selected);setSelected(null)}}>Share award <span>↗</span></button></>:<><b>{progressText(selected)}</b><i className="award-progress"><span style={{width:`${selected.progress*100}%`}}/></i></>}</section></div>:null}
    {sharing?<ShareStudio items={[awardShareData(sharing)]} accent={colour} onClose={()=>setSharing(null)}/>:null}
  </main>
}
