import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { Drawer } from "expo-router/drawer";
import { ErrorBoundary } from "react-error-boundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider as PaperProvider } from "react-native-paper";

import SuspenseBoundary from "@/components/suspense-boundary";
import { FallbackComponent } from "@/components/error-fallback-component";
import ThemeProvider from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Sidebar } from "@/components/ui/sidebar";
import TimerProvider from "@/context/TimerContext";
import DataProvider from "@/context/DataContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
      <GestureHandlerRootView>
        <ThemeProvider>
          <SettingsProvider>
            <DataProvider>
              <TimerProvider>
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
              </TimerProvider>
            </DataProvider>
          </SettingsProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
  );
}
