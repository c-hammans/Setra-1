"use client";

import {useEffect,useMemo,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {FriendsService} from "@/lib/social/friends-service";
import type {SocialConnection,SocialShareDraft} from "@/lib/social/types";
import "./social.css";

export function FriendShareDialog({draft,onClose}:{draft:SocialShareDraft;onClose:()=>void}){
  const {user}=useAuth();const service=useMemo(()=>user?new FriendsService(user.id):null,[user]);
  const [friends,setFriends]=useState<SocialConnection[]>([]);const [selected,setSelected]=useState<string[]>([]);const [state,setState]=useState<"loading"|"ready"|"saving"|"saved"|"error">("loading");const [message,setMessage]=useState("");
  useEffect(()=>{if(!service)return;service.friends().then(value=>{setFriends(value);setState("ready")}).catch(()=>{setState("error");setMessage("Friends could not be loaded.")})},[service]);
  async function share(){if(!service||!selected.length)return;setState("saving");try{await Promise.all(selected.map(id=>service.share(id,draft)));setState("saved");setMessage(`Shared with ${selected.length} ${selected.length===1?"friend":"friends"}.`)}catch(error){setState("error");setMessage(error instanceof Error?error.message:"This could not be shared.")}}
  return <div className="overlay high-overlay social-share-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="social-share-dialog" role="dialog" aria-modal="true" aria-labelledby="friend-share-title">
    <header><div><small>SHARE IN SETRA</small><h2 id="friend-share-title">Choose friends</h2></div><button onClick={onClose} aria-label="Close">×</button></header>
    <p className="social-share-title">{draft.title}</p>
    {state==="loading"&&<p className="social-empty">Loading friends…</p>}
    {state!=="loading"&&!friends.length&&<p className="social-empty">Add and accept a friend before sharing inside Setra.</p>}
    <div className="social-friend-picker">{friends.map(friend=><label key={friend.otherUserId}><input type="checkbox" checked={selected.includes(friend.otherUserId)} onChange={()=>setSelected(current=>current.includes(friend.otherUserId)?current.filter(id=>id!==friend.otherUserId):[...current,friend.otherUserId])}/><span className="social-avatar">{friend.displayName.slice(0,1).toUpperCase()}</span><span><b>{friend.displayName}</b><small>@{friend.username}</small></span><i>{selected.includes(friend.otherUserId)?"✓":""}</i></label>)}</div>
    {message&&<p className={`social-message ${state}`}>{message}</p>}
    <footer>{state==="saved"?<button className="primary-button" onClick={onClose}>Done</button>:<><button onClick={onClose}>Cancel</button><button className="primary-button" disabled={!selected.length||state==="saving"} onClick={share}>{state==="saving"?"Sharing…":"Share"}</button></>}</footer>
  </section></div>;
}
