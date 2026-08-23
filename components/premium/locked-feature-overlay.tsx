import type { ReactNode } from "react";
import type { PremiumFeature,SubscriptionState } from "@/lib/premium/access";
import { hasPremiumAccess } from "@/lib/premium/access";
import { PremiumBadge } from "./premium-badge";

export function LockedFeatureOverlay({subscription,feature,children}:{subscription:SubscriptionState;feature:PremiumFeature;children:ReactNode}){
  if(hasPremiumAccess(subscription,feature))return <>{children}</>;
  return <div className="locked-feature"><div aria-hidden="true">{children}</div><div className="locked-feature-message"><PremiumBadge/><b>Premium feature</b><span>Coming soon</span></div></div>;
}
