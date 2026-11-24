export type IndividualPlan = "free" | "premium" | "adaptive";
export type UserRole = "athlete" | "coach";

export type FeatureKey =
  | "strength_planning"
  | "endurance_planning"
  | "workout_logging"
  | "templates"
  | "history"
  | "pbs"
  | "awards"
  | "friends"
  | "share_cards"
  | "weekly_preview"
  | "text_workout_import"
  | "advanced_analytics"
  | "long_term_trends"
  | "advanced_history_filters"
  | "data_export"
  | "advanced_integrations"
  | "image_ai_workout_import"
  | "richer_training_analysis"
  | "ai_weekly_review"
  | "ai_training_insights"
  | "ai_recommendations"
  | "adaptive_programming"
  | "ask_setra_training"
  | "user_approved_plan_changes"
  | "manage_clients"
  | "assign_client_training"
  | "view_client_training"
  | "view_client_history"
  | "coach_feedback";

export type FeatureAvailability = "available_now" | "coming_soon";
export type PlanAvailability = "available" | "early_access" | "coming_soon";

export type FeatureDefinition = {
  title: string;
  description: string;
  availability: FeatureAvailability;
};

export type PlanDefinition = {
  id: IndividualPlan;
  displayName: string;
  description: string;
  inherits: IndividualPlan | null;
  availability: PlanAvailability;
  entitlements: readonly FeatureKey[];
};

export type AccessState = { plan: IndividualPlan; roles: UserRole[] };

// Compatibility types for callers migrating from the original Premium API.
export type SubscriptionTier = IndividualPlan;
export type SubscriptionState = { tier: SubscriptionTier; status: "active" | "inactive" };

export const FEATURE_CATALOGUE = {
  strength_planning: { title: "Strength planning", description: "Build and schedule strength sessions.", availability: "available_now" },
  endurance_planning: { title: "Endurance planning", description: "Build and schedule endurance sessions.", availability: "available_now" },
  workout_logging: { title: "Workout logging", description: "Log planned and add-as-you-go training.", availability: "available_now" },
  templates: { title: "Templates", description: "Save reusable strength and endurance sessions.", availability: "available_now" },
  history: { title: "Training history", description: "Keep a clear record of completed training.", availability: "available_now" },
  pbs: { title: "Personal bests", description: "Track meaningful strength and endurance results.", availability: "available_now" },
  awards: { title: "Awards", description: "Recognise training milestones and consistency.", availability: "available_now" },
  friends: { title: "Friends", description: "Connect and share training with friends.", availability: "available_now" },
  share_cards: { title: "Share cards", description: "Create Setra workout and PB share cards.", availability: "available_now" },
  weekly_preview: { title: "Calendar and Weekly Preview", description: "See planned and completed training together.", availability: "available_now" },
  text_workout_import: { title: "Text workout import", description: "Turn pasted text and supported text files into templates.", availability: "available_now" },
  advanced_analytics: { title: "Advanced analytics", description: "Go beyond basic weekly progress with deeper training analysis.", availability: "available_now" },
  long_term_trends: { title: "Long-term trends", description: "Understand changes across longer training periods.", availability: "coming_soon" },
  advanced_history_filters: { title: "Advanced history filters", description: "Explore training history with richer filters and comparisons.", availability: "coming_soon" },
  data_export: { title: "Richer data export", description: "Export training data in more useful formats.", availability: "coming_soon" },
  advanced_integrations: { title: "Advanced integrations", description: "Connect selected health, wearable and training services.", availability: "coming_soon" },
  image_ai_workout_import: { title: "Image and file workout import", description: "Structure workouts from images and richer file formats.", availability: "coming_soon" },
  richer_training_analysis: { title: "Richer training analysis", description: "Turn the training record into clearer, actionable context.", availability: "coming_soon" },
  ai_weekly_review: { title: "AI weekly review", description: "Review the week with context from planned and completed training.", availability: "available_now" },
  ai_training_insights: { title: "Training insights", description: "Explain useful patterns in training history and progression.", availability: "coming_soon" },
  ai_recommendations: { title: "Training recommendations", description: "Offer relevant next steps grounded in the user's record.", availability: "coming_soon" },
  adaptive_programming: { title: "Adaptive programming", description: "Adjust programming as training and circumstances change.", availability: "coming_soon" },
  ask_setra_training: { title: "Training Q&A", description: "Ask Setra questions about the user's own training record.", availability: "coming_soon" },
  user_approved_plan_changes: { title: "User-approved plan changes", description: "Recommend changes without applying them until the user agrees.", availability: "coming_soon" },
  manage_clients: { title: "Manage clients", description: "Future coaching workspace capability.", availability: "coming_soon" },
  assign_client_training: { title: "Assign client training", description: "Future coaching workspace capability.", availability: "coming_soon" },
  view_client_training: { title: "View client training", description: "Future coaching workspace capability.", availability: "coming_soon" },
  view_client_history: { title: "View client history", description: "Future coaching workspace capability.", availability: "coming_soon" },
  coach_feedback: { title: "Coach feedback", description: "Future coaching workspace capability.", availability: "coming_soon" },
} as const satisfies Record<FeatureKey, FeatureDefinition>;

