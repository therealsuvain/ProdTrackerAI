import { Tag } from "@/types/tag";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
} from "react-native";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { TagBadge } from "./tag-badge";

interface TagsDeleteModalProps {
  tags: Tag[];
  tagToDelete: string;
  onClose: () => void;
  onReassign: (tagId: string) => void;
}
export const TagsDeleteModal = ({
  tags,
  tagToDelete,
  onClose,
  onReassign,
}: TagsDeleteModalProps) => {
  const { theme } = useTheme();
  return (
    <Modal visible={!!tagToDelete} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.background, minHeight: "50%" },
          ]}
        >
          <Text
            style={{
              color: theme.whiteBase,
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 16,
            }}
          >
            Select Fallback Tag
          </Text>
          <Text style={{ color: theme.greyBasePrimary, marginBottom: 20 }}>
            Choose a tag to absorb the items currently using this tag.
          </Text>

          <ScrollView contentContainerStyle={styles.wrapContainer}>
            {tags
              .filter((t) => t.id !== tagToDelete)
              .map((t) => (
                <Pressable key={t.id} onPress={() => onReassign(t.id)}>
                  <TagBadge
                    tagId={t.id}
                    tagName={t.name}
                    holeColor={theme.background}
                    mode="big"
                  />
                </Pressable>
              ))}
          </ScrollView>

          <Pressable
            onPress={() => onClose()}
            style={{ marginTop: 20, alignItems: "center", padding: 10 }}
          >
            <Text style={{ color: theme.greyBasePrimary }}>Cancel</Text>
          </Pressable>
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
  wrapContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
});
