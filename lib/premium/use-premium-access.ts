"use client";

import { useEffect,useMemo,useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { FREE_SUBSCRIPTION,hasPremiumAccess,type PremiumFeature,type SubscriptionState } from "./access";
import { PremiumService } from "./premium-service";

export function usePremiumAccess(){
  const {user}=useAuth();
  const service=useMemo(()=>user?new PremiumService(user.id):null,[user]);
  const [subscription,setSubscription]=useState<SubscriptionState>(FREE_SUBSCRIPTION);
  const [loading,setLoading]=useState(Boolean(user));
  useEffect(()=>{if(!service){setLoading(false);return}let active=true;service.loadSubscription().then(value=>{if(active)setSubscription(value)}).catch(()=>{if(active)setSubscription(FREE_SUBSCRIPTION)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[service]);
  return {subscription,loading,isPremium:hasPremiumAccess(subscription),canUse:(feature:PremiumFeature)=>hasPremiumAccess(subscription,feature),service};
}
