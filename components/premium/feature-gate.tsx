import type { ReactNode } from "react";
import { getRequiredPlan, getRequiredRole, hasFeature, type AccessState, type FeatureKey } from "@/lib/premium/access";
import { UpgradePrompt } from "./upgrade-prompt";

export function FeatureGate({
  access,
  feature,
  children,
  fallback,
}: {
  access: AccessState;
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (hasFeature(access, feature)) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  const role = getRequiredRole(feature);
  if (role === "coach") return <UpgradePrompt eyebrow="SETRA COACH" title="Coach access required" body="Coaching access is managed separately from individual plans." href={null} />;
  return <UpgradePrompt plan={getRequiredPlan(feature) ?? "premium"} />;
}
