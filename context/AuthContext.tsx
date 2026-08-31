import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Text } from "react-native";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/utils/Account-utils/supabase-client";
import { useData } from "@/hooks/context-hooks/use-data";
import { useDialog } from "@/context/DialogContext";
import {
  hasAnyUnsyncedData,
  hasAnyMeaningfulUnsyncedData,
} from "@/utils/Account-utils/unsynced-local-data";
import { useSettings } from "./SettingsContext";
import { getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";
import { useWorkspaceSyncModeStore } from "@/utils/Account-utils/workspace-sync-mode-store";

export type MergeChoice = "merge" | "discard";

type AuthState = {
  session: Session | null;
  isAnonymous: boolean;
  authLoaded: boolean;
  userId: string | null;
  userEmail: string | null;
  // Step 1 of linking: attach + verify an email on the CURRENT anonymous user
  startEmailLink: (email: string) => Promise<void>;
  // Step 2 of linking: after the user verifies via OTP, set their password
  completeEmailLink: (otp: string, password: string) => Promise<void>;
  updateAvatar: (avatarId: string, updatedAt: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setPendingAccountTransition: (transition: PendingAccountTransition) => void;
  consumePendingAccountTransition: () => PendingAccountTransition | null;
  clearPendingAccountTransition: () => void;
};

export type PendingAccountTransition =
  | { mode: "merge" }
  | {
      mode: "replace";
      sourceUserId: string | null;
      sourceIsAnonymous: boolean;
    };

const AuthContext = createContext<AuthState | null>(null);

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dispatchError } = useData();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const { settings, updateSetting } = useSettings();
  const { confirm, showDialog, hideDialog } = useDialog();
  const pendingTransitionRef = useRef<PendingAccountTransition | null>(null);
  // ── Bootstrap: every install gets an identity, signed up or not ──────────
  const workspaceSyncMode = useWorkspaceSyncModeStore((state) => state.mode);
  const setPendingAccountTransition = useCallback(
    (transition: PendingAccountTransition) => {
      pendingTransitionRef.current = transition;
    },
    [],
  );

  const consumePendingAccountTransition = useCallback(() => {
    const transition = pendingTransitionRef.current;
    pendingTransitionRef.current = null;
    return transition;
  }, []);

  const clearPendingAccountTransition = useCallback(() => {
    pendingTransitionRef.current = null;
  }, []);

  const accountHasAnyCloudData = async (userId: string): Promise<boolean> => {
    const tables = ["tasks", "habits", "calendar_events", "timer_logs"];

    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        console.error(
          `[accountHasAnyCloudData] Failed checking ${table}:`,
          error,
        );
        throw error;
      }

      if ((count ?? 0) > 0) return true;
    }

    return false;
  };

  const updateSessionAvatar = useCallback(async (): Promise<void> => {
    // console.log("[AuthContext] Updating session avatar...");
    if (session?.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("avatar_id, avatar_updated_at")
        .eq("id", session.user.id)
        .single();

      if (!profileError && profile?.avatar_id) {
        const localAvatarId = settings.avatarId?.id;
        const localAvatarUpdatedAt = settings.avatarId?.updatedAt;
        const cloudUpdatedAt = new Date(
          profile.avatar_updated_at ?? 0,
        ).getTime();
        const localUpdatedAt = new Date(localAvatarUpdatedAt ?? 0).getTime(); // from your Settings store

        if (cloudUpdatedAt > localUpdatedAt) {
          updateSetting("avatarId", {
            id: profile.avatar_id,
            updatedAt: profile.avatar_updated_at,
          }); // cloud wins — update local
        } else if (localUpdatedAt > cloudUpdatedAt) {
          await updateAvatar(localAvatarId, localAvatarUpdatedAt); // local wins — push to cloud
        }
        // equal timestamps: already in sync, no-op
      }
    }
  }, [session?.user?.id]);

  async function waitForUsableSession(maxAttempts = 5): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .limit(1);

      if (!error) return;

      const isClockSkewError =
        error.code === "PGRST303" ||
        error.message?.toLowerCase().includes("jwt issued at future");
      console.log("[AuthContext] waitForUsableSession:", error);
      console.log("[AuthContext] waitForUsableSession:", isClockSkewError);
      console.log("[AuthContext] waitForUsableSession:", attempt);
      if (!isClockSkewError) throw error;

      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }

    throw new Error("Session did not become usable in time.");
  }

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        console.log("[AuthContext] Existing session:", existing);
        await useWorkspaceSyncModeStore.getState().hydrate();
        if (!existing) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setSession(data.session);
        } else {
          setSession(existing);
        }
        updateSessionAvatar();
      } catch (err) {
        console.error("[AuthContext] Failed to bootstrap session:", err);
        dispatchError(
          `Failed to initialise account session: ${err instanceof Error ? err.message : String(err)}`,
          "fatal",
        );
      } finally {
        setAuthLoaded(true);
      }
    };

    init();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );

    return () => subscription.subscription.unsubscribe();
  }, [dispatchError]);
  const isAnonymous = session?.user?.is_anonymous ?? true;
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;

  // ── Step 1: attach an email to the CURRENT anonymous user ────────────────
  // This sends a verification OTP/link to the email. The user is NOT yet
  // "linked" — that only happens after completeEmailLink() succeeds.
  // Supabase requires this as a separate step; a single updateUser({ email, password })
  // call does not reliably work for anonymous users. [Supabase Auth docs]

  const promptMergeOrDiscard = (): Promise<MergeChoice> => {
    return new Promise((resolve) => {
      showDialog({
        title: "Local data found",
        description:
          "This device has data that hasn't been backed up to any account. " +
          "Would you like to merge it into the account you're signing into, " +
          "or discard it and load that account's existing data instead?",

        dismissable: false,

        actions: [
          {
            label: "Use this account's data",
            variant: "destructive",
            onPress: () => {
              hideDialog();
              resolve("discard");
            },
          },
          {
            label: "Merge into account",
            variant: "primary",
            onPress: () => {
              hideDialog();
              resolve("merge");
            },
          },
        ],
      });
    });
  };

  const confirmRecoveryReplacement = (): Promise<boolean> => {
    return confirm({
      title: "Replace previous recovery copy?",
      description:
        "A previous local recovery copy already exists. Creating a new recovery copy will permanently delete it. This cannot be undone.",
      confirmText: "Replace recovery copy",
      confirmVariant: "destructive",
    });
  };

  const confirmSignOut = async (): Promise<boolean> => {
    console.log("[AuthContext] confirmSignOut", workspaceSyncMode);
    return confirm({
      title: "Sign out?",
      description: `Are you sure you want to sign out? `,
      children: (
        <>
          {workspaceSyncMode === "detached_pending_choice" && (
            <Text
              style={{
                marginTop: 10,
                fontSize: 11,
                fontStyle: "italic",
                color: "red",
              }}
            >
              This device has local data that hasn't been synced to your
              account. Signing out now will leave it unresolved until you sign
              in again.
            </Text>
          )}
        </>
      ),
      confirmText: "Sign out",
      confirmVariant: "destructive",
    });
  };

  const startEmailLink = useCallback(async (email: string): Promise<void> => {
    try {
      console.log("[AuthContext] Starting email link for:", email);
      const { data, error } = await supabase.auth.updateUser({ email });
      console.log("[AuthContext] Email link sent:", data, error);
      if (error) throw error;
    } catch (err) {
      console.error("[AuthContext] Failed to start email link:", err);
      throw err; // caller (the sign-up form) surfaces this inline
    }
  }, []);

  // ── Step 2: verify the OTP, then set the password ────────────────────────
  const completeEmailLink = useCallback(
    async (otp: string, password: string): Promise<void> => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        const email =
          currentSession?.user?.email || currentSession?.user?.new_email;
        if (!email) throw new Error("No pending email to verify.");

        const { data: response, error: verifyError } =
          await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: "email_change", // verifying the email just attached to this user
          });
        console.log(
          "[AuthContext] Email link verified:",
          response,
          verifyError,
        );
        if (verifyError) throw verifyError;

        const { data, error: passwordError } = await supabase.auth.updateUser({
          password,
        });
        if (passwordError) throw passwordError;
        console.log("[AuthContext] Password set:", data, passwordError);
        await supabase
          .from("profiles")
          .update({ email, is_anonymous: false })
          .eq("id", currentSession!.user.id);
      } catch (err) {
        console.error("[AuthContext] Failed to complete email link:", err);
        throw err;
      }
    },
    [],
  );

  // ── Sign in to a DIFFERENT existing account (switch, not merge) ─────────

  // ── Sign in to a DIFFERENT existing account (switch, not merge) ─────────
  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        const localDataIsDirty = await hasAnyMeaningfulUnsyncedData();

        if (localDataIsDirty) {
          const choice = await promptMergeOrDiscard();
          if (choice === "discard") {
            const existingRecovery = await getRecoverySnapshotSummary();
            if (existingRecovery) {
              const confirmed = await confirmRecoveryReplacement();
              console.log("confirmed", confirmed);
              if (!confirmed) {
                clearPendingAccountTransition();
                return;
              }
            }
            setPendingAccountTransition({
              mode: "replace",
              sourceUserId: userId,
              sourceIsAnonymous: isAnonymous,
            });
          } else {
            setPendingAccountTransition({ mode: "merge" });
          }
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          clearPendingAccountTransition();
          throw error;
        }

        await waitForUsableSession();
        await updateSessionAvatar();
      } catch (err) {
        clearPendingAccountTransition();
        console.error("[AuthContext] Failed to sign in:", err);
        throw err;
      }
    },
    [
      hasAnyMeaningfulUnsyncedData,
      setPendingAccountTransition,
      userId,
      isAnonymous,
      updateSessionAvatar,
    ],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      const confirmed = await confirmSignOut();
      if (!confirmed) return;
      await supabase.auth.signOut();
      // Re-bootstrap a fresh anonymous session so the app never has "no identity"
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setSession(data.session);
      console.log("[AuthContext] Signed out.", data.session);
    } catch (err) {
      console.error("[AuthContext] Failed to sign out:", err);
      dispatchError(
        `Failed to sign out: ${err instanceof Error ? err.message : String(err)}`,
        "fatal",
      );
    }
  }, [dispatchError, workspaceSyncMode]);

  const updateAvatar = useCallback(
    async (avatarId: string, updatedAt: string): Promise<void> => {
      console.log("[AuthContext] Updating avatar...");
      if (!userId) return;
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_id: avatarId, avatar_updated_at: updatedAt })
          .eq("id", userId);
        if (error) throw error;
        console.log("[AuthContext] Avatar updated:", avatarId, updatedAt);
      } catch (err) {
        console.error("[AuthContext] Failed to update avatar:", err);
        throw err;
      }
    },
    [userId],
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        isAnonymous,
        authLoaded,
        userId,
        userEmail,
        startEmailLink,
        completeEmailLink,
        updateAvatar,
        signInWithPassword,
        signOut,
        setPendingAccountTransition,
        consumePendingAccountTransition,
        clearPendingAccountTransition,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
