import { supabase } from "@/utils/Account-utils/supabase-client";
import type { EntitlementSnapshot, PlanTier } from "@/types/entitlement";
const VALID_TIERS: PlanTier[] = ["free", "starter", "booster", "gold"];

function coercePlan(value: string | null): PlanTier {
return VALID_TIERS.includes(value as PlanTier) ? (value as PlanTier) : "free";
}
export async function fetchEntitlementSnapshot(userId: string): Promise<EntitlementSnapshot> {
const { data, error } = await supabase
    .from("profiles")
    .select("plan, token_limit_override, entitlement_grace_until")
    .eq("id", userId)
    .single();
if (error) {
    console.error("[Entitlement] Failed to fetch profile entitlement:", error);
    throw error;
}

const gracePeriodUntil = data.entitlement_grace_until as string | null;
const isInGracePeriod = gracePeriodUntil !== null && new Date(gracePeriodUntil).getTime() > Date.now();
//throw new Error("Function not implemented.");
return {
    plan: coercePlan(data.plan),
    tokenLimitOverride: data.token_limit_override ?? null,
    isInGracePeriod,
    gracePeriodUntil,
};
}
