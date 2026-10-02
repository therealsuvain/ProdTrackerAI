import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useSync } from "@/context/SyncContext";

interface SpinningRefreshIconProps {
  spinning: boolean;
  color: string;
}

const SpinningRefreshIcon = ({ spinning, color }: SpinningRefreshIconProps) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
    return () => cancelAnimation(rotation);
  }, [spinning]);

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={rotateStyle}>
      <Ionicons name="refresh-circle-outline" size={30} color={color} />
    </Animated.View>
  );
};

// Each wrapper subscribes to only the sync flag it needs.
export const ManualSyncIcon = ({ color }: { color: string }) => {
  const { isSyncing } = useSync();
  return <SpinningRefreshIcon spinning={isSyncing} color={color} />;
};

export const RestoreSyncIcon = ({ color }: { color: string }) => {
  const { isReplacingWorkspace } = useSync();
  return <SpinningRefreshIcon spinning={isReplacingWorkspace} color={color} />;
};
