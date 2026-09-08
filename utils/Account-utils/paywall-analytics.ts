import type { PlanTier } from "@/types/entitlement";

export function trackPaywallTrigger(featureId: string, requiredTier: PlanTier): void {
  console.log("[Analytics] Paywall triggered:", {
    featureId,
    requiredTier,
    at: new Date().toISOString(),
  });
}