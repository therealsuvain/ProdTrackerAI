import { useWorkspaceSyncModeStore } from "@/utils/Account-utils/workspace-sync-mode-store";
import { TouchableOpacity, Text } from "react-native";

export const SyncStatusIndicator = ({
  openResolutionModal,
}: {
  openResolutionModal: () => void;
}) => {
  const mode = useWorkspaceSyncModeStore((state) => state.mode);

  if (mode !== "detached_pending_choice") return null;

  return (
    <TouchableOpacity onPress={openResolutionModal}>
      <Text
        style={{
          color: "rgb(255, 55, 55)",
          fontSize: 10,
        }}
      >
        Sync Paused — Local data won't be pushed
      </Text>
    </TouchableOpacity>
  );
};
