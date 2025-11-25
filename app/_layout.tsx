import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import ThemeProvider from '@/context/ThemeContext';
import { ThemeProvider as YThemeProvider, DarkTheme , DefaultTheme } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';


export default function RootLayout() {
const colorScheme = useColorScheme()

  return (
    <YThemeProvider value={colorScheme==='dark'? DarkTheme : DefaultTheme }>
    <ThemeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
    </YThemeProvider>
  );
}
