"use client";

type Props={label?:string;accessibleLabel?:string;onUse:()=>void};

export function PreviousSetButton({label,accessibleLabel,onUse}:Props){
  return <button type="button" className="previous-set-value" disabled={!label} aria-label={label?accessibleLabel||`Use previous set: ${label}`:"No compatible previous set recorded"} onClick={onUse}>{label||"–"}</button>;
}
