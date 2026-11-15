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

const relativeLuminance=(hex:string)=>{
  const channels=[1,3,5].map(index=>Number.parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
};

export const contrastRatio=(foreground:string,background:string)=>{
  const values=[relativeLuminance(foreground),relativeLuminance(background)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};

const accessibleInk=(accent:string,background:string,dark:boolean)=>{
  const destination=dark?"#FFFFFF":"#0F172A";
  for(let amount=.82;amount>=0;amount-=.04){
    const candidate=mixHex(accent,destination,amount);
    if(contrastRatio(candidate,background)>=4.5)return candidate;
  }
  return destination;
};

export function useResolvedAppearance(mode:AppearanceMode){
  const [systemDark,setSystemDark]=useState(false);
  useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const update=()=>setSystemDark(media.matches);update();media.addEventListener?.("change",update);return()=>media.removeEventListener?.("change",update)},[]);
  return mode==="dark"||(mode==="system"&&systemDark)?"dark":"light";
}

export function contrastColour(hex:string){
  const darkContrast=contrastRatio("#0F172A",hex);
  const lightContrast=contrastRatio("#FFFFFF",hex);
  return darkContrast>=lightContrast?"#0F172A":"#FFFFFF";
}

export function createSetraTheme(accent:string,appearance:"light"|"dark",textScale:TextScale):CSSProperties{
  const dark=appearance==="dark";
  const page=dark?"#0B0F16":"#F7F8FA";
  const card=dark?"#151A22":"#FFFFFF";
  const subtle=dark?"#1C232D":"#EEF1F4";
  const neutral=dark?"#242C37":"#E7EBEF";
  const accentTint=mixHex(accent,page,dark?.16:.09);
  const accentInk=accessibleInk(accent,accentTint,dark);
  const strong=mixHex(accent,"#0F172A",dark?.5:.42);
  // Yellow becomes muddy when mixed into the standard strong surface. Keep the
  // yellow accent for actions, but place in-progress content on a warm neutral.
  const resumeSurface=accent.toUpperCase()==="#F6C445"?mixHex(accent,"#0F172A",dark?.05:.12):strong;
  return {
    "--accent":accent,
    "--accent-contrast":contrastColour(accent),
    "--accent-soft":mixHex(accent,"#FFFFFF",dark?.78:.7),
    "--accent-ink":accentInk,
    "--accent-tint":accentTint,
    "--accent-border":mixHex(accent,dark?"#10151D":"#FFFFFF",dark?.5:.45),
    "--accent-strong":strong,
    "--accent-strong-contrast":contrastColour(strong),
    "--resume-surface":resumeSurface,
    "--resume-surface-contrast":contrastColour(resumeSurface),
    "--surface-page":page,
    "--surface-card":card,
    "--surface-subtle":subtle,
    "--surface-neutral":neutral,
    "--surface-tint":mixHex(accent,page,dark?.13:.065),
    "--text-primary":dark?"#F4F6F8":"#0F172A",
    "--text-secondary":dark?"#BEC6D0":"#526071",
    "--text-muted":dark?"#929EAC":"#6B7787",
    "--border-subtle":dark?"#35404D":"#D8DEE5",
    "--border-control":dark?"#647181":"#8795A5",
    "--control-background":card,
    "--control-disabled":dark?"#202630":"#E9EDF1",
    "--success":dark?"#72D39A":"#187A46",
    "--success-surface":dark?"#153526":"#E5F5EC",
    "--warning":dark?"#F2C969":"#8A5A00",
    "--warning-surface":dark?"#382D14":"#FFF4D6",
    "--destructive":dark?"#FF9D9D":"#B4232E",
    "--destructive-surface":dark?"#3A1D22":"#FDEBED",
    "--disabled-opacity":"0.58",
    "--shadow-card":dark?"0 8px 26px #00000038":"0 6px 20px #0F172A12",
    "--shadow-nav":dark?"0 10px 35px #00000042":"0 10px 35px #0F172A14",
    "--radius-card":"18px",
    "--radius-control":"12px",
    "--text-scale-percent":textScalePercent(textScale),
    "--text-scale-number":textScale,
  } as CSSProperties;
}
