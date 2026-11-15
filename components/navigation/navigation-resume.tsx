"use client";

import {useEffect,useRef} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {isRecentNavigationResume,resumableLocation,type NavigationResumeState} from "@/lib/navigation/resume-state";

export function NavigationResume(){
  const {user}=useAuth();
  const handled=useRef(false);
  const activeUser=useRef<string|null>(null);

  useEffect(()=>{
    if(!user?.id)return;
    if(activeUser.current!==user.id){activeUser.current=user.id;handled.current=false}
    if(handled.current)return;
    handled.current=true;
    const key=`setra-navigation-resume:${user.id}`;
    let resettingToToday=false;
    const current=()=>`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const read=()=>{try{return JSON.parse(sessionStorage.getItem(key)||"null") as NavigationResumeState|null}catch{return null}};
    const clear=()=>{try{sessionStorage.removeItem(key);sessionStorage.removeItem(`setra-current-tab:${user.id}`)}catch{/* Navigation remains usable when device storage is restricted. */}};
    const save=()=>{if(resettingToToday)return;const location=current();if(!resumableLocation(location))return;try{sessionStorage.setItem(key,JSON.stringify({location,backgroundedAt:Date.now()} satisfies NavigationResumeState))}catch{/* Navigation remains usable when device storage is restricted or full. */}};
    const saved=read();
    if(saved&&!isRecentNavigationResume(saved)){
      clear();
      if(current()!=="/"){
        resettingToToday=true;
        window.location.replace("/");
        return;
      }
    }
    else if(current()==="/"&&saved?.location!=="/"&&saved&&resumableLocation(saved.location)){
      window.location.replace(saved.location);
      return;
    }
    const onVisibilityChange=()=>{
      if(document.visibilityState==="hidden"){save();return}
      const resume=read();
      if(resume&&!isRecentNavigationResume(resume)){
        clear();
        resettingToToday=true;
        window.location.replace("/");
      }
    };
    document.addEventListener("visibilitychange",onVisibilityChange);
    window.addEventListener("pagehide",save);
    return()=>{document.removeEventListener("visibilitychange",onVisibilityChange);window.removeEventListener("pagehide",save)};
  },[user?.id]);

  return null;
}
