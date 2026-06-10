import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { TouchableOpacity } from "react-native";
import { DrawerActions, useNavigation } from "@react-navigation/native";
import { Provider as PaperProvider } from "react-native-paper";

import { useTheme } from "@/hooks/context-hooks/use-theme-colors";

export default function TabLayout() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: theme.greyBaseSecondary,
        },
        // transitionSpec: {
        //   animation: "timing",
        //   config: {
        //     duration: 1000,
        //     easing: Easing.inOut(Easing.ease),
        //   },
        // },
        animation: "shift",
        headerShadowVisible: false,
        headerTintColor: theme.whiteBase,
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            style={{ marginLeft: 10 }}
          >
            <Ionicons name="menu" size={28} color="white" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarActiveTintColor: theme.blueLightPrimary,
          tabBarInactiveTintColor: theme.whiteBase,
          headerStyle: {
            backgroundColor: theme.greyBaseSecondary,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home-sharp" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="task-screen"
        options={{
          title: "Tasks",
          tabBarActiveTintColor: theme.taskBase,
          tabBarInactiveTintColor: theme.whiteBase,
          headerStyle: {
            backgroundColor: theme.taskBase,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar-screen"
        options={{
          title: "Calendar",
          tabBarActiveTintColor: theme.eventBase,
          tabBarInactiveTintColor: theme.whiteBase,
          headerStyle: {
            backgroundColor: theme.eventBase,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="habits-screen"
        options={{
          title: "Habits",
          tabBarActiveTintColor: theme.habitBase,
          tabBarInactiveTintColor: theme.whiteBase,
          headerStyle: {
            backgroundColor: theme.habitBase,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="timer-screen"
        options={{
          title: "Timer",
          tabBarActiveTintColor: theme.timerBase,
          tabBarInactiveTintColor: theme.whiteBase,
          headerStyle: {
            backgroundColor: theme.timerBase,
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "alarm" : "alarm-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
