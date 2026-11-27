import { createClient } from "@/lib/supabase/client";
import {readEffectiveAccess} from "./effective-access";
import {
  DEFAULT_ACCESS,
  normalizePlan,
  normalizeRoles,
  type AccessState,
  type SubscriptionState,
} from "./access";

const missingRelation = (code?: string) => code === "42P01" || code === "PGRST205";
const missingColumn = (code?: string) => code === "42703" || code === "PGRST204";

export class PremiumService {
  private supabase = createClient();
  constructor(private userId: string) {}

  async loadAccess(): Promise<AccessState> {
    const effective=await readEffectiveAccess(this.supabase);
    if(effective)return effective;
    let plan = DEFAULT_ACCESS.plan;
    const profile = await this.supabase
      .from("profiles")
      .select("individual_plan,subscription_tier")
      .eq("id", this.userId)
      .single();

    if (profile.error && missingColumn(profile.error.code)) {
      const legacy = await this.supabase
        .from("profiles")
        .select("subscription_tier")
        .eq("id", this.userId)
        .single();
      if (legacy.error && !missingColumn(legacy.error.code)) throw legacy.error;
      plan = normalizePlan(legacy.data?.subscription_tier);
    } else if (profile.error) throw profile.error;
    else plan = normalizePlan(profile.data?.individual_plan ?? profile.data?.subscription_tier);

    const roleResult = await this.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", this.userId);
    if (roleResult.error && !missingRelation(roleResult.error.code)) throw roleResult.error;
    const roles = roleResult.error
      ? DEFAULT_ACCESS.roles
      : normalizeRoles(roleResult.data?.map((item) => item.role));
    return { plan, roles: [...roles] };
  }

  async loadSubscription(): Promise<SubscriptionState> {
    const access = await this.loadAccess();
    return { tier: access.plan, status: "active" };
  }

  async hasJoinedWaitlist() {
    const { data, error } = await this.supabase
      .from("premium_waitlist")
      .select("id")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) {
      if (missingRelation(error.code)) return false;
      throw error;
    }
    return Boolean(data);
  }

  async joinWaitlist(email: string, source = "premium-page") {
    const normalized = email.trim().toLowerCase();
    const { error } = await this.supabase
      .from("premium_waitlist")
      .insert({ user_id: this.userId, email: normalized, source });
    if (error && error.code !== "23505") throw error;
  }
}
