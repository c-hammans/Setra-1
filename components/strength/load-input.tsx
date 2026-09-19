"use client";

import {useEffect,useState} from "react";
import {canonicalLoadInput,loadInputValue,type StrengthUnit} from "@/lib/setra/units";

type Props={canonicalValue:string;unit:StrengthUnit;placeholder:string;ariaLabel:string;onCanonicalChange:(value:string)=>void};

/** Keeps partially typed decimals readable while persisting only canonical kilograms. */
export function LoadInput({canonicalValue,unit,placeholder,ariaLabel,onCanonicalChange}:Props){
  const [display,setDisplay]=useState(()=>loadInputValue(canonicalValue,unit));
  useEffect(()=>setDisplay(loadInputValue(canonicalValue,unit)),[canonicalValue,unit]);
  return <input aria-label={ariaLabel} inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" enterKeyHint="next" value={display} placeholder={placeholder} onChange={event=>{const next=event.target.value;setDisplay(next);if(next.trim()===""||Number.isFinite(Number(next.replace(",","."))))onCanonicalChange(canonicalLoadInput(next,unit))}}/>;
}
