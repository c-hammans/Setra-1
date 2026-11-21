import assert from "node:assert/strict";
import test from "node:test";
import { FEATURE_CATALOGUE, getEntitlements, getPlanFeatures, getRequiredPlan, getRequiredRole, hasFeature, PLAN_CATALOGUE, type AccessState } from "./access.ts";

const access = (plan: AccessState["plan"], roles: AccessState["roles"] = ["athlete"]): AccessState => ({ plan, roles });

test("free includes every core entitlement and no Premium entitlement", () => {
  const entitlements = getEntitlements(access("free"));
  assert.equal(entitlements.has("strength_planning"), true);
  assert.equal(entitlements.has("friends"), true);
  assert.equal(entitlements.has("text_workout_import"), true);
  assert.equal(entitlements.has("advanced_analytics"), false);
  assert.equal(entitlements.has("image_ai_workout_import"), false);
});

test("Premium inherits Free without receiving Adaptive coaching", () => {
  const subject = access("premium");
  assert.equal(hasFeature(subject, "weekly_preview"), true);
  assert.equal(hasFeature(subject, "advanced_analytics"), true);
  assert.equal(hasFeature(subject, "advanced_integrations"), true);
  assert.equal(hasFeature(subject, "adaptive_programming"), false);
});

test("Adaptive inherits Free and Premium before adding AI coaching", () => {
  const subject = access("adaptive");
  assert.equal(hasFeature(subject, "history"), true);
  assert.equal(hasFeature(subject, "long_term_trends"), true);
  assert.equal(hasFeature(subject, "ai_weekly_review"), true);
  assert.equal(hasFeature(subject, "ask_setra_training"), true);
  assert.equal(hasFeature(subject, "user_approved_plan_changes"), true);
});

test("roles add role entitlements without changing the individual plan", () => {
  const subject = access("free", ["athlete", "coach"]);
  assert.equal(subject.plan, "free");
  assert.equal(hasFeature(subject, "manage_clients"), true);
  assert.equal(hasFeature(subject, "advanced_analytics"), false);
  assert.equal(hasFeature(access("premium"), "manage_clients"), false);
});

test("the central plan catalogue is the source of inherited plan entitlements", () => {
  assert.equal(PLAN_CATALOGUE.premium.inherits, "free");
  assert.equal(PLAN_CATALOGUE.adaptive.inherits, "premium");
  assert.equal(getPlanFeatures("premium").includes("friends"), true);
  assert.equal(getPlanFeatures("premium").includes("richer_training_analysis"), true);
  assert.equal(getPlanFeatures("adaptive").includes("advanced_analytics"), true);
  assert.equal(getRequiredPlan("ai_weekly_review"), "adaptive");
  assert.equal(getRequiredRole("manage_clients"), "coach");
  assert.equal(getRequiredPlan("manage_clients"), null);
  assert.equal(FEATURE_CATALOGUE.advanced_analytics.availability, "available_now");
});
