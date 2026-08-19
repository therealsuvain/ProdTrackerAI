// components/ui/sidebar-content.tsx
import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Image } from "react-native";
import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { useRouter } from "expo-router";
import { Avatar } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { AvatarPickerModal } from "@/components/ui/avatar/avatar-picker-modal";
import { getAvatarSource, AvatarId } from "@/constants/avatars";

export const Sidebar = (props: any) => {
  const router = useRouter();
  const { theme } = useTheme();
  const { isAnonymous, userEmail, authLoaded, signOut } = useAuth();

  // NOTE: avatarId storage location is a decision for you — see explanation
  // below the code. This assumes a SettingsContext exposing avatarId +
  // a setter, matching your existing context conventions.
  const { settings, updateSetting } = useSettings();
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const displayName = isAnonymous ? "Guest" : (userEmail ?? "Guest");
  const displayTagline = isAnonymous
    ? "Using ProdTracker without an account"
    : "Stay Productive";

  const handleAvatarSelection = (avatarId: AvatarId) => {
    updateSetting("avatarId", {
      id: avatarId,
      updatedAt: new Date().toISOString(),
    });
  };
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
        <TouchableOpacity
          onPress={() => setAvatarPickerVisible(true)}
          disabled={!authLoaded}
        >
          <Image
            source={getAvatarSource(settings.avatarId.id)}
            style={styles.avatarImage}
          />
        </TouchableOpacity>
        <Text style={[styles.nameText, { color: theme.text }]}>
          {displayName}
        </Text>
        <Text style={[styles.taglineText, { color: theme.text }]}>
          {displayTagline}
        </Text>
      </View>

      {/* Navigation Items */}
      <View style={styles.navSection}>
        {isAnonymous ? (
          userEmail ? (
            <DrawerItem
              label="Sign in"
              labelStyle={{ color: theme.text }}
              icon={({ size }) => (
                <Ionicons
                  name="log-in-outline"
                  color={theme.text}
                  size={size}
                />
              )}
              onPress={() => router.push("/sign-in")}
            />
          ) : (
            <DrawerItem
              label="Create account"
              labelStyle={{ color: theme.text }}
              icon={({ size }) => (
                <Ionicons
                  name="log-in-outline"
                  color={theme.text}
                  size={size}
                />
              )}
              onPress={() => router.push("/sign-up")}
            />
          )
        ) : (
          <DrawerItem
            label="Sign Out"
            labelStyle={{ color: theme.text }}
            icon={({ size }) => (
              <Ionicons name="log-out-outline" color={theme.text} size={size} />
            )}
            onPress={() => signOut()}
          />
        )}

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
            <Ionicons
              name="stats-chart-outline"
              size={size}
              color={theme.text}
            />
          )}
          onPress={() => router.push("/analytics/analytics-screen")}
        />
      </View>
      <AvatarPickerModal
        visible={avatarPickerVisible}
        currentAvatarId={(settings.avatarId.id as AvatarId) ?? "avatar_1"}
        onSelect={handleAvatarSelection}
        onClose={() => setAvatarPickerVisible(false)}
      />
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
  avatarImage: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
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
