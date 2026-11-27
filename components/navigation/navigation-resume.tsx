"use client";

import {useEffect} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {isRecentNavigationResume,mostRecentNavigationResume,restoredLocation,resumableLocation,type NavigationResumeState} from "@/lib/navigation/resume-state";

export function NavigationResume(){
  const {user}=useAuth();
  useEffect(()=>{
    if(!user?.id)return;
    const key=`setra-navigation-resume:${user.id}`;
    let resettingToToday=false;
    const current=()=>`${window.location.pathname}${window.location.search}${window.location.hash}`;
    const read=()=>{
      const states:NavigationResumeState[]=[];
      for(const storage of ["localStorage","sessionStorage"] as const){
        try{const value=JSON.parse(window[storage].getItem(key)||"null") as NavigationResumeState|null;if(value)states.push(value)}catch{/* Try the other device storage. */}
      }
      return mostRecentNavigationResume(states);
    };
    const clear=()=>{
      for(const storage of ["localStorage","sessionStorage"] as const)try{window[storage].removeItem(key)}catch{/* Navigation remains usable when device storage is restricted. */}
      try{sessionStorage.removeItem(`setra-current-tab:${user.id}`)}catch{/* Navigation remains usable when device storage is restricted. */}
    };
    const save=()=>{
      if(resettingToToday)return;
      const location=current();
      if(!resumableLocation(location))return;
      const view=document.querySelector(".workout-screen")?"live-workout" as const:undefined;
      const value=JSON.stringify({location,backgroundedAt:Date.now(),view} satisfies NavigationResumeState);
      for(const storage of ["localStorage","sessionStorage"] as const)try{window[storage].setItem(key,value)}catch{/* The other device storage remains available as a fallback. */}
    };
    const saved=read();
    if(saved&&!isRecentNavigationResume(saved))clear();
    const restored=restoredLocation(current(),saved);
    if(restored){
      window.location.replace(restored);
      return;
    }
    const onVisibilityChange=()=>{
      if(document.visibilityState==="hidden"){save();return}
      const resume=read();
      if(resume&&!isRecentNavigationResume(resume)){
        clear();
        if(document.querySelector(".workout-screen"))return;
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
