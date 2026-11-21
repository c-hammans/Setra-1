import type { ReactNode } from "react";
import type { PremiumMarketingFeature } from "@/lib/premium/access";
import { premiumFeatureCatalog } from "@/lib/premium/access";
import { PremiumBadge } from "./premium-badge";

export function PremiumFeatureCard({feature,eyebrow,children}:{feature:PremiumMarketingFeature;eyebrow?:string;children?:ReactNode}){
  const item=premiumFeatureCatalog[feature];
  const status=item.availability==="available_now"?"AVAILABLE NOW":"COMING SOON";
  return <article className="premium-feature-card"><header><span>{eyebrow||status}</span><PremiumBadge compact/></header><h2>{item.title}</h2><p>{item.description}</p>{children}</article>;
}
