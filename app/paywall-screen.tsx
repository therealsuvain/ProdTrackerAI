import React from "react";
import { View, Text, Button, Alert, StyleSheet } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useEntitlement } from "@/context/EntitlementContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

export default function PaywallScreen() {
  const { isAnonymous } = useAuth();
  const { theme } = useTheme();
  const { plan, restorePurchases } = useEntitlement();

  const router = useRouter();
  const { requiredTier, sourceFeatureId } = useLocalSearchParams();
  const handleUpgradePress = () => {
    if (isAnonymous) {
      router.navigate({
        pathname: "/sign-up",
        params: {
          returnTo: "paywall",
          requiredTier: requiredTier ? requiredTier : "starter",
        },
      });
      return;
    }
    // PLACEHOLDER Phase 6: Purchases.purchasePackage(...)
    Alert.alert("Coming soon", "Payments aren't live yet.");
  };

  const handleRestorePress = async () => {
    const result = await restorePurchases();
    Alert.alert(result.success ? "Restored" : "Restore failed", result.message);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Unlock {requiredTier}
      </Text>
      <Text style={[styles.description, { color: theme.text }]}>
        Higher AI token limits, cloud sync, and more.
      </Text>

      {isAnonymous && (
        <Text style={[styles.secondaryDesc, { color: theme.text }]}>
          Create an account to purchase and keep access across devices.
        </Text>
      )}

      <Button
        title={plan === requiredTier ? "You're subscribed" : "Upgrade"}
        onPress={handleUpgradePress}
      />

      <Button title="Restore Purchases" onPress={handleRestorePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 36, fontWeight: "700", marginBottom: 8 },
  description: { fontSize: 30, opacity: 0.7, marginBottom: 20 },
  secondaryDesc: { fontSize: 20, opacity: 0.7, marginBottom: 20 },
});
