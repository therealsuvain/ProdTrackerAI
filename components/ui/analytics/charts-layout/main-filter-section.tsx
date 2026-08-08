import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { View, Text } from "react-native";
interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
}

export const FilterSection = ({ title, children }: FilterSectionProps) => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.6,
          color: theme.text + "99",
          marginBottom: 8,
        }}
      >
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
};
