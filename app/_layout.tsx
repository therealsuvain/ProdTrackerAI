import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Drawer } from "expo-router/drawer";
import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import SuspenseBoundary from "@/components/suspense-boundary";
import { RootFallbackComponent } from "@/components/error-fallback-component";
import ThemeProvider from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Sidebar } from "@/components/ui/sidebar";
import DataProvider from "@/context/DataContext";
import TaskProvider from "@/context/TaskContext";
import HabitProvider from "@/context/HabitContext";
import EventProvider from "@/context/EventContext";
import LogProvider from "@/context/LogContext";
import ChatProvider from "@/context/ChatContext";
import TimerProvider from "@/context/TimerContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView>
      <ErrorBoundary FallbackComponent={RootFallbackComponent}>
        <ThemeProvider>
          <DataProvider>
            <TaskProvider>
              <HabitProvider>
                <EventProvider>
                  <LogProvider>
                    <TimerProvider>
                      <ChatProvider>
                        <SettingsProvider>
                          <Drawer
                            drawerContent={(props) => <Sidebar {...props} />}
                            screenOptions={{
                              headerShown: false, // Hide the default drawer header to let tabs handle their own headers
                              drawerStyle: {
                                width: "65%", // Standard sidebar width
                              },
                            }}
                          >
                            <Drawer.Screen
                              name="(tabs)"
                              options={{ headerShown: false }}
                            />
                            <Drawer.Screen
                              name="settings"
                              options={{ headerShown: false }}
                            />
                            <Drawer.Screen
                              name="achievements"
                              options={{ title: "Achievements" }}
                            />
                          </Drawer>
                          <StatusBar style="auto" />
                        </SettingsProvider>
                      </ChatProvider>
                    </TimerProvider>
                  </LogProvider>
                </EventProvider>
              </HabitProvider>
            </TaskProvider>
          </DataProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
