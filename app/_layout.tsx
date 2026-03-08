import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import {
  ThemeProvider as OuterThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { Drawer } from "expo-router/drawer";
import { Provider as PaperProvider } from "react-native-paper";
import { ErrorBoundary } from "react-error-boundary";

import SuspenseBoundary from "@/components/suspense-boundary";
import { FallbackComponent } from "@/components/error-fallback-component";
import ThemeProvider from "@/context/ThemeContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {Sidebar} from "@/components/ui/sidebar";
import TimerProvider from "@/context/TimerContext";
import DataProvider from "@/context/DataContext";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SettingsProvider>
      <ThemeProvider>
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
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <Stack>
            <Stack.Screen name="settings" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </Drawer>
        </TimerProvider>
        </DataProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
}
