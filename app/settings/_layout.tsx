import { Stack } from "expo-router";

export default function SettingsLayout(){
    return (
        <Stack>
            <Stack.Screen name="settings-screen" options={{ headerShown: false }} />
            <Stack.Screen name="data-management" options={{ headerShown: false }} />
        </Stack>
    )
};