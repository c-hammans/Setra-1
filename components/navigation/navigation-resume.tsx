"use client";

import {useEffect,useRef} from "react";
import {usePathname} from "next/navigation";
import {useAuth} from "@/components/auth/auth-provider";

const MAX_RESUME_AGE_MS=24*60*60*1000;
const resumableLocation=(value:string)=>value==="/"||/^\/(?:profile|premium|awards|import|support|legal)(?:[?#].*)?$/.test(value)||/^\/\?tab=(?:plan|history|pbs)(?:[&#].*)?$/.test(value);

type SavedLocation={location:string;savedAt:number};

export function NavigationResume(){
  const {user}=useAuth();
  const pathname=usePathname();
  const handled=useRef(false);
  const restoring=useRef(false);
  const activeUser=useRef<string|null>(null);

  useEffect(()=>{
    if(!user?.id)return;
    if(activeUser.current!==user.id){activeUser.current=user.id;handled.current=false;restoring.current=false}
    if(handled.current)return;
    handled.current=true;
    const key=`setra-last-location:${user.id}`;
    const current=()=>`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const save=()=>{const location=current();if(!resumableLocation(location))return;try{localStorage.setItem(key,JSON.stringify({location,savedAt:Date.now()} satisfies SavedLocation))}catch{/* Navigation remains usable when device storage is restricted or full. */}};

    if(current()==="/"){
      try{
        const saved=JSON.parse(localStorage.getItem(key)||"null") as SavedLocation|null;
        if(saved&&saved.location!=="/"&&resumableLocation(saved.location)&&Date.now()-saved.savedAt<=MAX_RESUME_AGE_MS){
          restoring.current=true;
          window.location.replace(saved.location);
          return;
        }
      }catch{/* Ignore an invalid or unavailable device cache. */}
    }

    const onVisibilityChange=()=>{if(document.visibilityState==="hidden")save()};
    document.addEventListener("visibilitychange",onVisibilityChange);
    window.addEventListener("pagehide",save);
    return()=>{document.removeEventListener("visibilitychange",onVisibilityChange);window.removeEventListener("pagehide",save)};
  },[user?.id]);

  useEffect(()=>{
    if(!user?.id||restoring.current)return;
    const location=`${window.location.pathname}${window.location.search}${window.location.hash}`;
    if(resumableLocation(location))try{localStorage.setItem(`setra-last-location:${user.id}`,JSON.stringify({location,savedAt:Date.now()} satisfies SavedLocation))}catch{/* Safe fallback: the current page remains open. */}
  },[pathname,user?.id]);

  return null;
}
