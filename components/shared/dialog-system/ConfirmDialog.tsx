import React from "react";
import { AppDialog, AppDialogProps, DialogAction } from "./AppDialog";

export interface ConfirmDialogProps
  extends Omit<AppDialogProps, "actions" | "children"> {
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  confirmVariant?: "primary" | "destructive";
  children?: React.ReactNode;
}

export const ConfirmDialog = ({
  visible,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
  children,
  ...props
}: ConfirmDialogProps) => {
  const actions: DialogAction[] = [
    {
      label: cancelText,
      variant: "text",
      onPress: () => onCancel?.(),
      autoClose: true,
    },
    {
      label: confirmText,
      variant: confirmVariant,
      onPress: onConfirm,
    },
  ];

  return (
    <AppDialog
      {...props}
      visible={visible}
      title={title}
      description={description}
      onDismiss={onCancel}
      actions={actions}
    >
      {children}
    </AppDialog>
  );
};
