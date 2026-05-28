import { Tag } from "@/types/tag";
import {
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { useTheme } from "@/hooks/use-theme-colors";
import { TagBadge } from "./tag-badge";
import { text } from "drizzle-orm/gel-core";

interface TagsEditModalProps {
  tagToEdit: string;
  editNameValue: string;
  setEditNameValue: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  mode?: "ai" | "settings";
}
export const TagsEditModal = ({
  tagToEdit,
  editNameValue,
  setEditNameValue,
  onSave,
  onClose,
  mode = "settings",
}: TagsEditModalProps) => {
  const { theme } = useTheme();
  const textColor = mode === "ai" ? theme.blackBase : theme.whiteBase;
  return (
    <Modal visible={!!tagToEdit} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor:
                mode === "ai" ? theme.greyBaseTrans : theme.background,
              maxHeight: "30%",
              justifyContent: "center",
            },
          ]}
        >
          <Text
            style={{
              color: textColor,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 16,
            }}
          >
            Rename Tag
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: theme.taskDarkSecondary,
              color: mode === "ai" ? theme.blackBase : theme.whiteBase,
              padding: 12,
              borderRadius: 8,
              fontSize: 16,
              marginBottom: 24,
            }}
            value={editNameValue}
            onChangeText={setEditNameValue}
            autoFocus
            placeholder="Tag Name..."
            placeholderTextColor={theme.greyBasePrimary}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => onClose()}
              style={{
                flex: 1,
                padding: 14,
                alignItems: "center",
                borderRadius: 8,
                backgroundColor: theme.taskDarkSecondary,
              }}
            >
              <Text style={{ color: theme.whiteBase }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              style={{
                flex: 1,
                padding: 14,
                alignItems: "center",
                borderRadius: 8,
                backgroundColor: theme.taskLightPrimary,
              }}
            >
              <Text style={{ color: theme.whiteBase, fontWeight: "bold" }}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    margin: 20,
  },
});
