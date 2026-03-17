import React from 'react';
import { StyleSheet } from 'react-native';
import { Portal, Dialog, Button, Text, useTheme } from 'react-native-paper';

interface IntentConfirmationModalProps {
  visible: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal = ({
  visible,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel
}: IntentConfirmationModalProps) => {
  const theme = useTheme();

  return (
    <Portal>
      {/* We hook into the theme to ensure it perfectly matches Light/Dark mode */}
      <Dialog visible={visible} onDismiss={onCancel} style={{ backgroundColor: theme.colors.elevation.level3 }}>
        <Dialog.Title style={{ color: theme.colors.onSurface, fontWeight: 'bold' }}>
          {title}
        </Dialog.Title>
        <Dialog.Content>
          {description && (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
              {description}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel} textColor={theme.colors.onSurfaceVariant}>
            {cancelText}
          </Button>
          <Button 
            onPress={onConfirm} 
            // If destructive, we use the theme's native error color (usually a stark red)
            textColor={isDestructive ? theme.colors.error : theme.colors.primary}
            labelStyle={isDestructive ? { fontWeight: 'bold' } : undefined}
          >
            {confirmText}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};