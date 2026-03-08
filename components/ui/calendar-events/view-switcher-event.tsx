import { ThemeContext } from "@/context/ThemeContext";
import { useContext } from "react";
import { SegmentedButtons } from "react-native-paper";
import {View} from "react-native";

interface ViewSwitcherProps {
  currentView: "month" | "day";
  onChange: (view: "month" | "day") => void;
}

export default function ViewSwitcher({
  currentView,
  onChange,
}: ViewSwitcherProps) {
  const {theme} = useContext(ThemeContext)
  return (
    <View style={{ backgroundColor: theme.background}}>
    <SegmentedButtons
      value={currentView}
      style={{marginBottom:12}}
      onValueChange={(value) => onChange(value as "month" | "day")}
      buttons={[
        {
          value: "month",
          label: "Month",
          uncheckedColor: theme.whiteBase,
          checkedColor: theme.eventBase,
          style: { backgroundColor: theme.eventDarkSecondary },
        },
        {
          value: "day",
          label: "Day",
          uncheckedColor: theme.whiteBase,
          checkedColor: theme.eventBase,
          style: { backgroundColor: theme.eventDarkSecondary },
        },
      ]}
    />
    </View>
  );
}
