import { SegmentedButtons } from "react-native-paper";

interface ViewSwitcherProps {
  currentView: "month" | "day";
  onChange: (view: "month" | "day") => void;
}

export default function ViewSwitcher({
  currentView,
  onChange,
}: ViewSwitcherProps) {
  return (
    <SegmentedButtons
      value={currentView}
      style={{marginBottom:12}}
      onValueChange={(value) => onChange(value as "month" | "day")}
      buttons={[
        {
          value: "month",
          label: "Month",
          checkedColor: "#F44336",
          style: { backgroundColor: "#411310ff" },
        },
        {
          value: "day",
          label: "Day",
          checkedColor: "#F44336",
          style: { backgroundColor: "#411310ff" },
        },
      ]}
    />
  );
}
