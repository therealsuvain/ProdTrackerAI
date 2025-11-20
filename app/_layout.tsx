import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import ThemeProvider from '@/context/ThemeContext';
import { ThemeProvider as YThemeProvider, DarkTheme , DefaultTheme } from '@react-navigation/native';


export default function RootLayout() {


  return (
    <YThemeProvider value={DarkTheme}>
    <ThemeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </YThemeProvider>
  );
}
