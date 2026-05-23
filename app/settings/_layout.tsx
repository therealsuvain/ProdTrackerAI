import { Stack } from "expo-router";

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="settings-screen" options={{ headerShown: false }} />
      <Stack.Screen name="data-management" options={{ headerShown: false }} />
      <Stack.Screen
        name="category/category-settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="tags/tags-settings"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
