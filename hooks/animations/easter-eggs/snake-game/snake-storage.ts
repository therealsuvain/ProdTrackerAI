import AsyncStorage from "@react-native-async-storage/async-storage";

export const SNAKE_HIGH_SCORE_KEY = "@easter-eggs/snake/high-score/v1";

export async function loadSnakeHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(SNAKE_HIGH_SCORE_KEY);
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Persists the score only if it beats the stored one. Returns the best score. */
export async function saveSnakeHighScore(score: number): Promise<number> {
  try {
    const current = await loadSnakeHighScore();
    if (score > current) {
      await AsyncStorage.setItem(SNAKE_HIGH_SCORE_KEY, String(score));
      return score;
    }
    return current;
  } catch {
    return score;
  }
}
