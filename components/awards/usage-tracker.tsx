"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {syncAwards} from "@/lib/awards/awards-service";

export function AwardsUsageTracker(){const pathname=usePathname();useEffect(()=>{if(pathname==="/"||pathname==="/awards")return;const date=new Date().toLocaleDateString("en-CA");const key=`setra-awards-usage:${date}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,"1");syncAwards().catch(()=>sessionStorage.removeItem(key))},[pathname]);return null}

