import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'

const TOKEN_USAGE_KEY = "usage:tokensUsedToday";
const TOKEN_USAGE_DATE_KEY = "usage:tokensUsedDate";

export function getTodayTokenUsage(): number {
  const today = new Date().toISOString().split("T")[0];
  const storedDate = storageMMKV.getString(TOKEN_USAGE_DATE_KEY);

  if (storedDate !== today) {
    storageMMKV.set(TOKEN_USAGE_DATE_KEY, today);
    storageMMKV.set(TOKEN_USAGE_KEY, "0");
    return 0;
  }

  const raw = storageMMKV.getString(TOKEN_USAGE_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

export function recordTokenUsage(tokens: number): void {
  const current = getTodayTokenUsage();
  storageMMKV.set(TOKEN_USAGE_KEY, String(current + tokens));
}

export  function canUseTokens(requested: number, limit: number): boolean {
  const used =  getTodayTokenUsage();
  return used + requested <= limit;
}