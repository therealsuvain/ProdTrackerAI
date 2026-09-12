import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'
;
export const MAX_COLORS = 30;

/**
 * Updates the LRU cache of custom colors.
 * Moves existing colors to the front, unshifts new colors, and truncates to MAX_COLORS.
 */
export const saveCustomColor = (newColor: string): string[] => {
    try {
        const storedColors =  storageMMKV.getString(STORAGE_KEYS.COLOR_CACHE);
        let colors: string[] = storedColors ? JSON.parse(storedColors) : [];

        // Remove the color if it already exists to avoid duplicates
        colors = colors.filter(color => color.toLowerCase() !== newColor.toLowerCase());

        // Unshift the new color to index [0] (Most Recently Used)
        colors.unshift(newColor);

        // Enforce the cache limit
        if (colors.length > MAX_COLORS) {
            colors.pop();
        }

       storageMMKV.set(STORAGE_KEYS.COLOR_CACHE, JSON.stringify(colors));
        return colors;
    } catch (error) {
        console.error('Failed to save color to LRU cache:', error);
        return [];
    }
};

export const getRecentColors = (): string[] => {
    try {
        const storedColors =storageMMKV.getString(STORAGE_KEYS.COLOR_CACHE);
        return storedColors ? JSON.parse(storedColors) : [];
    } catch (error) {
        console.error('Failed to retrieve color cache:', error);
        return [];
    }
};