export const PLAN_CATALOGUE = {
  free: {
    id: "free",
    displayName: "Free",
    description: "Core Setra training.",
    inherits: null,
    availability: "available",
    entitlements: ["strength_planning", "endurance_planning", "workout_logging", "templates", "history", "pbs", "awards", "friends", "share_cards", "weekly_preview", "text_workout_import"],
  },
  premium: {
    id: "premium",
    displayName: "Premium",
    description: "Deeper analytics, imports, integrations and insights.",
    inherits: "free",
    availability: "early_access",
    entitlements: ["advanced_analytics", "long_term_trends", "advanced_history_filters", "data_export", "advanced_integrations", "image_ai_workout_import", "richer_training_analysis"],
  },
  adaptive: {
    id: "adaptive",
    displayName: "Adaptive",
    description: "Premium plus intelligent training guidance.",
    inherits: "premium",
    availability: "coming_soon",
    entitlements: ["ai_weekly_review", "ai_training_insights", "ai_recommendations", "adaptive_programming", "ask_setra_training", "user_approved_plan_changes"],
  },
} as const satisfies Record<IndividualPlan, PlanDefinition>;

const ROLE_ENTITLEMENTS = {
  athlete: [],
  coach: ["manage_clients", "assign_client_training", "view_client_training", "view_client_history", "coach_feedback"],
} as const satisfies Record<UserRole, readonly FeatureKey[]>;

export const PLAN_ORDER = ["free", "premium", "adaptive"] as const satisfies readonly IndividualPlan[];
export const DEFAULT_ACCESS: AccessState = { plan: "free", roles: ["athlete"] };
export const FREE_SUBSCRIPTION: SubscriptionState = { tier: "free", status: "active" };

export function normalizePlan(value: unknown): IndividualPlan {
  return value === "premium" || value === "adaptive" ? value : "free";
}

export function normalizeRoles(values: unknown): UserRole[] {
  if (!Array.isArray(values)) return ["athlete"];
  const roles = [...new Set(values.filter((value): value is UserRole => value === "athlete" || value === "coach"))];
  return roles.length ? roles : ["athlete"];
}

function addPlanEntitlements(plan: IndividualPlan, features: Set<FeatureKey>) {
  const definition = PLAN_CATALOGUE[plan];
  if (definition.inherits) addPlanEntitlements(definition.inherits, features);
  definition.entitlements.forEach((feature) => features.add(feature));
}

export function getEntitlements(access: AccessState): ReadonlySet<FeatureKey> {
  const features = new Set<FeatureKey>();
  addPlanEntitlements(access.plan, features);
  access.roles.forEach((role) => ROLE_ENTITLEMENTS[role].forEach((feature) => features.add(feature)));
  return features;
}

export function hasFeature(access: AccessState, feature: FeatureKey) {
  return getEntitlements(access).has(feature);
}

export function isPaidPlan(plan: IndividualPlan) {
  return plan === "premium" || plan === "adaptive";
}

export function getPlanFeatures(plan: IndividualPlan, inherited = true) {
  if (!inherited) return [...PLAN_CATALOGUE[plan].entitlements];
  const features = new Set<FeatureKey>();
  addPlanEntitlements(plan, features);
  return [...features];
}

export function getRequiredPlan(feature: FeatureKey): IndividualPlan | null {
  return PLAN_ORDER.find((plan) => (PLAN_CATALOGUE[plan].entitlements as readonly FeatureKey[]).includes(feature)) ?? null;
}

export function getRequiredRole(feature: FeatureKey): UserRole | null {
  return (Object.keys(ROLE_ENTITLEMENTS) as UserRole[]).find((role) => (ROLE_ENTITLEMENTS[role] as readonly FeatureKey[]).includes(feature)) ?? null;
}

/** @deprecated Prefer hasFeature with an AccessState. */
export function hasPremiumAccess(subscription: SubscriptionState, feature: FeatureKey = "advanced_analytics") {
  if (subscription.status !== "active") return false;
  return hasFeature({ plan: subscription.tier, roles: ["athlete"] }, feature);
}

export const premiumFeatureCatalog = FEATURE_CATALOGUE;
export type PremiumMarketingFeature = FeatureKey;
