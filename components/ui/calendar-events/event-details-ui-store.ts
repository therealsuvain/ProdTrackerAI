import { create } from "zustand";

export interface EventPillOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EventDetailsState {
  details: {
    eventId: string;
    occurrence: string;
    origin: EventPillOrigin;
  } | null;
  open: (eventId: string, occurrence: string, origin: EventPillOrigin) => void;
  close: () => void;
}

export const useEventDetailsUiStore = create<EventDetailsState>((set) => ({
  details: null,
  open: (eventId, occurrence, origin) =>
    set({ details: { eventId, occurrence, origin } }),
  close: () => set({ details: null }),
}));
