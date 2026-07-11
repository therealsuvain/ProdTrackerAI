import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="analytics-screen" options={{ headerShown: false }} />
    </Stack>
  );
}
