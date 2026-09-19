export type StrengthUnit="kg"|"lb";

const POUNDS_PER_KILOGRAM=2.2046226218;
const rounded=(value:number,places=3)=>Number(value.toFixed(places));

/** Strength loads are always stored canonically in kilograms. */
export const kilogramsToDisplay=(kilograms:number,unit:StrengthUnit)=>unit==="lb"?kilograms*POUNDS_PER_KILOGRAM:kilograms;
export const displayToKilograms=(value:number,unit:StrengthUnit)=>rounded(unit==="lb"?value/POUNDS_PER_KILOGRAM:value);

export const formatLoad=(kilograms:number|string,unit:StrengthUnit,includeUnit=true)=>{
  const value=Number(kilograms);if(!Number.isFinite(value))return String(kilograms||"");
  const display=kilogramsToDisplay(value,unit);
  const formatted=new Intl.NumberFormat("en-AU",{maximumFractionDigits:display>=100?1:2}).format(display);
  return includeUnit?`${formatted} ${unit}`:formatted;
};

export const loadInputValue=(kilograms:string,unit:StrengthUnit)=>{
  if(kilograms.trim()==="")return "";const value=Number(kilograms);return Number.isFinite(value)?String(rounded(kilogramsToDisplay(value,unit),2)):kilograms;
};

export const canonicalLoadInput=(displayValue:string,unit:StrengthUnit)=>{
  if(displayValue.trim()==="")return "";const normalized=displayValue.replace(",",".");const value=Number(normalized);return Number.isFinite(value)?String(displayToKilograms(value,unit)):displayValue;
};
