import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  PlanTier,
  EntitlementSnapshot,
  defaultTokenLimitForTier,
} from "@/types/entitlement";
import { fetchEntitlementSnapshot } from "@/utils/Account-utils/entitlement-supa-repository";
type EntitlementState = {
  isLoaded: boolean;
  plan: PlanTier;
  tokenLimit: number;
  isInGracePeriod: boolean;
  // Silent, called on app foreground / after auth changes.
  // PLACEHOLDER Phase 6: backed by Purchases.syncPurchases() + local CustomerInfo re
  refreshEntitlement: () => Promise<void>;
  // User-initiated ONLY — never call automatically. Can trigger OS-level
  // sign-in prompts. Must be behind a visible button in Settings/Paywall.
  // PLACEHOLDER Phase 6: backed by Purchases.restorePurchases().
  restorePurchases: () => Promise<{ success: boolean; message: string }>;
};
const EntitlementContext = createContext<EntitlementState | null>(null);
export function EntitlementProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, authLoaded, isAnonymous } = useAuth();
  const [isLoaded, setIsLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<EntitlementSnapshot>({
    plan: "free",
    tokenLimitOverride: null,
    isInGracePeriod: false,
    gracePeriodUntil: null,
  });
  // ── Identity binding ──────────────────────────────────────────────────
  // RevenueCat's App User ID must always equal the current Supabase userId.
  // Never call logOut() to switch — always logIn() with the new ID directly.
  // This keeps entitlement identity riding on the same identity Phase 3's
  //Phase 4.3 — EntitlementContext
  // sync/recovery/transition logic already treats as authoritative.
  useEffect(() => {
    if (!authLoaded || !userId) return;
    // PLACEHOLDER Phase 6:
    // Purchases.logIn(userId).catch((err) => console.error("[Entitlement] logIn fail
    console.log("[Entitlement] Would bind RevenueCat identity to:", userId);
  }, [authLoaded, userId]);
  const refreshEntitlement = useCallback(async () => {
    if (!authLoaded || !userId) {
      setIsLoaded(true);
      return;
    }
    try {
      // PLACEHOLDER Phase 6: replace with real CustomerInfo read + server
      // reconciliation via profiles table (server is authoritative; see 4.6).
      const serverSnapshot = await fetchEntitlementSnapshot(userId);
      setSnapshot(serverSnapshot);
    } catch (err) {
      console.error("[Entitlement] refreshEntitlement failed:", err);
      // Fail closed to free tier on error — never fail open to a paid tier.
      setSnapshot({
        plan: "free",
        tokenLimitOverride: null,
        isInGracePeriod: false,
        gracePeriodUntil: null,
      });
    } finally {
      setIsLoaded(true);
    }
  }, [authLoaded, userId]);

  const restorePurchases = useCallback(async () => {
    if (isAnonymous) {
      return {
        success: false,
        message: "Sign in or create an account before restoring purchases.",
      };
    }
    try {
      // PLACEHOLDER Phase 6:
      // const info = await Purchases.restorePurchases();
      // ...map info to a fresh snapshot, setSnapshot(...)
      console.log("[Entitlement] Would call Purchases.restorePurchases()");
      return { success: true, message: "Purchases restored (placeholder)." };
    } catch (err) {
      console.error("[Entitlement] restorePurchases failed:", err);
      return { success: false, message: "Restore failed. Please try again." };
    }
  }, [isAnonymous]);

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  const tokenLimit =
    snapshot.tokenLimitOverride ?? defaultTokenLimitForTier(snapshot.plan);
  //console.log("[Paywall] Plan:", snapshot.plan);
  return (
    <EntitlementContext.Provider
      value={{
        isLoaded,
        plan: snapshot.plan,
        tokenLimit,
        isInGracePeriod: snapshot.isInGracePeriod,
        refreshEntitlement,
        restorePurchases,
      }}
    >
      {children}
    </EntitlementContext.Provider>
  );
}
export const useEntitlement = (): EntitlementState => {
  const ctx = useContext(EntitlementContext);
  if (!ctx)
    throw new Error("useEntitlement must be used within EntitlementProvider");
  return ctx;
};
