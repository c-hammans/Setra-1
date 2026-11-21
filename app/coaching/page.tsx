"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {CoachingService} from "@/lib/coaching/coaching-service";
import type {CoachClientSummary,CoachingProfile,CoachingRelationship} from "@/lib/coaching/types";
import {DiaryService} from "@/lib/data/diary-service";
import {usePremiumAccess} from "@/lib/premium/use-premium-access";
import {createSetraTheme,useResolvedAppearance} from "@/lib/setra/appearance";
import {localDateKey} from "@/lib/setra/week";
import "./coaching.css";

const initials=(value:string)=>value.trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"S";

function Person({relationship,actions}:{relationship:CoachingRelationship;actions:React.ReactNode}){
  return <article className="coaching-person"><i>{initials(relationship.displayName)}</i><span><b>{relationship.displayName}</b><small>@{relationship.username}</small></span><div>{actions}</div></article>;
}

export default function CoachingPage(){
  const {user}=useAuth();
  const {access}=usePremiumAccess();
  const service=useMemo(()=>user?new CoachingService():null,[user]);
  const [relationships,setRelationships]=useState<CoachingRelationship[]>([]);
  const [clientSummaries,setClientSummaries]=useState<CoachClientSummary[]>([]);
  const [coachEnabled,setCoachEnabled]=useState(false);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<CoachingProfile[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [accent,setAccent]=useState("#409ECE");
  const [appearance,setAppearance]=useState<"light"|"dark"|"system">("system");
  const [textScale,setTextScale]=useState<1|1.1|1.2|1.3>(1);
  const resolvedAppearance=useResolvedAppearance(appearance);

  const refresh=useCallback(async()=>{
    if(!service||!user)return;
    setLoading(true);
    try{
      const [items,profile,summaries]=await Promise.all([service.list(),new DiaryService(user.id).loadProfile(),service.clientSummaries(localDateKey())]);
      setRelationships(items);
      setClientSummaries(summaries);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    }catch(error){setMessage(error instanceof Error?error.message:"Coaching relationships could not be loaded. Apply the Coaching migration first.")}
    finally{setLoading(false)}
  },[service,user]);

  useEffect(()=>{setCoachEnabled(access.roles.includes("coach"))},[access.roles]);
  useEffect(()=>{void refresh()},[refresh]);

  async function action(work:()=>Promise<unknown>,success:string){
    if(busy)return;
    setBusy(true);setMessage("");
    try{await work();setMessage(success);setResults([]);await refresh()}
    catch(error){setMessage(error instanceof Error?error.message:"That coaching action could not be completed.")}
    finally{setBusy(false)}
  }
  async function enableCoaching(){if(!service)return;await action(async()=>{await service.enableCoachRole();setCoachEnabled(true)},"Coach tools are ready.")}
  async function search(){if(!service||query.trim().length<2)return;setBusy(true);setMessage("");try{setResults(await service.search(query))}catch(error){setMessage(error instanceof Error?error.message:"Username search is unavailable.")}finally{setBusy(false)}}
  function confirmEnd(item:CoachingRelationship){if(!service||!window.confirm(`End the coaching relationship with ${item.displayName}? No training data will be deleted.`))return;void action(()=>service.end(item.relationshipId),"Coaching relationship ended.")}

  const activeClients=relationships.filter(item=>item.viewerRole==="coach"&&item.status==="active");
  const outgoing=relationships.filter(item=>item.viewerRole==="coach"&&item.status==="pending");
  const activeCoaches=relationships.filter(item=>item.viewerRole==="client"&&item.status==="active");
  const incoming=relationships.filter(item=>item.viewerRole==="client"&&item.status==="pending");
  const past=relationships.filter(item=>item.status==="declined"||item.status==="ended").slice(0,6);
  const theme=createSetraTheme(accent,resolvedAppearance,textScale);

  return <main className="coaching-screen" style={theme} data-theme={resolvedAppearance}>
    <header className="coaching-header"><Link href="/profile" aria-label="Back to profile">‹</Link><div><small>COACHING</small><b>Relationships</b></div><span/></header>
    <div className="coaching-content">
      <section className="coaching-intro"><span>SETRA COACHING</span><h1>Training, with consent.</h1><p>Coaching is separate from your plan and Friends. Clients stay in control of training access.</p></section>
      {message&&<p className="coaching-message" role="status">{message}</p>}
      {loading?<p className="coaching-empty">Loading coaching relationships...</p>:<>
        {incoming.length>0&&<section className="coaching-panel coaching-attention"><header><span>INVITATIONS</span><h2>Choose who coaches you</h2><p>Accepting lets this coach view your planned and completed sessions and assign training. You can remove access or end the relationship at any time.</p></header><div className="coaching-list">{incoming.map(item=><Person key={item.relationshipId} relationship={item} actions={<><button disabled={busy} onClick={()=>action(()=>service!.respond(item.relationshipId,false),"Invitation declined.")}>Decline</button><button className="primary" disabled={busy} onClick={()=>action(()=>service!.respond(item.relationshipId,true),"Coach invitation accepted.")}>Accept</button></>}/>)}</div></section>}

        <section className="coaching-panel"><header><span>MY COACHES</span><h2>{activeCoaches.length?`${activeCoaches.length} active ${activeCoaches.length===1?"coach":"coaches"}`:"No active coach"}</h2><p>Your individual Setra plan and Friends remain independent.</p></header>{activeCoaches.length?<div className="coaching-list">{activeCoaches.map(item=><Person key={item.relationshipId} relationship={item} actions={<><button disabled={busy} onClick={()=>action(()=>service!.setMvpPermissions(item.relationshipId,!(item.viewPlannedSessions&&item.viewCompletedSessions&&item.assignTraining)),item.viewPlannedSessions?"Coach training access removed.":"Coach training access enabled.")}>{item.viewPlannedSessions?"Remove access":"Allow training access"}</button><button className="danger" disabled={busy} onClick={()=>confirmEnd(item)}>End</button></>}/>)}</div>:<p className="coaching-empty">Accepted coaching relationships will appear here.</p>}</section>

        {!coachEnabled?<section className="coaching-panel coaching-start"><header><span>COACH WITH SETRA</span><h2>Enable coach tools</h2><p>This adds the coach role without changing your Free, Premium or Adaptive plan.</p></header><button className="coaching-primary" disabled={busy} onClick={enableCoaching}>Enable coaching</button></section>:<>
          <section className="coaching-panel"><header><span>CLIENTS</span><h2>{activeClients.length?`${activeClients.length} active ${activeClients.length===1?"client":"clients"}`:"No active clients"}</h2><p>Open a client to review their authorised week and assign training.</p></header>{activeClients.length?<div className="coach-client-list">{activeClients.map(item=>{const summary=clientSummaries.find(client=>client.relationshipId===item.relationshipId);return <article key={item.relationshipId}><Link href={`/coaching/${item.relationshipId}`}><i>{initials(item.displayName)}</i><span><b>{item.displayName}</b><small>@{item.username}</small>{summary?.permissionsReady?<em>{summary.completedSessions} of {summary.plannedSessions} sessions complete{summary.nextSessionTitle?` · Next: ${summary.nextSessionTitle}`:""}</em>:<em>Awaiting client training access</em>}</span><strong>›</strong></Link><button className="danger" disabled={busy} onClick={()=>confirmEnd(item)}>End</button></article>})}</div>:<p className="coaching-empty">Accepted client relationships will appear here.</p>}</section>

          <section className="coaching-panel"><header><span>PENDING INVITES</span><h2>{outgoing.length?`${outgoing.length} awaiting response`:"Nothing pending"}</h2></header>{outgoing.length?<div className="coaching-list">{outgoing.map(item=><Person key={item.relationshipId} relationship={item} actions={<button disabled={busy} onClick={()=>action(()=>service!.cancel(item.relationshipId),"Invitation cancelled.")}>Cancel</button>}/>)}</div>:<p className="coaching-empty">Invitations you send will remain here until answered or cancelled.</p>}</section>

          <section className="coaching-panel"><header><span>INVITE CLIENT</span><h2>Search by username</h2><p>Private email addresses are never exposed. Friends and coaching are separate relationships.</p></header><div className="coaching-search"><input value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void search()}} placeholder="@username" aria-label="Setra username"/><button disabled={busy||query.trim().length<2} onClick={search}>Search</button></div>{results.length>0&&<div className="coaching-results">{results.map(item=><article key={item.userId}><i>{initials(item.displayName)}</i><span><b>{item.displayName}</b><small>@{item.username}</small></span><button disabled={busy||item.relationshipStatus==="pending"||item.relationshipStatus==="active"} onClick={()=>action(()=>service!.invite(item.userId),"Coach invitation sent.")}>{item.relationshipStatus==="pending"?"Pending":item.relationshipStatus==="active"?"Client":"Invite"}</button></article>)}</div>}</section>
        </>}

        {past.length>0&&<section className="coaching-panel coaching-past"><header><span>PAST</span><h2>Previous relationships</h2></header><div>{past.map(item=><span key={item.relationshipId}><b>{item.displayName}</b><small>{item.status}</small></span>)}</div></section>}
      </>}
    </div>
  </main>;
}
