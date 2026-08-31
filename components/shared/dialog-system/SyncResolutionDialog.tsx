import { useState } from "react";
import { AppDialog } from "./AppDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { DestructiveConfirmDialog } from "./DestructiveConfirmDialog";
import { useSync } from "@/context/SyncContext";
import { getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";

interface Props {
  visible: boolean;
  onClose: () => void;
}
export const SyncResolutionModal = ({ visible, onClose }: Props) => {
  const [activeAction, setActiveAction] = useState<
    "merge" | "replace" | "discard" | null
  >(null);
  const { replaceCloud, mergeRecoveryWithCloud, discardRecovery } = useSync();

  const handleMerge = async () => {
    await mergeRecoveryWithCloud();
    setActiveAction(null);
    onClose();
  };
  const handleReplaceCloud = async () => {
    const summary = await getRecoverySnapshotSummary();
    if (!summary) return;
    console.log("Replace Cloud Data with Local BLOCKED TEMPORARILY");
    //await replaceCloud();
    setActiveAction(null);
    onClose();
  };

  const handleDiscard = async () => {
    await discardRecovery();
    setActiveAction(null);
    onClose();
  };
  return (
    <>
      <AppDialog
        visible={visible && !activeAction}
        title="Restore Old Data"
        description="This device has local data that differs from your account's cloud data. Choose how to resolve it."
        onDismiss={onClose}
        dismissable={false}
        actions={[
          {
            label: "Merge into account",
            variant: "primary",
            onPress: () => setActiveAction("merge"),
          },
          {
            label: "Replace account data with this device's data",
            variant: "destructive",
            onPress: () => setActiveAction("replace"),
          },
          {
            label: "Discard local changes, use account's data",
            variant: "primary",
            onPress: () => setActiveAction("discard"),
          },
          {
            label: "Cancel",
            variant: "text",
            autoClose: true,
            onPress: onClose,
          },
        ]}
      />

      <ConfirmDialog
        visible={activeAction === "merge"}
        title="Merge local data into your account?"
        description="This device's data will be combined with your account's existing cloud data."
        confirmText="Merge"
        onConfirm={handleMerge}
        onCancel={() => setActiveAction(null)}
      />
      <DestructiveConfirmDialog
        visible={activeAction === "replace"}
        title="Replace account data with this device's data?"
        description="This permanently deletes your account's existing cloud data on every device and replaces it with what's on this device. This cannot be undone."
        confirmText="Replace"
        requiredKeyword="REPLACE"
        onConfirm={handleReplaceCloud}
        onCancel={() => setActiveAction(null)}
      />
      <ConfirmDialog
        visible={activeAction === "discard"}
        title="Discard local changes?"
        description="A backup of this device's current data will be kept for 30 days before switching to your account's data."
        confirmText="Discard and sync from account"
        onConfirm={handleDiscard}
        onCancel={() => setActiveAction(null)}
      />
    </>
  );
};
