import React from "react";
import { TimelineLogRow } from "./timeline-log-row";

interface TimelineLogRowProps {
  logIds: string[];
  color: string;
}

export const TimelineLogs = React.memo(function TImelineLogs({
  logIds,
  color,
}: TimelineLogRowProps) {
  return (
    <>
      {logIds.map((logId) => (
        <TimelineLogRow key={logId} id={logId} color={color} />
      ))}
    </>
  );
});
