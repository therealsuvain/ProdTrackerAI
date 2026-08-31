import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
import { useSync } from "@/context/SyncContext";

// This SWITCHES to a different, already-existing account.
// It does NOT merge the current device's anonymous local data —
// that data stays behind under the old anonymous identity.
export default function SignInScreen() {
  const { signInWithPassword } = useAuth();
  const { isSignInSyncCompleted } = useSync();
  const syncVersionAtSignIn = useRef(isSignInSyncCompleted);
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [waitingForSync, setWaitingForSync] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Enter your email and password.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      setWaitingForSync(true);
      await signInWithPassword(email.trim(), password);
    } catch (err) {
      setWaitingForSync(false);
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sign in.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!waitingForSync) return;

    if (isSignInSyncCompleted > syncVersionAtSignIn.current) {
      setWaitingForSync(false);
      router.back();
    }
  }, [waitingForSync, isSignInSyncCompleted]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={styles.warning}>
        Signing in switches to that account's data. Data created on this device
        under the current session will not automatically transfer.
      </Text>

      <TextInput
        style={[styles.input, { borderColor: theme.text, color: theme.text }]}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={[styles.input, { borderColor: theme.text, color: theme.text }]}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errorMessage && (
        <Text style={[styles.error, { color: theme.error }]}>
          {errorMessage}
        </Text>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.text} />
        ) : (
          <Text style={[styles.buttonText, { color: theme.text }]}>
            Sign in
          </Text>
        )}
      </TouchableOpacity>
      <ActivityIndicator
        size="large"
        color="#01696f"
        animating={waitingForSync}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  warning: { fontSize: 13, opacity: 0.7, marginBottom: 20, color: "#964219" },
  input: {
    borderWidth: 1,
    borderColor: "#3333",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#01696f",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#a12c7b", marginBottom: 12 },
});
