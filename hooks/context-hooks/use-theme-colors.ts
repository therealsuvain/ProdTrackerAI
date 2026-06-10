import { ThemeContext } from "@/context/ThemeContext";
import { useContext } from "react";


export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error("useDataTest must be used within a DataProvider");
    }
    return context;
}