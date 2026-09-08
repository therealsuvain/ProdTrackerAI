import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useEntitlement } from "@/context/EntitlementContext";
import { PlanTier, tierAtLeast } from "@/types/entitlement";
import { LockedFeaturePlaceholder } from "./locked-feature";
import { trackPaywallTrigger } from "@/utils/Account-utils/paywall-analytics";

type PaywallGateProps = {
  requiredTier: PlanTier;
  featureId: string;
  children: React.ReactNode;
};

export function PaywallGate({
  requiredTier,
  featureId,
  children,
}: PaywallGateProps) {
  const { plan, isLoaded } = useEntitlement();
  const router = useRouter();

  if (!isLoaded) return <ActivityIndicator />;

  if (!tierAtLeast(plan, requiredTier)) {
    return (
      <TouchableOpacity
        onPress={() => {
          trackPaywallTrigger(featureId, requiredTier);
          router.navigate({
            pathname: "/paywall-screen",
            params: {
              requiredTier,
              sourceFeatureId: featureId,
            },
          });
        }}
      >
        <LockedFeaturePlaceholder requiredTier={requiredTier} />
      </TouchableOpacity>
    );
  }

  return <>{children}</>;
}
