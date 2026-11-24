"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { CoachingService } from "@/lib/coaching/coaching-service";
import {
  duplicateCoachProgram,
  duplicateEnduranceTemplate,
  duplicateStrengthTemplate,
  libraryMatches,
  type CoachLibraryType,
} from "@/lib/coaching/library";
import { coachGroupCanAssign } from "@/lib/coaching/groups";
import type { CoachGroup, CoachProgram, CoachingRelationship } from "@/lib/coaching/types";
import { DiaryService } from "@/lib/data/diary-service";
import { TrainingSessionService } from "@/lib/data/training-session-service";
import { usePremiumAccess } from "@/lib/premium/use-premium-access";
import { createSetraTheme, useResolvedAppearance } from "@/lib/setra/appearance";
import type { EnduranceTemplate, Template } from "@/lib/setra/types";
import { localDateKey } from "@/lib/setra/week";
import "./library.css";

type AssignTarget = { type: CoachLibraryType; id: string; name: string };
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const updatedLabel = (value?: string) => value
  ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
  : "Not recorded";

export default function CoachLibraryPage() {
  const { user } = useAuth();
  const { access, loading: accessLoading } = usePremiumAccess();
  const coaching = useMemo(() => user ? new CoachingService() : null, [user]);
  const diary = useMemo(() => user ? new DiaryService(user.id) : null, [user]);
  const endurance = useMemo(() => user ? new TrainingSessionService(user.id) : null, [user]);
  const [strength, setStrength] = useState<Template[]>([]);
  const [enduranceTemplates, setEnduranceTemplates] = useState<EnduranceTemplate[]>([]);
  const [programs, setPrograms] = useState<CoachProgram[]>([]);
  const [groups, setGroups] = useState<CoachGroup[]>([]);
  const [relationships, setRelationships] = useState<CoachingRelationship[]>([]);
  const [tab, setTab] = useState<"workouts" | "programs">("workouts");
  const [workoutType, setWorkoutType] = useState<"all" | "strength" | "endurance">("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [assignMode, setAssignMode] = useState<"clients" | "group">("clients");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [assignDate, setAssignDate] = useState(localDateKey());
  const [assignNote, setAssignNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accent, setAccent] = useState("#409ECE");
  const [appearance, setAppearance] = useState<"light" | "dark" | "system">("system");
  const [textScale, setTextScale] = useState<1 | 1.1 | 1.2 | 1.3>(1);
  const resolved = useResolvedAppearance(appearance);
  const coachEnabled = access.roles.includes("coach");

  const refresh = useCallback(async () => {
    if (!user || !coaching || !diary || !endurance) return;
    setLoading(true);
    try {
      const [data, enduranceRows, programRows, groupRows, relationRows, profile] = await Promise.all([
        diary.load(),
        endurance.loadEnduranceTemplates(),
        coaching.programs(true),
        coaching.groups(),
        coaching.list(),
        diary.loadProfile(),
      ]);
      setStrength(data.templates.filter((item) => !item.coachAssignmentId));
      setEnduranceTemplates(enduranceRows);
      setPrograms(programRows);
      setGroups(groupRows);
      setRelationships(relationRows);
      setAccent(profile.appColour);
      setAppearance(profile.appearanceMode);
      setTextScale(profile.textScale);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The Coach Library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [coaching, diary, endurance, user]);

  useEffect(() => { void refresh(); }, [refresh]);

  const clients = relationships.filter((item) => item.viewerRole === "coach" && item.status === "active" && item.assignTraining);
  const visibleStrength = strength.filter((item) => (workoutType === "all" || workoutType === "strength") && libraryMatches(item.name, query, item.archivedAt, showArchived));
  const visibleEndurance = enduranceTemplates.filter((item) => (workoutType === "all" || workoutType === "endurance") && libraryMatches(item.title, query, item.archivedAt, showArchived));
  const visiblePrograms = programs.filter((item) => libraryMatches(item.name, query, item.archivedAt, showArchived));
  const assignmentGroup = groups.find((group) => group.id === selectedGroup);

  async function run(work: () => Promise<unknown>, success: string) {
    if (busy) return;
    setBusy(true); setMessage("");
    try { await work(); await refresh(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : "That Library action could not be completed."); }
    finally { setBusy(false); }
  }

  function openAssign(target: AssignTarget) {
    setAssignTarget(target);
    setSelectedClients(new Set());
    const requestedGroup = new URLSearchParams(window.location.search).get("group");
    const matchingGroup = groups.find((group) => group.id === requestedGroup);
    setAssignMode(matchingGroup ? "group" : "clients");
    setSelectedGroup(matchingGroup?.id || groups[0]?.id || "");
    setAssignDate(localDateKey());
    setAssignNote("");
  }

  async function assign() {
    if (!coaching || !assignTarget || (assignMode === "clients" ? selectedClients.size === 0 : !selectedGroup)) return;
    const recipientCount = assignMode === "group" ? assignmentGroup?.members.length || 0 : selectedClients.size;
    await run(async () => {
      if (assignMode === "group") await coaching.assignGroupItem(selectedGroup, assignTarget.type, assignTarget.id, assignDate, assignNote);
      else await coaching.assignLibraryItemBulk(assignTarget.type, assignTarget.id, [...selectedClients], assignDate, assignNote);
      setAssignTarget(null);
    }, `${assignTarget.name} assigned to ${recipientCount} ${recipientCount === 1 ? "client" : "clients"}.`);
  }

  function renameStrength(template: Template) {
    const name = window.prompt("Rename workout", template.name)?.trim();
    if (name && name !== template.name) void run(() => diary!.saveTemplate({ ...template, name }), "Workout renamed.");
  }
  function renameEndurance(template: EnduranceTemplate) {
    const title = window.prompt("Rename workout", template.title)?.trim();
    if (title && title !== template.title) void run(() => endurance!.saveTemplate({ ...template, title }), "Workout renamed.");
  }
  function renameProgram(program: CoachProgram) {
    const name = window.prompt("Rename program", program.name)?.trim();
    if (name && name !== program.name) void run(() => coaching!.saveProgram({ ...program, name }), "Program renamed.");
  }

  const theme = createSetraTheme(accent, resolved, textScale);
  if (!accessLoading && !coachEnabled) return <main className="coach-library-screen" style={theme} data-theme={resolved}><section className="coach-library-denied"><b>Coach access required</b><p>Enable coach tools from Coaching before creating a Coach Library.</p><Link href="/coaching">Back to Coaching</Link></section></main>;

  return <main className="coach-library-screen" style={theme} data-theme={resolved}>
    <header className="coach-library-header"><Link href="/coaching" aria-label="Back to coaching">‹</Link><div><small>COACHING</small><b>Library</b></div><span /></header>
    <div className="coach-library-content">
      <section className="coach-library-intro"><div><span>COACH PROGRAM LIBRARY</span><h1>Your reusable training.</h1><p>Manage workouts and multi-week programs without exposing source content to clients.</p></div><div>{tab === "workouts" ? <><Link href="/import?return=%2Fcoaching%2Flibrary">Import workout</Link><Link href="/?tab=plan&newTemplate=endurance">New endurance</Link><Link className="primary" href="/?tab=plan&newTemplate=strength">New strength</Link></> : <Link className="primary" href="/coaching/programs?new=1">New program</Link>}</div></section>
      {message && <p className="coach-library-message" role="status">{message}</p>}
      <nav className="coach-library-tabs" aria-label="Library sections"><button className={tab === "workouts" ? "active" : ""} onClick={() => setTab("workouts")}>Workouts <small>{strength.filter(item=>!item.archivedAt).length + enduranceTemplates.filter(item=>!item.archivedAt).length}</small></button><button className={tab === "programs" ? "active" : ""} onClick={() => setTab("programs")}>Programs <small>{programs.filter(item=>!item.archivedAt).length}</small></button></nav>
      <section className="coach-library-tools"><label>SEARCH<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" /></label>{tab === "workouts" && <label>TYPE<select value={workoutType} onChange={(event) => setWorkoutType(event.target.value as typeof workoutType)}><option value="all">All workouts</option><option value="strength">Strength</option><option value="endurance">Endurance</option></select></label>}<label className="archive-toggle"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /><span>Archived</span></label></section>
      {loading ? <p className="coach-library-empty">Loading Library...</p> : tab === "workouts" ? <section className="coach-library-list">
        {visibleStrength.map((template) => <article key={`strength-${template.id}`}><div className="coach-library-item-main"><i>STR</i><span><small>STRENGTH</small><b>{template.name}</b><em>{template.exercises.length} exercises · {template.exercises.reduce((total, item) => total + item.sets, 0)} sets</em></span><time>Updated {updatedLabel(template.updatedAt)}</time></div><div className="coach-library-actions">{template.archivedAt ? <button onClick={() => void run(() => coaching!.setLibraryArchived("strength", template.id, false), "Workout restored.")}>Restore</button> : <><Link href={`/?tab=plan&editStrength=${encodeURIComponent(template.id)}`}>Open / edit</Link><button onClick={() => void run(() => diary!.saveTemplate(duplicateStrengthTemplate(template, newId("template-copy"))), "Workout duplicated.")}>Duplicate</button><button onClick={() => renameStrength(template)}>Rename</button><button onClick={() => openAssign({ type: "strength", id: template.id, name: template.name })}>Assign</button><button className="archive" onClick={() => void run(() => coaching!.setLibraryArchived("strength", template.id, true), "Workout archived.")}>Archive</button></>}</div></article>)}
        {visibleEndurance.map((template) => <article key={`endurance-${template.id}`}><div className="coach-library-item-main"><i>END</i><span><small>{template.activityType.replace("_", " ").toUpperCase()}</small><b>{template.title}</b><em>{template.plannedDistanceKm ? `${template.plannedDistanceKm} km` : template.plannedDurationMinutes ? `${template.plannedDurationMinutes} min` : `${template.blocks.length} structured items`}</em></span><time>Updated {updatedLabel(template.updatedAt)}</time></div><div className="coach-library-actions">{template.archivedAt ? <button onClick={() => void run(() => coaching!.setLibraryArchived("endurance", template.id, false), "Workout restored.")}>Restore</button> : <><Link href={`/?tab=plan&editEndurance=${encodeURIComponent(template.id)}`}>Open / edit</Link><button onClick={() => void run(() => endurance!.saveTemplate(duplicateEnduranceTemplate(template, newId("endurance-copy"))), "Workout duplicated.")}>Duplicate</button><button onClick={() => renameEndurance(template)}>Rename</button><button onClick={() => openAssign({ type: "endurance", id: template.id, name: template.title })}>Assign</button><button className="archive" onClick={() => void run(() => coaching!.setLibraryArchived("endurance", template.id, true), "Workout archived.")}>Archive</button></>}</div></article>)}
        {!visibleStrength.length && !visibleEndurance.length && <p className="coach-library-empty">No matching {showArchived ? "archived" : "active"} workouts.</p>}
      </section> : <section className="coach-library-list">
        {visiblePrograms.map((program) => <article key={program.id}><div className="coach-library-item-main"><i>PRG</i><span><small>MULTI-WEEK PROGRAM</small><b>{program.name}</b><em>{program.durationWeeks} weeks · {program.sessions.length} sessions{program.focus ? ` · ${program.focus}` : ""}</em></span><time>Updated {updatedLabel(program.updatedAt)}</time></div><div className="coach-library-actions">{program.archivedAt ? <button onClick={() => void run(() => coaching!.setLibraryArchived("program", program.id, false), "Program restored.")}>Restore</button> : <><Link href={`/coaching/programs?program=${program.id}`}>Open / edit</Link><button onClick={() => void run(() => coaching!.saveProgram(duplicateCoachProgram(program, () => crypto.randomUUID())), "Program duplicated.")}>Duplicate</button><Link href={`/coaching/programs?program=${program.id}&duplicate=1`}>Use as starting point</Link><button onClick={() => renameProgram(program)}>Rename</button><button onClick={() => openAssign({ type: "program", id: program.id, name: program.name })}>Assign</button><button className="archive" onClick={() => void run(() => coaching!.setLibraryArchived("program", program.id, true), "Program archived.")}>Archive</button></>}</div></article>)}
        {!visiblePrograms.length && <p className="coach-library-empty">No matching {showArchived ? "archived" : "active"} programs.</p>}
      </section>}
    </div>
    {assignTarget && <div className="coach-library-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignTarget(null); }}><section className="coach-library-assign" role="dialog" aria-modal="true" aria-labelledby="library-assign-title"><header><div><small>ASSIGN FROM LIBRARY</small><h2 id="library-assign-title">{assignTarget.name}</h2></div><button onClick={() => setAssignTarget(null)} aria-label="Close assignment">×</button></header><nav className="coach-library-recipient-tabs" aria-label="Assignment recipients"><button className={assignMode === "clients" ? "active" : ""} onClick={() => setAssignMode("clients")}>Client</button><button className={assignMode === "group" ? "active" : ""} disabled={!groups.length} onClick={() => setAssignMode("group")}>Group</button></nav>{assignMode === "clients" ? <div className="coach-library-client-list">{clients.map((client) => <label key={client.relationshipId} htmlFor={`library-client-${client.relationshipId}`}><span className="coach-library-visually-hidden">Select client</span><input id={`library-client-${client.relationshipId}`} type="checkbox" checked={selectedClients.has(client.relationshipId)} onChange={(event) => setSelectedClients((current) => { const next = new Set(current); if (event.target.checked) next.add(client.relationshipId); else next.delete(client.relationshipId); return next; })} /><span><b>{client.displayName}</b><small>@{client.username}</small></span></label>)}{!clients.length && <p>No active clients with assignment permission.</p>}</div> : <div className="coach-library-group-picker"><label><span>GROUP</span><select value={selectedGroup} onChange={(event) => setSelectedGroup(event.target.value)}>{groups.map((group) => <option value={group.id} key={group.id}>{group.name} · {group.members.length} clients</option>)}</select></label>{assignmentGroup && <section><b>Recipients</b>{assignmentGroup.members.map((member) => <p key={member.relationshipId}><span>{member.displayName}</span><small>{member.assignTraining ? `@${member.username}` : "Assignment access required"}</small></p>)}</section>}</div>}<label><span>{assignTarget.type === "program" ? "START DATE" : "SESSION DATE"}</span><input type="date" value={assignDate} onChange={(event) => setAssignDate(event.target.value)} /></label><label><span>OPTIONAL NOTE</span><textarea value={assignNote} maxLength={1000} onChange={(event) => setAssignNote(event.target.value)} /></label><footer><button onClick={() => setAssignTarget(null)}>Cancel</button><button className="primary" disabled={busy || (assignMode === "clients" ? selectedClients.size === 0 : !assignmentGroup || !coachGroupCanAssign(assignmentGroup))} onClick={() => void assign()}>Review and assign</button></footer></section></div>}
  </main>;
}
