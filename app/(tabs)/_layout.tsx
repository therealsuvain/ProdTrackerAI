import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext } from "react";
import DataProvider from "@/context/DataContext";
import { Provider as PaperProvider} from "react-native-paper";
import { MD3LightTheme as DefaultTheme } from "react-native-paper";
import { Text } from "react-native";
import SuspenseBoundary from "@/components/suspense-boundary";
import { ErrorBoundary } from "react-error-boundary";
import { FallbackComponent } from "@/components/error-fallback-component";
import TimerProvider from "@/context/TimerContextC";
import { Easing } from "react-native-reanimated";
import ThemeProvider, { ThemeContext } from "@/context/ThemeContext";
import { useTheme } from "@/hooks/use-theme-colors";

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "rgb(0, 122, 255)", // Customize as needed
  },
};


export default function TabLayout() {
  const {theme:themeM} = useTheme()
  return (
    <DataProvider>
      <TimerProvider>
        <ThemeProvider>
        <PaperProvider theme={theme}>
          <ErrorBoundary FallbackComponent={FallbackComponent}>
            <Tabs
              screenOptions={{
                tabBarStyle: {
                  backgroundColor: themeM.greyBaseSecondary,
                },
                // transitionSpec: {
                //   animation: "timing",
                //   config: {
                //     duration: 1000,
                //     easing: Easing.inOut(Easing.ease),
                //   },
                // },
                animation:'fade',
                headerShadowVisible: false,
                headerTintColor: themeM.whiteBase,
              }}
            >
              <Tabs.Screen
                name="index"
                options={{
                  title: "Home",
                  tabBarActiveTintColor: themeM.whiteBaseTrans,
                  headerStyle: {
                    backgroundColor: themeM.greyBaseSecondary,
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
                  tabBarActiveTintColor: themeM.taskBase,
                  headerStyle: {
                    backgroundColor: themeM.taskBase,
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
                  tabBarActiveTintColor: themeM.eventBase,
                  headerStyle: {
                    backgroundColor: themeM.eventBase,
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
                  tabBarActiveTintColor: themeM.habitBase,
                  headerStyle: {
                    backgroundColor: themeM.habitBase,
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
                  tabBarActiveTintColor: themeM.timerBase,
                  headerStyle: {
                    backgroundColor: themeM.timerBase,
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
          </ErrorBoundary>
        </PaperProvider>
        </ThemeProvider>
      </TimerProvider>
    </DataProvider>
  );
}
