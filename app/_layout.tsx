import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { TouchableOpacity } from "react-native";
import "react-native-reanimated";
import { Drawer } from "expo-router/drawer";
import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";

import SuspenseBoundary from "@/components/suspense-boundary";
import { RootFallbackComponent } from "@/components/error-fallback-component";
import ThemeProvider from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { Sidebar } from "@/components/ui/sidebar";
import DataProvider from "@/context/DataContext";
import TaskProvider from "@/context/TaskContext";
import HabitProvider from "@/context/HabitContext";
import EventProvider from "@/context/EventContext";
import LogProvider from "@/context/LogContext";
import ChatProvider from "@/context/ChatContext";
import TimerProvider from "@/context/TimerContext";
import {
  Provider as PaperProvider,
  useTheme as usePaperTheme,
} from "react-native-paper";

export default function RootLayout() {
  //Note :  static color values from ThemeContext are usable, dont do not work when theme changes
  const paperTheme = usePaperTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                          <PaperProvider>
                            <Drawer
                              drawerContent={(props) => <Sidebar {...props} />}
                              screenOptions={{
                                //headerShown: false, // Hide the default drawer header to let tabs handle their own headers
                                drawerStyle: {
                                  width: "65%", // Standard sidebar width
                                },
                              }}
                            >
                              <Drawer.Screen
                                name="(tabs)"
                                options={{
                                  headerShown: false,
                                }}
                              />
                              <Drawer.Screen
                                name="settings"
                                options={({ navigation }) => ({
                                  title: "Settings",
                                  headerStyle: {
                                    backgroundColor: "#333333ff",
                                  },
                                  headerTitleStyle: {
                                    marginLeft: 5,
                                    fontSize: 35,
                                    fontWeight: "bold",
                                    color: "white",
                                  },
                                  headerLeft: () => (
                                    <TouchableOpacity
                                      // 2. You can now just call toggleDrawer() directly on this scoped object!
                                      onPress={() => navigation.toggleDrawer()}
                                      style={{ marginLeft: 10 }}
                                    >
                                      <Ionicons
                                        name="menu"
                                        size={28}
                                        color="white"
                                      />
                                    </TouchableOpacity>
                                  ),
                                })}
                              />
                              <Drawer.Screen
                                name="achievements"
                                options={({ navigation }) => ({
                                  title: "Achievements",
                                  headerStyle: {
                                    backgroundColor: "#333333ff",
                                  },
                                  headerTitleStyle: {
                                    marginLeft: 5,
                                    fontSize: 35,
                                    fontWeight: "bold",
                                    color: "white",
                                  },
                                  headerLeft: () => (
                                    <TouchableOpacity
                                      // 2. You can now just call toggleDrawer() directly on this scoped object!
                                      onPress={() => navigation.toggleDrawer()}
                                      style={{ marginLeft: 10 }}
                                    >
                                      <Ionicons
                                        name="menu"
                                        size={28}
                                        color="white"
                                      />
                                    </TouchableOpacity>
                                  ),
                                })}
                              />
                            </Drawer>
                            <StatusBar style="auto" />
                          </PaperProvider>
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
