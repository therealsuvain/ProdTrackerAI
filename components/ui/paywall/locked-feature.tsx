import React from "react";
import { View, Text } from "react-native";
import type { PlanTier } from "@/types/entitlement";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

export function LockedFeaturePlaceholder({
  requiredTier,
}: {
  requiredTier: PlanTier;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ padding: 16, opacity: 0.6 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.text }}>
        🔒 Requires {requiredTier}
      </Text>
    </View>
  );
}
