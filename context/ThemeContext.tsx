import React, {
  createContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, StatusBar, useColorScheme } from "react-native";
import storageMMKV from "@/utils/Storage-Utils/mmkv-instance";
import { STORAGE_KEYS } from "@/utils/Storage-Utils/storage-keys";

// Define theme colors
const themes = {
  light: {
    text: "#000000ff",
    error: "#ff0000ff",
    success: "#6eff73ff",
    whiteBase: "#ffffffff",
    blackBase: "#000000ff",
    whiteBaseTrans: "#ffffff9f",
    greyBasePrimary: "#797979ff",
    greyBaseSecondary: "#b1b0b0ff",
    greyBaseTertiary: "#b1b1b1",
    greyBaseTrans: "#c9c9c9da",
    greyTimeline: "#d6d6d6ff",
    blueLightPrimary: "#9bd6fdff",
    blueDarkPrimary: "#1a4eb8ff",
    modalBase: "#88888893",
    modalDarkPrimary: "#ffffffff",
    taskBase: "#8d4bffff",
    taskBaseTrans: "#8d4bff7e",
    taskBaseTransToo: "#683ab798",
    taskLightPrimary: "#c7b6f1ff",
    taskDarkPrimary: "#b091ff",
    taskDarkSecondary: "#7d4bac",
    eventBase: "#ff6257ff",
    eventBaseTrans: "#ff625779",
    eventDarkPrimary: "#9c2118ff",
    eventDarkSecondary: "#941006ff",
    habitBase: "#ffd358",
    habitBaseTrans: "#fdc52de0",
    habitDarkPrimary: "#b29641",
    habitDarkSecondary: "#866405ff",
    timerBase: "#06fabdff",
    timerBaseLightModeOnly: "#099774",
    timerBaseTrans: "#06fabd71",
    timerBaseTransToo: "#2e3b3844",
    timerDarkPrimary: "#5a8178ff",
    background: "#c7c7c7",
  },
  dark: {
    text: "#ffffff",
    error: "#ff0000ff",
    success: "#4CAF50",
    whiteBase: "#ffffffff",
    blackBase: "#000000ff",
    whiteBaseTrans: "#ffffff9f",
    greyBasePrimary: "#888888ff",
    greyBaseSecondary: "#333333ff",
    greyBaseTertiary: "#868686",
    greyBaseTrans: "#c9c9c9da",
    greyTimeline: "#2d2a30",
    blueLightPrimary: "#7b8fffff",
    blueDarkPrimary: "#133780",
    modalBase: "#0d0c0e93",
    modalDarkPrimary: "#1e1c20ff",
    taskBase: "#673AB7",
    taskBaseTrans: "#683ab780",
    taskBaseTransToo: "#683ab72c",
    taskLightPrimary: "#c7b6f1ff",
    taskDarkPrimary: "#25232A",
    taskDarkSecondary: "#2F2C37",
    eventBase: "#F44336",
    eventBaseTrans: "#f4433677",
    eventDarkPrimary: "#36100dff",
    eventDarkSecondary: "#411310ff",
    habitBase: "#f1b718ff",
    habitBaseTrans: "#f1b71879",
    habitDarkPrimary: "#3b3525ff",
    habitDarkSecondary: "#503c06ff",
    timerBase: "#05ce9cff",
    timerBaseLightModeOnly: "#099774",
    timerBaseTrans: "#6ac9b180",
    timerBaseTransToo: "#2e3b3844",
    timerDarkPrimary: "#2e3b38ff",
    background: "#1b1b1b",
  },
} as const;

type ThemeName = "light" | "dark" | "system";
// ThemeColors can be either the light or dark theme shape
type ThemeColors = (typeof themes)[keyof typeof themes];

interface ThemeContextType {
  isDarkMode: boolean;
  theme: ThemeColors;
  preference: ThemeName;
  toggleTheme: () => void;
  setThemeToSystemTheme: () => void;
}

const defaultTheme: ThemeColors = themes.dark;

export const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: true,
  theme: defaultTheme,
  preference: "system",
  toggleTheme: () => {},
  setThemeToSystemTheme: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme() ?? "dark";
  const [preference, setPreference] = useState<ThemeName>("system");

  // 🔥 resolve final theme
  const resolvedTheme: ThemeName =
    preference === "system" ? systemScheme : preference;

  const isDarkMode = resolvedTheme === "dark";

  const theme = isDarkMode ? themes.dark : themes.light;

  useEffect(() => {
    (() => {
      const saved = storageMMKV.getString(STORAGE_KEYS.THEME);
      if (saved === "light" || saved === "dark" || saved === "system") {
        setPreference(saved);
      }
    })();
  }, []);

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    console.log("appState.current", appState.current);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        // 🔥 App just came to foreground → force re-evaluation
        // No state needed, just trigger re-render
        setPreference((prev) => prev);
        //setIsDarkMode((prev) => prev);
      }

      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);
  // Persist theme choice and update StatusBar
  useEffect(() => {
    // Update status bar style for better contrast
    try {
      StatusBar.setBarStyle(
        isDarkMode ? "light-content" : "dark-content",
        true,
      );
    } catch (e) {
      // ignore on unsupported platforms
    }
  }, [isDarkMode]);

  const setThemeName = (t: ThemeName) => {
    storageMMKV.set(STORAGE_KEYS.THEME, t);
    setPreference(t);
  };

  const toggleTheme = () => {
    const next: ThemeName = preference === "light" ? "dark" : "light";
    setThemeName(next);
  };

  const setThemeToSystemTheme = () => {
    if (preference === "system") {
      setThemeName("dark");
      return;
    }
    setThemeName("system");
  };

  return (
    <ThemeContext.Provider
      value={{
        isDarkMode,
        theme,
        preference,
        toggleTheme,
        setThemeToSystemTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
