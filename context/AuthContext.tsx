import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/utils/Account-utils/supabase-client";
import { useData } from "@/hooks/context-hooks/use-data";
import { hasAnyUnsyncedData } from "@/utils/Account-utils/unsynced-local-data";
import { pushCategories } from "@/utils/Account-utils/sync-engine";
import { runFullSync } from "@/utils/Account-utils/sync-orchestrator";
import { useSettings } from "./SettingsContext";

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

  // ── Bootstrap: every install gets an identity, signed up or not ──────────
  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        console.log("[AuthContext] Existing session:", existing);
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
  /*  // ── Upgrade anonymous → real account without losing the same user id ────
  const linkAnonymousToEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      try {
        const { data, error } = await supabase.auth.updateUser({
          email,
          password,
        });
        if (error) throw error;

        await supabase
          .from("profiles")
          .update({ email, is_anonymous: false })
          .eq("id", data.user.id);

        setSession((prev) => (prev ? { ...prev, user: data.user } : prev));
      } catch (err) {
        console.error("[AuthContext] Failed to link account:", err);
        throw err; // caller shows the error (e.g. in a form)
      }
    },
    [],
  ); */
  // ── Step 1: attach an email to the CURRENT anonymous user ────────────────
  // This sends a verification OTP/link to the email. The user is NOT yet
  // "linked" — that only happens after completeEmailLink() succeeds.
  // Supabase requires this as a separate step; a single updateUser({ email, password })
  // call does not reliably work for anonymous users. [Supabase Auth docs]

  const promptMergeOrDiscard = (): Promise<MergeChoice> => {
    return new Promise((resolve) => {
      Alert.alert(
        "Local data found",
        "This device has data that hasn't been backed up to any account. " +
          "Would you like to merge it into the account you're signing into, " +
          "or discard it and load that account's existing data instead?",
        [
          {
            text: "Discard local data",
            style: "destructive",
            onPress: () => resolve("discard"),
          },
          {
            text: "Merge into account",
            style: "default",
            onPress: () => resolve("merge"),
          },
        ],
        { cancelable: false },
      );
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
        const localDataIsDirty = await hasAnyUnsyncedData();

        if (localDataIsDirty) {
          const choice = await promptMergeOrDiscard();

          if (choice === "merge") {
            // Push BEFORE switching sessions — the current anonymous session's
            // JWT is still what RLS will check against user_id if you tag
            // rows with the anonymous user's id. Simpler + safer: push AFTER
            // sign-in succeeds, tagged to the NEW account's user_id instead —
            // this treats "merge" as "adopt this device's local data into my
            // account," not "preserve the anonymous identity's cloud rows."
            const { error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            if (error) throw error;

            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (session?.user?.id) {
              await pushCategories(session.user.id);
              // await pushTasks(session.user.id); etc., as each table comes online
            }
            updateSessionAvatar();
            return;
          }

          // choice === "discard" — just sign in, don't push anything.
          // Local dirty rows remain in SQLite, untouched, simply never synced.
        }
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        updateSessionAvatar();
      } catch (err) {
        console.error("[AuthContext] Failed to sign in:", err);
        throw err;
      }
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      // Re-bootstrap a fresh anonymous session so the app never has "no identity"
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      setSession(data.session);
    } catch (err) {
      console.error("[AuthContext] Failed to sign out:", err);
      dispatchError(
        `Failed to sign out: ${err instanceof Error ? err.message : String(err)}`,
        "fatal",
      );
    }
  }, [dispatchError]);

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

  const updateSessionAvatar = useCallback(async (): Promise<void> => {
    console.log("[AuthContext] Updating session avatar...");
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
