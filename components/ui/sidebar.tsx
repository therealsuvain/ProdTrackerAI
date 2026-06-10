// components/ui/sidebar-content.tsx
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { Avatar } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

export const Sidebar = (props: any) => {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
    >
      {/* Profile Header Section */}
      <View style={styles.profileSection}>
        <Avatar.Text
          size={64}
          label="PT"
          style={{ backgroundColor: theme.taskBase }}
        />
        <Text style={[styles.nameText, { color: theme.text }]}>
          ProdTracker User
        </Text>
        <Text style={[styles.taglineText, { color: theme.text }]}>
          Stay Productive
        </Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.navSection}>
        <DrawerItem
          label="Login / Signup"
          labelStyle={{ color: theme.text }}
          icon={({ size }) => (
            <Ionicons name="log-in-outline" size={size} color={theme.text} />
          )}
          onPress={() => {} /* router.push('/login') */}
        />
        <DrawerItem
          label="Home"
          labelStyle={{ color: theme.text }}
          icon={({ size }) => (
            <Ionicons name="home-outline" size={size} color={theme.text} />
          )}
          onPress={() => router.push("/(tabs)")}
        />
        <DrawerItem
          label="Settings"
          labelStyle={{ color: theme.text }}
          icon={({ size }) => (
            <Ionicons name="settings-outline" size={size} color={theme.text} />
          )}
          onPress={() => router.push("/settings/settings-screen")}
        />
        <DrawerItem
          label="Achievements"
          labelStyle={{ color: theme.text }}
          icon={({ size }) => (
            <Ionicons name="trophy-outline" size={size} color={theme.text} />
          )}
          onPress={() => router.push("/achievements")}
        />
        <DrawerItem
          label="Analytics"
          labelStyle={{ color: theme.text }}
          icon={({ size }) => (
            <Ionicons name="analytics-outline" size={size} color={theme.text} />
          )}
          onPress={() => {} /* router.push('/analytics') */}
        />
      </View>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileSection: {
    paddingLeft: 20,
    paddingBottom: 20,
    paddingTop: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  nameText: {
    fontWeight: "bold",
    marginTop: 12,
    fontSize: 22,
    letterSpacing: 0,
    lineHeight: 28,
  },
  taglineText: {
    fontSize: 14,
    fontWeight: "400",
    letterSpacing: 0.25,
    lineHeight: 20,
  },
  navSection: {
    paddingTop: 10,
  },
});
