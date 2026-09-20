import { useIsFocused } from "@react-navigation/native";
import React, { useMemo } from "react";
import { TimelineTaskRow } from "./timeline-task-row";

type TimelineTasksProps = {
  taskIds: string[];
  selectedDateISO: string;
  onToggleTask: (id: string) => void;
  color: string;
};
const HOUR_HEIGHT = 80;
const EMPTY_TASK_IDS: string[] = [];

export const TimelineTasks = React.memo(function TimelineTasks({
  taskIds,
  selectedDateISO,
  onToggleTask,
  color,
}: TimelineTasksProps) {
  const isFocused = useIsFocused();

  const positions = useMemo(
    () =>
      taskIds.map((taskId, index) => ({
        taskId,
        top: 9 * HOUR_HEIGHT + index * 50,
        height: 45,
      })),
    [taskIds],
  );

  return (
    <>
      {positions.map((position) => (
        <TimelineTaskRow
          key={position.taskId}
          taskId={position.taskId}
          top={position.top}
          height={position.height}
          onToggle={onToggleTask}
          color={color}
        />
      ))}
    </>
  );
});
