"use client";

import {useEffect,useMemo,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {contrastColour} from "@/lib/setra/appearance";
import {withTimeout} from "@/lib/async/with-timeout";
import {renderShareImage} from "@/lib/share/share-export";
import type {ShareBackgroundMode,ShareCardData,ShareFormat,ShareTextTone} from "@/lib/share/share-types";
import {SharePreview} from "@/components/share/share-card";
import {useDialogFocusTrap} from "@/components/ui/use-dialog-focus-trap";

type Props={items:ShareCardData[];accent:string;onClose:()=>void;footer?:ReactNode};
const modes:[ShareBackgroundMode,string][]=[["transparent","Transparent"],["photo","Photo"],["solid","Solid"],["gradient","Gradient"]];
const formats:[ShareFormat,string][]=[["square","Full"],["story","Story"],["sticker","Compact"]];

export function ShareStudio({items,accent,onClose,footer}:Props){
  useDialogFocusTrap(true);
  const closeButtonRef=useRef<HTMLButtonElement>(null);
  const photoUrlRef=useRef<string|undefined>(undefined);
  const [selected,setSelected]=useState(0);const [background,setBackground]=useState<ShareBackgroundMode>("transparent");const [format,setFormat]=useState<ShareFormat>("square");const [tone,setTone]=useState<ShareTextTone>("dark");const [photoUrl,setPhotoUrl]=useState<string>();const [photoX,setPhotoX]=useState(50);const [photoY,setPhotoY]=useState(50);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  const data=items[Math.min(selected,items.length-1)]||items[0];
  const options=useMemo(()=>({background,format,accent,textTone:tone,photoUrl,photoX,photoY}),[background,format,accent,tone,photoUrl,photoX,photoY]);
  const [prepared,setPrepared]=useState<{data:ShareCardData;options:typeof options;file:File;url:string;shareAgain:boolean}|null>(null);
  const exporting=useRef(false);
  const preparedUrl=prepared?.url;
  useEffect(()=>()=>{if(preparedUrl)URL.revokeObjectURL(preparedUrl)},[preparedUrl]);
  const ready=prepared?.data===data&&prepared.options===options?prepared:null;
  useEffect(()=>{if(background==="photo")setTone("light");else if(background==="solid"||background==="gradient")setTone(contrastColour(accent)==="#FFFFFF"?"light":"dark");else setTone("dark")},[background,accent]);
  useEffect(()=>()=>{if(photoUrlRef.current)URL.revokeObjectURL(photoUrlRef.current)},[]);
  useEffect(()=>{closeButtonRef.current?.focus();const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape)},[onClose]);
  const fileName=()=>`setra-${data.kind}-${data.id}.png`;
  const shareTitle=()=>data.kind==="pb"?"My Setra PB":data.kind==="award"?"My Setra award":"My Setra workout";
  const canShareFile=(file:File)=>typeof navigator.share==="function"&&typeof navigator.canShare==="function"&&navigator.canShare({files:[file]});
  async function exportCard(action:"download"|"share"){
    if(!data||exporting.current)return;
    exporting.current=true;setBusy(true);setMessage("");
    try{
      const file=ready?.file??new File([await withTimeout(renderShareImage(data,options),12000)],fileName(),{type:"image/png"});
      const prepare=(shareAgain:boolean,message:string)=>{
        setPrepared({data,options,file,url:ready?.url??URL.createObjectURL(file),shareAgain});
        setMessage(message);
      };
      if(action==="download"){
        prepare(false,"PNG ready. Tap Download file to open or save it.");
        return;
      }
      if(canShareFile(file)){
        if(navigator.userActivation?.isActive===false&&!ready){
          prepare(true,"Your image is ready. Tap Open share sheet to continue.");
          return;
        }
        try{
          await navigator.share({title:shareTitle(),files:[file]});
          return;
        }catch(error){
          if((error as Error).name==="AbortError")return;
          if((error as Error).name==="NotAllowedError"&&!ready){
            prepare(true,"Your image is ready. Tap Open share sheet to continue.");
            return;
          }
        }
      }
      prepare(false,"The share sheet is unavailable. Tap Download file to open or save the PNG.");
    }catch{setMessage("The image couldn’t be prepared. Try again or select a different photo.")}
    finally{exporting.current=false;setBusy(false)}
  }
  function choosePhoto(file?:File){if(!file)return;const nextUrl=URL.createObjectURL(file);if(photoUrlRef.current)URL.revokeObjectURL(photoUrlRef.current);photoUrlRef.current=nextUrl;setPhotoUrl(nextUrl);setBackground("photo")}
  if(!data)return null;
  return <div className="overlay high-overlay share-studio-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="share-studio" role="dialog" aria-modal="true" aria-labelledby="share-studio-title" tabIndex={-1}><header className="share-studio-heading"><div><span>SHARE THE WORK</span><h2 id="share-studio-title">Make it yours</h2></div><button data-dialog-initial-focus ref={closeButtonRef} onClick={onClose} aria-label="Close share card">×</button></header>
    {items.length>1?<div className="share-item-selector" aria-label="Choose result">{items.map((item,index)=><button className={selected===index?"selected":""} key={item.id} onClick={()=>setSelected(index)}>{item.title}</button>)}</div>:null}
    <SharePreview data={data} options={options}/>
    <div className="share-controls">
      <fieldset><legend>FORMAT</legend><div className="share-segmented">{formats.map(([value,label])=><button type="button" aria-pressed={format===value} className={format===value?"selected":""} key={value} onClick={()=>setFormat(value)}>{label}</button>)}</div></fieldset>
      <fieldset><legend>BACKGROUND</legend><div className="share-background-options">{modes.map(([value,label])=><button type="button" aria-pressed={background===value} className={background===value?"selected":""} key={value} onClick={()=>setBackground(value)}><i className={`background-swatch swatch-${value}`} style={{"--share-accent":accent} as CSSProperties}/>{label}</button>)}</div></fieldset>
      {background==="photo"?<div className="share-photo-controls"><label className="share-photo-picker">{photoUrl?"CHANGE PHOTO":"CHOOSE PHOTO"}<input type="file" accept="image/*" onChange={event=>{choosePhoto(event.target.files?.[0]);event.currentTarget.value=""}}/></label>{photoUrl?<><label>HORIZONTAL POSITION<input type="range" min="0" max="100" value={photoX} onChange={event=>setPhotoX(Number(event.target.value))}/></label><label>VERTICAL POSITION<input type="range" min="0" max="100" value={photoY} onChange={event=>setPhotoY(Number(event.target.value))}/></label></>:<small className="share-photo-hint">Choose an image to place it inside the tile.</small>}</div>:null}
      <fieldset><legend>TEXT</legend><div className="share-segmented"><button type="button" aria-pressed={tone==="dark"} className={tone==="dark"?"selected":""} onClick={()=>setTone("dark")}>Dark</button><button type="button" aria-pressed={tone==="light"} className={tone==="light"?"selected":""} onClick={()=>setTone("light")}>Light</button></div></fieldset>
    </div>
    <div className="share-export-actions">{ready?<a href={ready.url} download={ready.file.name} target="_blank" rel="noopener" onClick={()=>setMessage("Check your browser’s Downloads. If the image opens, touch and hold it for saving options.")}><span aria-hidden="true">↓</span>Download file</a>:<button type="button" disabled={busy} onClick={()=>void exportCard("download")}><span aria-hidden="true">↓</span>{busy?"Preparing…":"Download PNG"}</button>}<button type="button" disabled={busy} className="primary-share" onClick={()=>void exportCard("share")}><span aria-hidden="true">↗</span>{ready?.shareAgain?"Open share sheet":"Share"}</button></div>{message?<small className="share-status" role="status">{message}</small>:null}{footer}</section></div>
}
