import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  FlatList,
} from "react-native";

import { AVATAR_IDS, AVATARS, AvatarId } from "@/constants/avatars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AvatarPickerModalProps {
  visible: boolean;
  currentAvatarId: AvatarId;
  onSelect: (avatarId: AvatarId) => void;
  onClose: () => void;
}

// Simple grid picker — no upload button anywhere by design.
// Selecting an avatar just writes a string key locally (and later synced
// to profiles.avatar_id in Phase 3) — never a file.
export function AvatarPickerModal({
  visible,
  currentAvatarId,
  onSelect,
  onClose,
}: AvatarPickerModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title}>Choose an avatar</Text>

          <FlatList
            data={AVATAR_IDS}
            numColumns={6}
            keyExtractor={(id) => id}
            renderItem={({ item }) => {
              const isSelected = item === currentAvatarId;
              return (
                <TouchableOpacity
                  style={[
                    styles.avatarSlot,
                    isSelected && styles.avatarSlotSelected,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <Image source={AVATARS[item]} style={styles.avatarImage} />
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1c1b19",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,

    maxHeight: "70%",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 16 },
  avatarSlot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    margin: 8,
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSlotSelected: {
    borderColor: "#01696f",
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  closeButton: { marginTop: 12, alignItems: "center", padding: 12 },
  closeButtonText: { color: "#01696f", fontWeight: "600", fontSize: 15 },
});
