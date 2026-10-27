import { Stack } from "expo-router";

export const unstable_settings = {
  anchor: "analytics-screen",
};
export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="analytics-screen" options={{ headerShown: false }} />
    </Stack>
  );
}
