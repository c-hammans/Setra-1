"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {useParams} from "next/navigation";
import {useAuth} from "@/components/auth/auth-provider";
import {CoachingService} from "@/lib/coaching/coaching-service";
import type {CoachComment,CoachCommentTarget} from "@/lib/coaching/types";
import "./coach-comments-thread.css";

const stamp=(value:string)=>new Intl.DateTimeFormat("en-AU",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"S";

export function CoachCommentsThread({relationshipId,targetType,assignmentId,weekStart,readOnly=false,compact=false}:{relationshipId?:string;targetType:CoachCommentTarget;assignmentId?:string|null;weekStart?:string|null;readOnly?:boolean;compact?:boolean}){
  const params=useParams<{relationshipId?:string}>();const resolvedRelationshipId=relationshipId||String(params?.relationshipId||"");
  const {user}=useAuth();const service=useMemo(()=>user?new CoachingService():null,[user]);
  const [comments,setComments]=useState<CoachComment[]>([]);const [text,setText]=useState("");const [editing,setEditing]=useState<CoachComment|null>(null);const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);const [message,setMessage]=useState("");
  const load=useCallback(async()=>{if(!service||!resolvedRelationshipId)return;setLoading(true);try{setComments(await service.comments({relationshipId:resolvedRelationshipId,targetType,assignmentId,weekStart}))}catch(error){setMessage(error instanceof Error?error.message:"Comments could not be loaded.")}finally{setLoading(false)}},[assignmentId,resolvedRelationshipId,service,targetType,weekStart]);
  useEffect(()=>{void load()},[load]);
  async function save(){const body=text.trim();if(!service||!resolvedRelationshipId||!body||busy||readOnly)return;setBusy(true);setMessage("");try{await service.saveComment({relationshipId:resolvedRelationshipId,targetType,assignmentId,weekStart,body,commentId:editing?.id});setText("");setEditing(null);await load();setMessage(editing?"Comment updated.":"Comment sent.")}catch(error){setMessage(error instanceof Error?error.message:"The comment could not be saved.")}finally{setBusy(false)}}
  async function remove(comment:CoachComment){if(!service||busy||readOnly||!window.confirm("Delete this comment?"))return;setBusy(true);setMessage("");try{await service.deleteComment(comment.id);if(editing?.id===comment.id){setEditing(null);setText("")}await load();setMessage("Comment deleted.")}catch(error){setMessage(error instanceof Error?error.message:"The comment could not be deleted.")}finally{setBusy(false)}}
  function edit(comment:CoachComment){setEditing(comment);setText(comment.body)}
  function cancel(){setEditing(null);setText("")}
  return <section className={`coach-comments-thread${compact?" is-compact":""}`}><header><div><span>COMMENTS</span><small>{comments.length?`${comments.length} ${comments.length===1?"message":"messages"}`:"Coach and athlete conversation"}</small></div></header>{loading?<p className="coach-comments-state">Loading comments...</p>:<div className="coach-comments-list">{comments.map(comment=><article key={comment.id} className={comment.authorRole==="coach"?"is-coach":"is-client"}><i>{comment.authorAvatarUrl?<span style={{backgroundImage:`url(${comment.authorAvatarUrl})`}}/>:initials(comment.authorName)}</i><div><header><b>{comment.authorName}</b><em>{comment.authorRole==="coach"?"Coach":"Athlete"}</em><time>{stamp(comment.updatedAt)}</time></header><p>{comment.body}</p>{comment.canEdit&&!readOnly&&<footer><button onClick={()=>edit(comment)}>Edit</button><button onClick={()=>void remove(comment)}>Delete</button></footer>}</div></article>)}{!comments.length&&<p className="coach-comments-state">No comments yet.</p>}</div>}{readOnly?<p className="coach-comments-readonly">This coaching relationship has ended. The conversation is read-only.</p>:<div className="coach-comments-compose"><textarea maxLength={1200} value={text} onChange={event=>setText(event.target.value)} placeholder={editing?"Update your comment":"Add a comment or question"}/><div>{editing&&<button className="coach-comments-cancel" onClick={cancel}>Cancel</button>}<button disabled={busy||!text.trim()||text.trim()===editing?.body} onClick={()=>void save()}>{busy?"Saving...":editing?"Update":"Send"}</button></div></div>}{message&&<small className="coach-comments-message" role="status">{message}</small>}</section>;
}
