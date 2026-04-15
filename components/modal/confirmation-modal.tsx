import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, Text } from "react-native";
import {
  Portal,
  Dialog,
  Button,
  useTheme,
  TextInput as PaperTextInput,
} from "react-native-paper";

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  itemCount?: number;
  itemLabel?: string; // e.g. "tasks", "habits", "messages"
}

export const ConfirmationModal = ({
  visible,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
  itemCount,
  itemLabel,
}: ConfirmationModalProps) => {
  const theme = useTheme();
  const inputRef = useRef<TextInput | null>(null);

  const [typedValue, setTypedValue] = useState("");
  const [confirmEnabled, setConfirmEnabled] = useState(false);
  const countText = useMemo(() => {
    if (itemLabel && itemCount && itemCount > 0) {
      return `A total of ${itemCount} ${itemLabel}. This action cannot be undone.`;
    }
    return "";
  }, [itemCount, itemLabel]);
  const requiredKeyword = useMemo(() => {
    if (!itemLabel?.trim()) return "DELETE";

    return itemLabel.trim().toUpperCase().replace(/\s+/g, "_");
  }, [itemLabel]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (visible) {
      setTypedValue("");
      setConfirmEnabled(false);

      timer = setTimeout(() => {
        setConfirmEnabled(true);
        inputRef.current?.focus();
      }, 1000);
    } else {
      setTypedValue("");
      setConfirmEnabled(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  const keywordMatches = typedValue.trim() === requiredKeyword;
  const canConfirm = confirmEnabled && (!isDestructive || keywordMatches);

  return (
    <Portal>
      {/* We hook into the theme to ensure it perfectly matches Light/Dark mode */}
      <Dialog
        visible={visible}
        //onDismiss={onCancel}
        dismissable={false}
        dismissableBackButton={false}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.elevation.level3 },
        ]}
      >
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Dialog.Title>
        <Dialog.Content>
          {description && (
            <Text
              style={[
                styles.warningText,
                {
                  color: isDestructive
                    ? theme.colors.error
                    : theme.colors.onSurfaceVariant,
                  lineHeight: 22,
                },
              ]}
            >
              {description}
            </Text>
          )}
          {countText && (
            <Text
              style={[
                styles.warningCountText,
                {
                  color: isDestructive
                    ? theme.colors.error
                    : theme.colors.onSurface,
                },
              ]}
            >
              {countText}
            </Text>
          )}
          {isDestructive ? (
            <>
              <Text
                style={[
                  styles.keywordLabel,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                Type{" "}
                <Text style={{ color: theme.colors.error }}>
                  {requiredKeyword}
                </Text>{" "}
                to confirm.
              </Text>

              <PaperTextInput
                ref={inputRef}
                value={typedValue}
                onChangeText={setTypedValue}
                mode="outlined"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus={false}
                activeOutlineColor={theme.colors.error}
                //blurOnSubmit={false}
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
                onSubmitEditing={() => {
                  // Intentionally do nothing so confirm is never the default submit action
                }}
                style={styles.input}
              />
            </>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            onPress={onCancel}
            style={styles.cancelButton}
            contentStyle={styles.buttonContent}
            labelStyle={styles.cancelLabel}
            //textColor={theme.colors.onSurfaceVariant}
          >
            {cancelText}
          </Button>
          <Button
            mode={isDestructive ? "contained-tonal" : "contained"}
            onPress={onConfirm}
            disabled={!canConfirm}
            buttonColor={isDestructive ? theme.colors.error : undefined}
            textColor={isDestructive ? theme.colors.onError : undefined}
            style={styles.confirmButton}
            contentStyle={styles.buttonContent}
            //textColor={isDestructive ? theme.colors.error : theme.colors.primary}
            //labelStyle={isDestructive ? { fontWeight: "bold" } : undefined}
          >
            {confirmText}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    borderRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.25,
  },
  warningCountText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  keywordLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  input: {
    marginTop: 4,
  },
  actions: {
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 4,
    gap: 10,
  },
  cancelButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 1,
  },
  buttonContent: {
    minHeight: 44,
  },
  cancelLabel: {
    fontWeight: "700",
  },
});
