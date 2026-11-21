import type { ReactNode } from "react";
import type { AccessState,FeatureKey } from "@/lib/premium/access";
import { getRequiredPlan,getRequiredRole,hasFeature,PLAN_CATALOGUE } from "@/lib/premium/access";
import { PremiumBadge } from "./premium-badge";

export function LockedFeatureOverlay({access,feature,children}:{access:AccessState;feature:FeatureKey;children:ReactNode}){
  if(hasFeature(access,feature))return <>{children}</>;
  const requiredPlan=getRequiredPlan(feature);const requiredRole=getRequiredRole(feature);const label=requiredPlan?PLAN_CATALOGUE[requiredPlan].displayName:requiredRole==="coach"?"Coach":"Plan";
  return <div className="locked-feature"><div aria-hidden="true">{children}</div><div className="locked-feature-message"><PremiumBadge label={label}/><b>{label} feature</b><span>Coming soon</span></div></div>;
}
