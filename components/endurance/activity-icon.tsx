import type {TrainingActivityType} from "@/lib/setra/types";

export function ActivityIcon({type}:{type:TrainingActivityType}){
  return <span className={`activity-icon activity-icon-${type}`} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {type==="run"&&<><circle cx="20" cy="6" r="2.5"/><path d="m17 11 5 4 4-1M17 11l-4 7-6 2m10-2 4 3-3 7m-5-10 5 2"/></>}
    {type==="bike"&&<><circle cx="8" cy="23" r="5"/><circle cx="25" cy="23" r="5"/><path d="m8 23 6-10 5 10H8Zm6-10h6m-8-4h4m3 14 4-11"/></>}
    {type==="swim"&&<><circle cx="20" cy="9" r="2.5"/><path d="m5 18 7-5 7 4 7-1M3 22c3 0 3 2 6 2s3-2 6-2 3 2 6 2 3-2 6-2M3 27c3 0 3 2 6 2s3-2 6-2 3 2 6 2 3-2 6-2"/></>}
    {type==="row"&&<><path d="M5 24h22M8 24l4-6h9l4 6M13 17l4-7 5 3m-8-5 2 1"/><circle cx="14" cy="6" r="2"/></>}
    {type==="walk_hike"&&<><circle cx="18" cy="6" r="2.5"/><path d="m17 11-3 7-5 3m5-3 5 3 2 7m-7-10-1 10m5-14 5 3 3-1"/></>}
    {type==="elliptical"&&<><circle cx="18" cy="6" r="2.5"/><path d="m17 11-3 6 5 4 4 7M14 17l-4 10m9-15 5 3 3-1M6 27h21"/></>}
    {type==="cross_training"&&<><path d="M6 12h20M8 8v8m16-8v8M16 6v20M11 21h10"/></>}
    {type==="custom"&&<><circle cx="16" cy="16" r="11"/><path d="M16 10v6l4 3"/></>}
  </svg></span>;
}
