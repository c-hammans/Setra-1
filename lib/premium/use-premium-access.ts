"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  DEFAULT_ACCESS,
  hasFeature,
  type AccessState,
  type FeatureKey,
} from "./access";
import { PremiumService } from "./premium-service";

export function usePremiumAccess() {
  const { user } = useAuth();
  const service = useMemo(() => (user ? new PremiumService(user.id) : null), [user]);
  const [access, setAccess] = useState<AccessState>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(Boolean(user));
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const refresh=()=>setRevision(value=>value+1);
    window.addEventListener("setra-billing-updated",refresh);
    return ()=>window.removeEventListener("setra-billing-updated",refresh);
  },[]);

  useEffect(() => {
    if (!service) {
      setAccess(DEFAULT_ACCESS);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    service
      .loadAccess()
      .then((value) => {
        if (active) setAccess(value);
      })
      .catch(() => {
        if (active) setAccess(DEFAULT_ACCESS);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [service,revision]);

  return {
    access,
    loading,
    canUse: (feature: FeatureKey) => hasFeature(access, feature),
    service,
  };
}
