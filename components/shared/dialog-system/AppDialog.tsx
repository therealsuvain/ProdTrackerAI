import React, { ReactNode, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Dialog, Portal, useTheme } from "react-native-paper";

export type DialogActionVariant =
  | "default"
  | "primary"
  | "destructive"
  | "text";

export interface DialogAction {
  label: string;
  onPress: () => void | Promise<void>;
  variant?: DialogActionVariant;
  disabled?: boolean;
  loading?: boolean;
  autoClose?: boolean;
}

export interface AppDialogProps {
  visible: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: DialogAction[];
  onDismiss?: () => void;
  dismissable?: boolean;
  dismissableBackButton?: boolean;
  width?: number;
}

export const AppDialog = ({
  visible,
  title,
  description,
  children,
  actions = [],
  onDismiss,
  dismissable = true,
  dismissableBackButton = true,
  width,
}: AppDialogProps) => {
  const theme = useTheme();
  const [busyActionIndex, setBusyActionIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) setBusyActionIndex(null);
  }, [visible]);

  const hasBusyAction = busyActionIndex !== null;

  const renderedActions = useMemo(
    () =>
      actions.map((action, index) => {
        const variant = action.variant ?? "default";
        const isBusy = busyActionIndex === index;
        const disabled =
          action.disabled || hasBusyAction || action.loading || isBusy;

        const handlePress = async () => {
          if (disabled) return;

          // The default behavior is to let the action owner close the dialog.
          // Set autoClose=true only when the action should close immediately.
          if (action.autoClose) {
            action.onPress();
            onDismiss?.();
            return;
          }

          try {
            const result = action.onPress();

            if (result instanceof Promise) {
              setBusyActionIndex(index);
              await result;
            }
          } finally {
            setBusyActionIndex(null);
          }
        };

        const buttonMode =
          variant === "primary" || variant === "destructive"
            ? "text"
            : "contained";

        const buttonColor =
          /* variant === "text" || variant === "default" ? "#f8f8f8a2" : */ undefined;

        const textColor =
          variant === "destructive"
            ? theme.colors.error
            : variant === "primary"
              ? theme.colors.primary
              : undefined;

        return (
          <Button
            key={`${action.label}-${index}`}
            mode={buttonMode}
            onPress={handlePress}
            disabled={disabled}
            loading={isBusy || action.loading}
            buttonColor={buttonColor}
            textColor={textColor}
            style={[
              styles.actionButton,
              variant === "destructive" && styles.destructiveButton,
            ]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.actionLabel}
          >
            {action.label}
          </Button>
        );
      }),
    [actions, busyActionIndex, hasBusyAction, onDismiss, theme.colors],
  );

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={dismissable ? onDismiss : undefined}
        dismissable={dismissable}
        dismissableBackButton={dismissableBackButton}
        style={[
          styles.dialog,
          {
            backgroundColor: theme.colors.elevation.level3,
          },
        ]}
      >
        <Dialog.Title style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Dialog.Title>

        {(description || children) && (
          <Dialog.Content>
            {description ? (
              <Text
                style={[
                  styles.description,
                  { color: theme.colors.onSurfaceVariant },
                ]}
              >
                {description}
              </Text>
            ) : null}

            {children}
          </Dialog.Content>
        )}

        {actions.length > 0 && (
          <Dialog.Actions style={styles.actions}>
            {renderedActions}
          </Dialog.Actions>
        )}
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
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    //maxHeight: 90,
    flexWrap: "wrap",
    justifyContent: "center",
    //alignItems: "flex-start", // <-- THE FIX: Overrides RNP's default. Prevents the layout explosion.
    gap: 4, // You can safely add this back now
  },
  actionButton: {
    flexWrap: "wrap",
  },
  destructiveButton: {
    flexWrap: "wrap",
    // Color is supplied through buttonColor.
  },
  buttonContent: {},
  actionLabel: {
    fontWeight: "700",
    flexWrap: "wrap",
  },
});
