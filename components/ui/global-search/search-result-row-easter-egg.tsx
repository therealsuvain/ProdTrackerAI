import React, { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import type { GlobalSearchResult } from "@/types/global-search";
import { HelloThereEasterEggAnimation } from "@/hooks/animations/easter-eggs/hello-there-easter-egg-animation";

interface Props {
  result: GlobalSearchResult;
  activationEnabled: boolean;
  animationActive?: boolean;
  onAnimationFinished?: () => void;
  onPress: () => void;
}

export function GlobalSearchEasterEggRow({
  result,
  activationEnabled,
  animationActive = false,
  onAnimationFinished,
  onPress,
}: Props) {
  const { theme } = useContext(ThemeContext);

  const { document } = result;
  if (document.kind !== "easterEgg") return null;

  const accentColor =
    document.display.presentation?.accentColor ?? theme.taskBase;

  const iconName =
    document.display.presentation?.icon?.name ?? "star-four-points-outline";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${document.display.title}, Easter egg`}
      accessibilityHint={
        activationEnabled
          ? "Activate this hidden search surprise"
          : "This surprise's effect is not enabled yet"
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        animationActive && {
          position: "relative",
          zIndex: 1000,
          elevation: 20,
          overflow: "visible",
        },
        {
          backgroundColor: withAlpha(accentColor, "0D"),
          borderColor: withAlpha(accentColor, "55"),
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: withAlpha(accentColor, "20") },
        ]}
      >
        <MaterialCommunityIcons
          name={
            iconName as React.ComponentProps<
              typeof MaterialCommunityIcons
            >["name"]
          }
          size={24}
          color={accentColor}
        />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text
            variant="titleSmall"
            numberOfLines={1}
            style={{ color: theme.text, fontWeight: "700", flexShrink: 1 }}
          >
            {document.display.title}
          </Text>

          <View
            style={[
              styles.secretBadge,
              { backgroundColor: withAlpha(accentColor, "20") },
            ]}
          >
            <Text
              variant="labelSmall"
              style={{ color: accentColor, fontWeight: "700" }}
            >
              SECRET
            </Text>
          </View>
        </View>

        {!!document.display.subtitle && (
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: withAlpha(theme.text, "B5"), lineHeight: 19 }}
          >
            {document.display.subtitle}
          </Text>
        )}

        {!activationEnabled && (
          <Text
            variant="labelSmall"
            style={{ color: withAlpha(theme.text, "75"), marginTop: 3 }}
          >
            Effect design pending
          </Text>
        )}
      </View>

      <MaterialCommunityIcons
        name={activationEnabled ? "egg-easter" : "egg-fried"}
        size={20}
        color={withAlpha(accentColor, activationEnabled ? "FF" : "A8")}
      />
      {animationActive && (
        <HelloThereEasterEggAnimation
          active
          onFinished={onAnimationFinished ?? (() => {})}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 76,
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
  },
  secretBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
