export type SubscriptionTier = "free" | "premium";

export type PremiumFeature =
  | "ai_coach"
  | "personalised_programming"
  | "weekly_reviews"
  | "recovery_insights"
  | "advanced_analytics"
  | "premium_integrations";

export type SubscriptionState = {
  tier: SubscriptionTier;
  status: "active" | "inactive";
};

export const FREE_SUBSCRIPTION:SubscriptionState={tier:"free",status:"active"};

export function hasPremiumAccess(subscription:SubscriptionState,feature?:PremiumFeature){
  void feature;
  return subscription.status==="active"&&subscription.tier==="premium";
}

export const premiumFeatureCatalog:Record<PremiumFeature,{title:string;description:string}>={
  ai_coach:{title:"AI Coach",description:"A training-aware conversation space built around your plans and history."},
  personalised_programming:{title:"Personalised programming",description:"Recommendations and program adjustments shaped by how you actually train."},
  weekly_reviews:{title:"Weekly reviews",description:"A clear review of consistency, progression and what to focus on next."},
  recovery_insights:{title:"Recovery insights",description:"Training and recovery signals brought together without losing the human context."},
  advanced_analytics:{title:"Advanced analytics",description:"Deeper strength trends, exercise progress and program-level patterns."},
  premium_integrations:{title:"Premium integrations",description:"A future home for selected health, wearable and coaching connections."},
};
