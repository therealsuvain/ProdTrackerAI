import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { sqlite } from "@/db";

export function DevTools() {
  useDrizzleStudio(sqlite);
  return null;
}
