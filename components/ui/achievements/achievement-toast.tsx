import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text, Surface, useTheme } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { AchievementBadge } from "@/types/achievements";

interface AchievementToastProps {
  badge: AchievementBadge | null;
}

export const AchievementToast = ({ badge }: AchievementToastProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150); // Start hidden off-screen
  const router = useRouter();
  
  const handleToastPress = () => {
    console.log("Badge:", badge);
    if (!badge?.id) return;
    console.log("Badge ID:", badge.id);
    router.push({
      pathname: "/achievements", // Change to your actual route path
      params: { targetBadgeId: badge.id },
    });
  };

  useEffect(() => {
    if (badge) {
      // Slide down with a bouncy spring
      translateY.value = withSpring(insets.top + 10, {
        damping: 12,
        stiffness: 90,
      });
    } else {
      // Slide back up out of view
      translateY.value = withTiming(-150, { duration: 400 });
    }
  }, [badge, insets.top, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case "diamond":
        return "#C71585";
      case "platinum":
        return "#E5E4E2";
      case "gold":
        return "#D4AF37";
      case "silver":
        return "#C0C0C0";
      case "bronze":
        return "#CD7F32";
      default:
        return theme.colors.primary;
    }
  };

  // We still render the component even if badge is null so the slide-out animation can play
  return (
    <Animated.View style={[styles.wrapper, animatedStyle, { zIndex: 9999 }]}>
      <Pressable /* style={{borderWidth: 4, borderColor: "white", padding:40}} */ onPress={handleToastPress}>
        <Surface
          style={[
            styles.container,
            { backgroundColor: theme.colors.elevation.level5 },
          ]}
          elevation={5}
        >
          <View
            style={[
              styles.iconRing,
              { borderColor: getTierColor(badge?.tier) },
            ]}
          >
            <Ionicons
              name="trophy"
              size={24}
              color={getTierColor(badge?.tier)}
            />
          </View>
          <View style={styles.textContainer}>
            <Text
              variant="labelMedium"
              style={{ color: getTierColor(badge?.tier), fontWeight: "bold" }}
            >
              ACHIEVEMENT UNLOCKED
            </Text>
            <Text
              variant="titleMedium"
              style={{ color: theme.colors.onSurface, fontWeight: "700" }}
            >
              {badge?.title || ""}
            </Text>
          </View>
        </Surface>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    pointerEvents: "auto", // Allows touches to pass through the empty space around the toast
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingRight: 24,
    borderRadius: 30,
    minWidth: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  textContainer: {
    justifyContent: "center",
  },
});
