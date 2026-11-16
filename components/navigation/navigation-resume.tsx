"use client";

import {useEffect,useRef} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {isRecentNavigationResume,mostRecentNavigationResume,resumableLocation,type NavigationResumeState} from "@/lib/navigation/resume-state";

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
    const read=()=>{
      const states:NavigationResumeState[]=[];
      for(const storage of [window.localStorage,window.sessionStorage]){
        try{const value=JSON.parse(storage.getItem(key)||"null") as NavigationResumeState|null;if(value)states.push(value)}catch{/* Try the other device storage. */}
      }
      return mostRecentNavigationResume(states);
    };
    const clear=()=>{
      for(const storage of [window.localStorage,window.sessionStorage])try{storage.removeItem(key)}catch{/* Navigation remains usable when device storage is restricted. */}
      try{sessionStorage.removeItem(`setra-current-tab:${user.id}`)}catch{/* Navigation remains usable when device storage is restricted. */}
    };
    const save=()=>{
      if(resettingToToday)return;
      const location=current();
      if(!resumableLocation(location))return;
      const view=document.querySelector(".workout-screen")?"live-workout" as const:undefined;
      const value=JSON.stringify({location,backgroundedAt:Date.now(),view} satisfies NavigationResumeState);
      for(const storage of [window.localStorage,window.sessionStorage])try{storage.setItem(key,value)}catch{/* The other device storage remains available as a fallback. */}
    };
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
