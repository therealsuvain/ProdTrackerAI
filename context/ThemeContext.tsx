import React, { createContext, useEffect, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define theme colors
const themes = {
  light: {
    primary: '#cbd4ddff',
    primaryHover: '#357ab8',
    secondary: '#02d1bc',
    accent: '#0aed3f',
    background: '#ffffff',
    backgroundHeader: '#e3e1e1',
    backgroundSecondary: '#fbfbfb',
    backgroundTransparent: 'rgba(255, 255, 255, 0.8)',
    backgroundForm: '#f6fbff',
    backgroundSideDrawer: '#23B5D3',
    textPrimary: '#2c3e50',
    textSecondary: '#666666',
    textLight: '#ffffff',
    border: '#cccccc',
    shadow: 'rgba(0, 0, 0, 0.1)',
    error: '#ff6b6b',
    warning: '#ffd700',
    success: '#4ad76b',
    buttonPrimary: '#4a90e2',
    buttonSecondary: '#f0f0f0',
    buttonDanger: '#ff4444',
    buttonDisabled: '#cccccc',
    successHover: '#056e20',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
    modalBackground: 'rgba(0, 0, 0, 0.25)',
    modalButtonBg: 'rgba(0, 0, 0, 0.6)',
    modalButtonHover: 'rgba(0, 0, 0, 0.8)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
  dark: {
    primary: '#2d5a8e',
    primaryHover: '#1d3c5e',
    secondary: '#017a6e',
    accent: '#06912a',
    background: '#1a1a1a',
    backgroundHeader: '#2d2d2d',
    backgroundSecondary: '#2d2d2d',
    backgroundTransparent: 'rgba(26, 26, 26, 0.8)',
    backgroundSideDrawer: '#0c3e49',
    backgroundForm: '#252b2f',
    textPrimary: '#e0e0e0',
    textSecondary: '#a0a0a0',
    textLight: '#ffffff',
    border: '#404040',
    shadow: 'rgba(0, 0, 0, 0.3)',
    error: '#d44c4c',
    warning: '#cca700',
    success: '#06912a',
    buttonPrimary: '#2d5a8e',
    buttonSecondary: '#404040',
    buttonDanger: '#cc0000',
    buttonDisabled: '#404040',
    successHover: '#056e20',
    modalOverlay: 'rgba(0, 0, 0, 0.7)',
    modalBackground: 'rgba(0, 0, 0, 0.4)',
    modalButtonBg: 'rgba(0, 0, 0, 0.8)',
    modalButtonHover: 'rgba(0, 0, 0, 0.9)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
} as const;

type ThemeName = 'light' | 'dark';
// ThemeColors can be either the light or dark theme shape
type ThemeColors = typeof themes[keyof typeof themes];

interface ThemeContextType {
  isDarkMode: boolean;
  theme: ThemeColors;
  toggleTheme: () => void;
  setThemeName: (t: ThemeName) => Promise<void>;
}

const defaultTheme: ThemeColors = themes.light;

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  theme: defaultTheme,
  toggleTheme: async () => {},
  setThemeName: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = Appearance.getColorScheme();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(systemScheme === 'dark');

  // Load saved preference from AsyncStorage (if any)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@app:theme');
        if (!mounted) return;
        if (saved === 'dark') setIsDarkMode(true);
        else if (saved === 'light') setIsDarkMode(false);
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Listen for system theme changes and respect user preference only when no saved preference
  useEffect(() => {
    const listener = ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('@app:theme');
          if (saved == null) {
            setIsDarkMode(colorScheme === 'dark');
          }
        } catch (e) {
          // ignore
        }
      })();
    };

    const subscription = Appearance.addChangeListener(listener as any);
    return () => subscription.remove();
  }, []);

  // Persist theme choice and update StatusBar
  useEffect(() => {
    // Update status bar style for better contrast
    try {
      StatusBar.setBarStyle(isDarkMode ? 'light-content' : 'dark-content', true);
    } catch (e) {
      // ignore on unsupported platforms
    }
  }, [isDarkMode]);

  const setThemeName = async (t: ThemeName) => {
    try {
      await AsyncStorage.setItem('@app:theme', t);
      setIsDarkMode(t === 'dark');
    } catch (e) {
      // ignore
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    try {
      await AsyncStorage.setItem('@app:theme', newTheme ? 'dark' : 'light');
    } catch (e) {
      // ignore
    }
    setIsDarkMode(newTheme);
  };

  const theme = isDarkMode ? themes.dark : themes.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;