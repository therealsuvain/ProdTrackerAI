import { ThemeContext } from "@/context/ThemeContext";
import { useContext } from "react";
import { SegmentedButtons } from "react-native-paper";

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
    <SegmentedButtons
      value={currentView}
      style={{marginBottom:12}}
      onValueChange={(value) => onChange(value as "month" | "day")}
      buttons={[
        {
          value: "month",
          label: "Month",
          checkedColor: theme.eventBase,
          style: { backgroundColor: theme.eventDarkSecondary },
        },
        {
          value: "day",
          label: "Day",
          checkedColor: theme.eventBase,
          style: { backgroundColor: theme.eventDarkSecondary },
        },
      ]}
    />
  );
}
