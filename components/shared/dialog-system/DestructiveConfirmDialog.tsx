import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { TextInput as PaperTextInput, useTheme } from "react-native-paper";
import { AppDialog, AppDialogProps } from "./AppDialog";

export interface DestructiveConfirmDialogProps
  extends Omit<AppDialogProps, "actions" | "children"> {
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  itemCount?: number;
  itemLabel?: string;
  requiredKeyword?: string;
  confirmationDelayMs?: number;
  children?: React.ReactNode;
}

export const DestructiveConfirmDialog = ({
  visible,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  itemCount,
  itemLabel,
  requiredKeyword,
  confirmationDelayMs = 1000,
  children,
  ...props
}: DestructiveConfirmDialogProps) => {
  const theme = useTheme();
  const inputRef = useRef<TextInput | null>(null);
  const [typedValue, setTypedValue] = useState("");
  const [confirmEnabled, setConfirmEnabled] = useState(false);

  const keyword = useMemo(() => {
    if (requiredKeyword?.trim()) return requiredKeyword.trim().toUpperCase();
    if (!itemLabel?.trim()) return "DELETE";
    return itemLabel.trim().toUpperCase().replace(/\s+/g, "_");
  }, [itemLabel, requiredKeyword]);

  const keywordMatches = typedValue.trim().toUpperCase() === keyword;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      setTypedValue("");
      setConfirmEnabled(false);

      timer = setTimeout(() => {
        setConfirmEnabled(true);
        inputRef.current?.focus();
      }, confirmationDelayMs);
    } else {
      setTypedValue("");
      setConfirmEnabled(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, confirmationDelayMs]);

  const countText =
    itemLabel && itemCount && itemCount > 0
      ? `A total of ${itemCount} ${itemLabel}. This action cannot be undone.`
      : undefined;

  const canConfirm = confirmEnabled && keywordMatches;

  return (
    <AppDialog
      {...props}
      visible={visible}
      title={title}
      description={description}
      onDismiss={onCancel}
      dismissable={false}
      dismissableBackButton={false}
      actions={[
        {
          label: cancelText,
          variant: "text",
          onPress: () => onCancel?.(),
          autoClose: true,
        },
        {
          label: confirmText,
          variant: "destructive",
          onPress: onConfirm,
          disabled: !canConfirm,
        },
      ]}
    >
      {countText ? (
        <Text
          style={[
            styles.countText,
            { color: theme.colors.error },
          ]}
        >
          {countText}
        </Text>
      ) : null}

      {children}

      <Text
        style={[
          styles.keywordLabel,
          { color: theme.colors.onSurfaceVariant },
        ]}
      >
        Type{" "}
        <Text style={{ color: theme.colors.error, fontWeight: "800" }}>
          {keyword}
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
        returnKeyType="done"
        onSubmitEditing={() => {}}
        style={styles.input}
      />
    </AppDialog>
  );
};

const styles = StyleSheet.create({
  countText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  keywordLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 14,
    marginBottom: 8,
  },
  input: {
    marginTop: 4,
  },
});
