import AsyncStorage from "@react-native-async-storage/async-storage";

export const SPACE_INVADERS_HIGH_SCORE_KEY =
  "@easter-eggs/space-invaders/high-score/v1";

export async function loadHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SPACE_INVADERS_HIGH_SCORE_KEY);
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Persists the score only if it beats the stored one. Returns the best score. */
export async function saveHighScore(score: number): Promise<number> {
  try {
    const current = await loadHighScore();
    if (score > current) {
      await AsyncStorage.setItem(SPACE_INVADERS_HIGH_SCORE_KEY, String(score));
      return score;
    }
    return current;
  } catch {
    return score;
  }
}
