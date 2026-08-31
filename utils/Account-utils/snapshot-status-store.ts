import { create } from "zustand";

type RecoveryConsumedState = {
  lastConsumedSnapshotId: string | null;
  lastConsumedTimestamp: string | null;
  lastConsumedAction: "Restored" | "Merged" | null;
  markConsumed: (snapshotId: string, action: "Restored" | "Merged", timestamp: string) => void;
  clearConsumed: () => void;
};

export const useRecoveryConsumedStore = create<RecoveryConsumedState>((set) => ({
  lastConsumedSnapshotId: null,
  lastConsumedTimestamp: null,
  lastConsumedAction: null,
  markConsumed: (snapshotId, action, timestamp) =>
    set({ lastConsumedSnapshotId: snapshotId, lastConsumedAction: action, lastConsumedTimestamp: timestamp }),
  clearConsumed: () => set({ lastConsumedSnapshotId: null, lastConsumedAction: null, lastConsumedTimestamp: null }),
}));