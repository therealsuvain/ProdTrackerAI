import React from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { Switch, TouchableRipple } from "react-native-paper";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  FontAwesome6,
  FontAwesome,
} from "@expo/vector-icons";
import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/FontAwesome6Free.json";

import { SettingItem } from "@/types/settings-ui";
import { useTheme } from "@/hooks/use-theme-colors";

interface SettingsRowProps {
  item: SettingItem;
  value?: any; // Simplified to boolean for toggles initially
  onToggle?: (id: string, newValue: boolean) => void;
  onPress?: (id: string, href?: string) => void;
  isLast: boolean;
}

export const SettingsRow = ({
  item,
  value,
  onToggle,
  onPress,
  isLast,
}: SettingsRowProps) => {
  const { theme } = useTheme();
  const renderRightElement = () => {
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
        // Actions (like 'Delete All Data')
        return null;

      default:
        return null;
    }
  };
  const renderIcon = () => {
    /*   console.log("item.icon", item.icon);
    console.log("Ionicons.glyphMap", item.icon in Ionicons.glyphMap);
    console.log("MaterialCommunityIcons.glyphMap", item.icon in MaterialCommunityIcons.glyphMap);
    console.log("FontAwesome6.glyphMap", item.icon in glyphMap); */
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

  const handleRowPress = () => {
    if (item.type === "toggle" && onToggle) {
      onToggle(item.id, !value);
    } else if (onPress) {
      onPress(item.id, item.href);
    }
  };

  return (
    <TouchableRipple
      rippleColor={"rgba(0, 0, 0, 0.75)"}
      onPress={handleRowPress}
      borderless
      style={{ borderRadius: 12, overflow: "hidden" }}
    >
      {/* <Pressable
        android_ripple={{ color: "red" }}
        onPress={handleRowPress}
        style={{ borderRadius: 12, overflow: "hidden" }}
      > */}
      <View
        style={[
          styles.row,
          !isLast && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.text,
          },
        ]}
      >
        <View style={styles.leftContent}>
          {renderIcon()}
          {/* {item.icon in Ionicons.glyphMap ? (
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={30}
              color={theme.text}
            />
          ) : (
            <MaterialIcons
              name={item.icon as keyof typeof MaterialIcons.glyphMap}
              size={30}
              color={theme.text}
            />
          )} */}

          <Text style={[styles.label, { color: theme.text }]}>
            {item.label}
          </Text>
        </View>
        <View style={styles.rightContent}>{renderRightElement()}</View>
      </View>
    </TouchableRipple>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 44,
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
