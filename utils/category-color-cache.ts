import AsyncStorage from '@react-native-async-storage/async-storage';

const COLOR_CACHE_KEY = '@prodtracker_recent_colors';
export const MAX_COLORS = 30;

/**
 * Updates the LRU cache of custom colors.
 * Moves existing colors to the front, unshifts new colors, and truncates to MAX_COLORS.
 */
export const saveCustomColor = async (newColor: string): Promise<string[]> => {
    try {
        const storedColors = await AsyncStorage.getItem(COLOR_CACHE_KEY);
        let colors: string[] = storedColors ? JSON.parse(storedColors) : [];

        // Remove the color if it already exists to avoid duplicates
        colors = colors.filter(color => color.toLowerCase() !== newColor.toLowerCase());

        // Unshift the new color to index [0] (Most Recently Used)
        colors.unshift(newColor);

        // Enforce the cache limit
        if (colors.length > MAX_COLORS) {
            colors.pop();
        }

        await AsyncStorage.setItem(COLOR_CACHE_KEY, JSON.stringify(colors));
        return colors;
    } catch (error) {
        console.error('Failed to save color to LRU cache:', error);
        return [];
    }
};

export const getRecentColors = async (): Promise<string[]> => {
    try {
        const storedColors = await AsyncStorage.getItem(COLOR_CACHE_KEY);
        return storedColors ? JSON.parse(storedColors) : [];
    } catch (error) {
        console.error('Failed to retrieve color cache:', error);
        return [];
    }
};