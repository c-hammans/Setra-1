"use client";

import {useEffect,useState} from "react";

export type AppearanceMode="light"|"dark"|"system";
export type TextScale=1|1.1|1.2|1.3;

export const textScalePercent=(scale:TextScale)=>`${Math.round(scale*100)}%`;

export function useResolvedAppearance(mode:AppearanceMode){
  const [systemDark,setSystemDark]=useState(false);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const update=()=>setSystemDark(media.matches);update();media.addEventListener?.("change",update);return()=>media.removeEventListener?.("change",update)},[]);
  return mode==="dark"||(mode==="system"&&systemDark)?"dark":"light";
}

export function contrastColour(hex:string){
  const channels=[1,3,5].map(index=>Number.parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
  const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
  const darkContrast=(luminance+.05)/.025;
  const lightContrast=1.05/(luminance+.05);
  return darkContrast>=lightContrast?"#0F172A":"#FFFFFF";
}
