import { FontAwesome6, Ionicons, MaterialIcons } from "@expo/vector-icons";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free.json";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Switch, TouchableRipple } from "react-native-paper";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { SettingItem } from "@/types/settings-ui";
import { WidgetRegistry } from "@/components/ui/settings/widgets/registry";
import { useSync } from "@/context/SyncContext";

interface SettingsRowProps {
  item: SettingItem;
  value?: any; // Simplified to boolean for toggles initially
  onToggle?: (id: string, newValue: boolean) => void;
  onPress?: (id: string, type: string, href?: string) => void;
  isLast: boolean;
}

export const SettingsRow = ({
  item,
  value,
  onToggle,
  onPress,
  isLast,
}: SettingsRowProps) => {
  const { theme, preference } = useTheme();
  const rotationMaunalSync = useSharedValue(0);
  const rotationRestoreSync = useSharedValue(0);
  const { isSyncing, isReplacingWorkspace } = useSync();

  if (preference === "system" && item.id === "isDarkMode") return null;
  const renderRightElement = () => {
    //console.log(item.id, value);
    switch (item.type) {
      case "toggle":
        return (
          <Switch
            thumbColor={theme.text}
            trackColor={{ false: theme.whiteBase, true: "red" }}
            value={value}
            onValueChange={(val) => onToggle && onToggle(item.id, val)}
          />
        );

      case "value-link":
        return (
          <View style={styles.valueLinkContainer}>
            <Text style={{ color: theme.text, marginRight: 8 }}>
              {value !== undefined ? String(value) : ""}
            </Text>
            <Ionicons name="chevron-forward" size={30} color={theme.text} />
          </View>
        );

      case "link":
        return <Ionicons name="chevron-forward" size={30} color={theme.text} />;

      case "action":
        if (item.id === "manualSyncEnabled" || item.id === "restoreRecovery") {
          return (
            <Animated.View
              style={
                item.id === "manualSyncEnabled"
                  ? rotateManualStyle
                  : rotateRestoreStyle
              }
            >
              <Ionicons
                name="refresh-circle-outline"
                size={30}
                color={theme.text}
              />
            </Animated.View>
          );
        }
        return null;

      default:
        return null;
    }
  };

  useEffect(() => {
    if (isSyncing) {
      rotationMaunalSync.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotationMaunalSync);
      rotationMaunalSync.value = 0;
    }
  }, [isSyncing]);

  useEffect(() => {
    if (isReplacingWorkspace) {
      rotationRestoreSync.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotationRestoreSync);
      rotationRestoreSync.value = 0;
    }
  }, [isReplacingWorkspace]);

  const rotateManualStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationMaunalSync.value}deg` }],
  }));

  const rotateRestoreStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotationRestoreSync.value}deg` }],
  }));

  const renderIcon = () => {
    if (item.icon in Ionicons.glyphMap) {
      return (
        <Ionicons
          name={item.icon as keyof typeof Ionicons.glyphMap}
          size={30}
          color={theme.text}
        />
      );
    }
    if (item.icon in MaterialIcons.glyphMap) {
      return (
        <MaterialIcons
          name={item.icon as keyof typeof MaterialIcons.glyphMap}
          size={30}
          color={theme.text}
        />
      );
    }
    if (item.icon in glyphMap) {
      return (
        <FontAwesome6
          name={item.icon as keyof typeof glyphMap}
          size={30}
          color={theme.text}
        />
      );
    }
    return null;
  };

  const renderOptions = () => {
    if (!item.options || item.options.length === 0) {
      return null;
    }

    return (
      <View>
        {item.options.map((option, index) => {
          switch (option.type) {
            case "widget": {
              // Ensure the value is a string and exists in our registry
              const WidgetComponent =
                typeof option.value === "string"
                  ? WidgetRegistry[option.value]
                  : null;

              if (WidgetComponent) {
                return <WidgetComponent key={`widget-${index}`} />;
              }

              console.warn(
                `[Settings] Widget component '${option.value}' not found in registry.`,
              );
              return null;
            }

            case "radio": {
              // Placeholder for future radio logic
              return (
                <View key={`radio-${index}`}>
                  <Text>Radio Component (Value: {String(option.value)})</Text>
                </View>
              );
            }

            case "dropdown": {
              // Placeholder for future dropdown logic
              return (
                <View key={`dropdown-${index}`}>
                  <Text>
                    Dropdown Component (Value: {String(option.value)})
                  </Text>
                </View>
              );
            }

            default:
              console.warn(`[Settings] Unknown option type: ${option.type}`);
              return null;
          }
        })}
      </View>
    );
  };

  const handleRowPress = () => {
    if (item.type === "toggle" && onToggle) {
      onToggle(item.id, !value);
    } else if (onPress) {
      onPress(item.id, item.type, item.href);
    }
  };

  return (
    <TouchableRipple
      rippleColor={"rgba(0, 0, 0, 0.75)"}
      onPress={handleRowPress}
      borderless
      style={{ borderRadius: 12, overflow: "hidden" }}
    >
      <View
        style={[
          styles.container,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.text,
          },
        ]}
      >
        <View style={styles.row}>
          <View style={styles.leftContent}>
            {renderIcon()}

            <Text style={[styles.label, { color: theme.text }]}>
              {item.label}
            </Text>
          </View>
          <View style={styles.rightContent}>{renderRightElement()}</View>
        </View>
        {renderOptions()}
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  label: {
    fontWeight: "500",
    marginLeft: 8,
    fontSize: 18,
  },
  rightContent: {
    justifyContent: "center",
  },
  valueLinkContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
});
