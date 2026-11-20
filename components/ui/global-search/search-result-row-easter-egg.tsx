import React, { useContext, useRef, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import type { GlobalSearchResult } from "@/types/global-search";
import { setRainSplashSurface } from "@/hooks/animations/easter-eggs/lighting-striker/rain-splash-surface-registry";

type RowMeasureRef = React.RefObject<View | null>;

interface Props {
  result: GlobalSearchResult;
  activationEnabled: boolean;
  // Pass the Pressable ref to the screen so the root-level animation controller
  // can measure this exact row relative to the shared animation canvas.
  onPress: (rowRef: RowMeasureRef, normaLizedX: number) => void;
  onLayout?: (rowRef: RowMeasureRef) => void;
  hintText?: string;
  hidden?: boolean;
}

export function GlobalSearchEasterEggRow({
  result,
  activationEnabled,
  onPress,
  onLayout,
  hintText,
  hidden = false,
}: Props) {
  const { theme } = useContext(ThemeContext);
  const rowRef = useRef<View | null>(null);
  const rowWidthRef = useRef(0);
  const { document } = result;
  const eggId = document.kind === "easterEgg" ? document.target.eggId : null;

  useEffect(() => {
    if (!eggId) return;
    const surfaceId = `easter-egg:${eggId}`;
    const node = rowRef.current;
    if (node) setRainSplashSurface(surfaceId, node, "top");
    return () => setRainSplashSurface(surfaceId, null);
  }, [eggId]);

  if (document.kind !== "easterEgg") return null;

  const accentColor =
    document.display.presentation?.accentColor ?? theme.taskBase;
  const iconName =
    document.display.presentation?.icon?.name ?? "star-four-points-outline";
  //-console.log("easter egg row , hidden prop", hidden);
  return (
    <Pressable
      ref={rowRef}
      /* onLayout={(eve) => onLayout?.(rowRef)} */
      onLayout={(event) => {
        rowWidthRef.current = event.nativeEvent.layout.width;
        onLayout?.(rowRef);
      }}
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={`${document.display.title}, Easter egg`}
      accessibilityHint={
        hintText ??
        (activationEnabled
          ? "Activate this hidden search surprise"
          : "This surprise's effect is not enabled yet")
      }
      /* onPress={() => onPress(rowRef)} */
      onPress={(event) => {
        const width = rowWidthRef.current;
        const normalizedX =
          width > 0
            ? Math.max(0, Math.min(1, event.nativeEvent.locationX / width))
            : 0.5;
        onPress(rowRef, normalizedX);
      }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: withAlpha(accentColor, "0D"),
          borderColor: withAlpha(accentColor, "55"),
          opacity: hidden ? 0 : pressed ? 0.78 : 1,
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

        {!!(hintText ?? document.display.subtitle) && (
          <Text
            variant={hintText ? "bodyLarge" : "bodySmall"}
            numberOfLines={2}
            style={{
              color: hintText ? accentColor : withAlpha(theme.text, "B5"),
              lineHeight: 19,
              fontWeight: hintText ? "600" : "400",
            }}
          >
            {hintText ?? document.display.subtitle}
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
