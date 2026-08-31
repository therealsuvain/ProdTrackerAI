import { create } from "zustand";

export const usePendingNotificationsStore = create<{
  pendingNotifications: boolean;
  setPendingNotifications: (pending: boolean) => void;
  clear: () => void;
}>((set) => ({
  pendingNotifications: false,
  setPendingNotifications: (pending: boolean) => set({ pendingNotifications: pending }),
  clear: () => set({ pendingNotifications: false }),
}));