import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import {
  AppDialog,
  DialogAction,
} from "@/components/shared/dialog-system/AppDialog";

type DialogOptions = {
  title: string;
  description?: string;
  children?: ReactNode;
  actions: DialogAction[];
  dismissable?: boolean;
};

type DialogContextValue = {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;

  confirm: (options: {
    title: string;
    description?: string;
    children?: ReactNode;
    confirmText?: string;
    confirmVariant?: "primary" | "destructive";
  }) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const hideDialog = useCallback(() => {
    setDialog(null);
  }, []);

  const showDialog = useCallback((options: DialogOptions) => {
    setDialog(options);
  }, []);

  const confirm = useCallback(
    ({
      title,
      description,
      children,
      confirmText = "Confirm",
      confirmVariant = "primary",
    }: {
      title: string;
      description?: string;
      children?: ReactNode;
      confirmText?: string;
      confirmVariant?: "primary" | "destructive";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setDialog({
          title,
          description,
          children,
          dismissable: false,
          actions: [
            {
              label: "Cancel",
              variant: "text",
              onPress: () => {
                hideDialog();
                resolve(false);
              },
            },
            {
              label: confirmText,
              variant: confirmVariant,
              onPress: () => {
                hideDialog();
                resolve(true);
              },
            },
          ],
        });
      });
    },
    [hideDialog],
  );

  return (
    <DialogContext.Provider
      value={{
        showDialog,
        hideDialog,
        confirm,
      }}
    >
      {children}

      {dialog && (
        <AppDialog
          visible
          title={dialog.title}
          description={dialog.description}
          children={dialog.children}
          actions={dialog.actions}
          dismissable={dialog.dismissable}
          onDismiss={hideDialog}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }

  return context;
}
