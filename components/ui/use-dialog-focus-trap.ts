"use client";

import {useEffect} from "react";

const focusableSelector='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const dialogSelector='[role="dialog"],[role="alertdialog"],.overlay > section,.new-award-overlay > section';

export function useDialogFocusTrap(active:boolean){
  useEffect(()=>{
    if(!active)return;
    if(document.body.hasAttribute("data-setra-dialog-trap"))return;
    document.body.setAttribute("data-setra-dialog-trap","true");
    const returnTarget=document.activeElement as HTMLElement|null;
    let current:HTMLElement|null=null;
    let restoreBackground:(()=>void)|null=null;
    const visible=(item:HTMLElement)=>item.getClientRects().length>0;
    const focusable=(dialog:HTMLElement)=>Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(visible);
    const activate=()=>{
      const next=Array.from(document.querySelectorAll<HTMLElement>(dialogSelector)).filter(visible).at(-1)||null;
      if(next===current)return;
      restoreBackground?.();restoreBackground=null;current=next;
      if(!current)return;
      if(!current.hasAttribute("role"))current.setAttribute("role","dialog");
      current.setAttribute("aria-modal","true");
      if(!current.hasAttribute("aria-label")&&!current.hasAttribute("aria-labelledby")){
        const heading=current.querySelector<HTMLElement>("h1,h2,h3");
        if(heading){if(!heading.id)heading.id=`dialog-title-${Math.random().toString(36).slice(2)}`;current.setAttribute("aria-labelledby",heading.id)}
        else current.setAttribute("aria-label","Dialog");
      }
      if(!current.hasAttribute("tabindex"))current.tabIndex=-1;
      const overlay=current.parentElement;
      const siblings=overlay?.parentElement?Array.from(overlay.parentElement.children).filter(item=>item!==overlay) as HTMLElement[]:[];
      const prior=siblings.map(item=>({item,inert:item.inert,hidden:item.getAttribute("aria-hidden")}));
      siblings.forEach(item=>{item.inert=true;item.setAttribute("aria-hidden","true")});
      restoreBackground=()=>prior.forEach(({item,inert,hidden})=>{item.inert=inert;if(hidden==null)item.removeAttribute("aria-hidden");else item.setAttribute("aria-hidden",hidden)});
      if(!current.contains(document.activeElement)){
        const initial=current.querySelector<HTMLElement>("[data-dialog-initial-focus]")||focusable(current)[0]||current;
        queueMicrotask(()=>{if(current?.isConnected)initial.focus()});
      }
    };
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=="Tab"||!current)return;
      const items=focusable(current);if(!items.length){event.preventDefault();current.focus();return}
      const first=items[0],last=items.at(-1)!;
      if(event.shiftKey&&(document.activeElement===first||!current.contains(document.activeElement))){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&(document.activeElement===last||!current.contains(document.activeElement))){event.preventDefault();first.focus()}
    };
    activate();
    const observer=new MutationObserver(activate);observer.observe(document.body,{childList:true,subtree:true});
    document.addEventListener("keydown",trap,true);
    return()=>{observer.disconnect();document.removeEventListener("keydown",trap,true);restoreBackground?.();document.body.removeAttribute("data-setra-dialog-trap");if(returnTarget?.isConnected)queueMicrotask(()=>returnTarget.focus())};
  },[active]);
}
