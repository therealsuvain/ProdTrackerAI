import React from "react";
import { TimelineEventRow } from "./timeline-event-row";

interface TimelineEventRowProps {
  eventIds: string[];
  color: string;
}

export const TimelineEvents = React.memo(function TimelineEvents({
  eventIds,
  color,
}: TimelineEventRowProps) {
  return (
    <>
      {eventIds.map((eventId) => (
        <TimelineEventRow key={eventId} id={eventId} color={color} />
      ))}
    </>
  );
});
