"use client";

import {useEffect,useMemo,useState,type CSSProperties,type ReactNode} from "react";
import {contrastColour} from "@/lib/setra/appearance";
import {renderShareImage} from "@/lib/share/share-export";
import type {ShareBackgroundMode,ShareCardData,ShareFormat,ShareTextTone} from "@/lib/share/share-types";
import {SharePreview} from "@/components/share/share-card";

type Props={items:ShareCardData[];accent:string;onClose:()=>void;footer?:ReactNode};
const modes:[ShareBackgroundMode,string][]=[["transparent","Transparent"],["photo","Photo"],["solid","Solid"],["gradient","Gradient"]];
const formats:[ShareFormat,string][]=[["square","Square"],["story","Story"],["sticker","Sticker"]];

export function ShareStudio({items,accent,onClose,footer}:Props){
  const [selected,setSelected]=useState(0);const [background,setBackground]=useState<ShareBackgroundMode>("transparent");const [format,setFormat]=useState<ShareFormat>("square");const [tone,setTone]=useState<ShareTextTone>("dark");const [photoUrl,setPhotoUrl]=useState<string>();const [photoX,setPhotoX]=useState(50);const [photoY,setPhotoY]=useState(50);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const data=items[Math.min(selected,items.length-1)]||items[0];
  const options=useMemo(()=>({background,format,accent,textTone:tone,photoUrl,photoX,photoY}),[background,format,accent,tone,photoUrl,photoX,photoY]);
  useEffect(()=>{if(background==="photo")setTone("light");else if(background==="solid"||background==="gradient")setTone(contrastColour(accent)==="#FFFFFF"?"light":"dark");else setTone("dark")},[background,accent]);
  useEffect(()=>()=>{if(photoUrl)URL.revokeObjectURL(photoUrl)},[photoUrl]);
  async function image(){if(!data)throw new Error("Share card unavailable");setBusy(true);setMessage("");try{return await renderShareImage(data,options)}finally{setBusy(false)}}
  const fileName=()=>`setra-${data.kind}-${data.id}.png`;
  const shareTitle=()=>data.kind==="pb"?"My Setra PB":"My Setra workout";
  const canShareFile=(file:File)=>typeof navigator.share==="function"&&typeof navigator.canShare==="function"&&navigator.canShare({files:[file]});
  function download(blob:Blob){const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=fileName();link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async function save(){try{const blob=await image();const file=new File([blob],fileName(),{type:"image/png"});if(canShareFile(file)){setMessage("Choose Save Image to add this card to Photos.");await navigator.share({title:`Save ${shareTitle()}`,files:[file]});setMessage("Card sent to your iPhone share sheet.")}else{download(blob);setMessage("Saved as a high-resolution PNG.")}}catch(error){if((error as Error).name!=="AbortError")setMessage("The image could not be saved. Please try again.")}}
  async function share(){try{const blob=await image();const file=new File([blob],fileName(),{type:"image/png"});if(canShareFile(file))await navigator.share({title:shareTitle(),files:[file]});else{download(blob);setMessage("Sharing is unavailable here, so the image was downloaded instead.")}}catch(error){if((error as Error).name!=="AbortError")setMessage("Sharing is unavailable here. Use Save instead.")}}
  function choosePhoto(file?:File){if(photoUrl)URL.revokeObjectURL(photoUrl);if(!file){setPhotoUrl(undefined);return}setPhotoUrl(URL.createObjectURL(file));setBackground("photo")}
  if(!data)return null;
  return <div className="overlay high-overlay share-studio-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="share-studio" role="dialog" aria-modal="true" aria-labelledby="share-studio-title"><header className="share-studio-heading"><div><span>SHARE THE WORK</span><h2 id="share-studio-title">Make it yours</h2></div><button onClick={onClose} aria-label="Close share card">×</button></header>
    {items.length>1?<div className="share-item-selector" aria-label="Choose result">{items.map((item,index)=><button className={selected===index?"selected":""} key={item.id} onClick={()=>setSelected(index)}>{item.title}</button>)}</div>:null}
    <SharePreview data={data} options={options}/>
    <div className="share-controls">
      <fieldset><legend>FORMAT</legend><div className="share-segmented">{formats.map(([value,label])=><button type="button" className={format===value?"selected":""} key={value} onClick={()=>setFormat(value)}>{label}</button>)}</div></fieldset>
      <fieldset><legend>BACKGROUND</legend><div className="share-background-options">{modes.map(([value,label])=><button type="button" className={background===value?"selected":""} key={value} onClick={()=>setBackground(value)}><i className={`background-swatch swatch-${value}`} style={{"--share-accent":accent} as CSSProperties}/>{label}</button>)}</div></fieldset>
      {background==="photo"?<div className="share-photo-controls"><label className="share-photo-picker">CHOOSE PHOTO<input type="file" accept="image/*" onChange={event=>choosePhoto(event.target.files?.[0])}/></label>{photoUrl?<><label>HORIZONTAL POSITION<input type="range" min="0" max="100" value={photoX} onChange={event=>setPhotoX(Number(event.target.value))}/></label><label>VERTICAL POSITION<input type="range" min="0" max="100" value={photoY} onChange={event=>setPhotoY(Number(event.target.value))}/></label></>:null}</div>:null}
      <fieldset><legend>TEXT</legend><div className="share-segmented"><button type="button" className={tone==="dark"?"selected":""} onClick={()=>setTone("dark")}>Dark</button><button type="button" className={tone==="light"?"selected":""} onClick={()=>setTone("light")}>Light</button></div></fieldset>
    </div>
    <div className="share-export-actions"><button disabled={busy} onClick={save}><span>↓</span>{busy?"Preparing…":"Save"}</button><button disabled={busy} className="primary-share" onClick={share}><span>↗</span>Share</button></div>{message?<small className="share-status">{message}</small>:null}{footer}</section></div>
}
