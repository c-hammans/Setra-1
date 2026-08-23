import type { ReactNode } from "react";
import type { PremiumFeature } from "@/lib/premium/access";
import { premiumFeatureCatalog } from "@/lib/premium/access";
import { PremiumBadge } from "./premium-badge";

export function PremiumFeatureCard({feature,eyebrow,children}:{feature:PremiumFeature;eyebrow?:string;children?:ReactNode}){
  const item=premiumFeatureCatalog[feature];
  return <article className="premium-feature-card"><header><span>{eyebrow||"COMING SOON"}</span><PremiumBadge compact/></header><h2>{item.title}</h2><p>{item.description}</p>{children}</article>;
}
