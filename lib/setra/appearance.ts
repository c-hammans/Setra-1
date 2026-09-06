"use client";

import {useEffect,useState,type CSSProperties} from "react";

export type AppearanceMode="light"|"dark"|"system";
export type TextScale=1|1.1|1.2|1.3;

export const textScalePercent=(scale:TextScale)=>`${Math.round(scale*100)}%`;

export const mixHex=(foreground:string,background:string,amount:number)=>{
  const read=(colour:string,index:number)=>Number.parseInt(colour.slice(index,index+2),16);
  const channel=(index:number)=>Math.round(read(foreground,index)*amount+read(background,index)*(1-amount)).toString(16).padStart(2,"0");
  return `#${channel(1)}${channel(3)}${channel(5)}`;
};

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

export function createSetraTheme(accent:string,appearance:"light"|"dark",textScale:TextScale):CSSProperties{
  const dark=appearance==="dark";
  const page=dark?"#0B0F16":"#FFFFFF";
  const card=dark?"#151A22":"#FFFFFF";
  const neutral=dark?"#202630":"#F4F6F8";
  const strong=mixHex(accent,"#0F172A",dark?.5:.42);
  return {
    "--accent":accent,
    "--accent-contrast":contrastColour(accent),
    "--accent-soft":mixHex(accent,"#FFFFFF",dark?.78:.7),
    "--accent-ink":dark?mixHex(accent,"#FFFFFF",.76):mixHex(accent,"#0F172A",.72),
    "--accent-tint":mixHex(accent,dark?"#10151D":"#FFFFFF",dark?.18:.09),
    "--accent-border":mixHex(accent,dark?"#10151D":"#FFFFFF",dark?.42:.22),
    "--accent-strong":strong,
    "--accent-strong-contrast":contrastColour(strong),
    "--surface-page":page,
    "--surface-card":card,
    "--surface-neutral":neutral,
    "--surface-tint":mixHex(accent,page,dark?.13:.065),
    "--text-primary":dark?"#F4F6F8":"#0F172A",
    "--text-secondary":dark?"#AAB3BF":"#697386",
    "--border-subtle":dark?"#2B323D":"#EAEDEF",
    "--shadow-card":dark?"0 8px 26px #00000024":"0 8px 28px #0F172A0A",
    "--shadow-nav":dark?"0 10px 35px #00000042":"0 10px 35px #0F172A14",
    "--radius-card":"18px",
    "--radius-control":"12px",
    "--text-scale-percent":textScalePercent(textScale),
    "--text-scale-number":textScale,
  } as CSSProperties;
}
