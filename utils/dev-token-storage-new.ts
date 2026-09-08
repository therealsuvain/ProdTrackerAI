// utils/token-usage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_USAGE_KEY = "usage:tokensUsedToday";
const TOKEN_USAGE_DATE_KEY = "usage:tokensUsedDate";

export async function getTodayTokenUsage(): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const storedDate = await AsyncStorage.getItem(TOKEN_USAGE_DATE_KEY);

  if (storedDate !== today) {
    await AsyncStorage.setItem(TOKEN_USAGE_DATE_KEY, today);
    await AsyncStorage.setItem(TOKEN_USAGE_KEY, "0");
    return 0;
  }

  const raw = await AsyncStorage.getItem(TOKEN_USAGE_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export async function recordTokenUsage(tokens: number): Promise<void> {
  const current = await getTodayTokenUsage();
  await AsyncStorage.setItem(TOKEN_USAGE_KEY, String(current + tokens));
}

export async function canUseTokens(requested: number, limit: number): Promise<boolean> {
  const used = await getTodayTokenUsage();
  return used + requested <= limit;
}