export type PlanTier = "free" | "starter" | "booster" | "gold";
export const TIER_ORDER: PlanTier[] = ["free", "starter", "booster", "gold"];
export function tierAtLeast(current: PlanTier, required: PlanTier): boolean {
return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}
// !Placeholder defaults — real values decided when tiers are finalized.
// !Kept centralized so changing a tier's default token limit is a one-line edit.
const TIER_TOKEN_LIMITS: Record<PlanTier, number> = {
free: 50,
starter: 200,
booster: 500,
gold: 2000,
};
export function defaultTokenLimitForTier(tier: PlanTier): number {
return TIER_TOKEN_LIMITS[tier];
}
export type EntitlementSnapshot = {
plan: PlanTier;
tokenLimitOverride: number | null; // from profiles.token_limit_override — token to
isInGracePeriod: boolean;
gracePeriodUntil: string | null;
};


/* ── ALTERNATE MODEL A: Boolean-only entitlement (rejected — see Phase 4.1 for why)
export type EntitlementSnapshot = {
isPaid: boolean;
tokenLimitOverride: number | null;
};
Rejected because retrofitting tiers later requires touching every `isPaid` call si
across the codebase. The tier model in 4.1 costs nothing extra and avoids this.

── ALTERNATE MODEL B: Subscription-vs-one-time distinction surfaced in the type ──
export type EntitlementSource = "subscription" | "one_time" | "none";
export type EntitlementSnapshot = {
plan: PlanTier;
source: EntitlementSource;
tokenLimitOverride: number | null;
};
Not adopted because RevenueCat's SDK already abstracts "is entitlement X active"
into one boolean regardless of whether it's backed by a subscription or a
non-consumable purchase. Surfacing `source` in the app's type model would only
matter if the UI needs to say "your subscription renews on X" vs "permanently
unlocked" — a real but deferrable UX enhancement. If added later, `source` can
be read directly from RevenueCat's CustomerInfo.entitlements at query time
Phase 4.2 — Alternate Model Variants (Commented Out, for Future Retrofit
Reference)
without changing the PlanTier/tierAtLeast gating logic anywhere else. */
