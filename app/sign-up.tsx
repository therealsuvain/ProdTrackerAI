import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router, Link } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/context-hooks/use-theme-colors";
// Two-step flow, matching Supabase's actual anonymous-user linking requirement:
// Step "email"    → user enters email, we call startEmailLink() which sends an OTP
// Step "verify"    → user enters the OTP + chooses a password, we call completeEmailLink()
type Step = "email" | "verify";

export default function SignUpScreen() {
  const { startEmailLink, completeEmailLink } = useAuth();
  const { theme } = useTheme();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setErrorMessage("Enter your email address.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await startEmailLink(email.trim());
      setStep("verify");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send code.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!otp.trim()) {
      setErrorMessage(
        "Wrong code or code expired. Please check your email or try again.",
      );
      return;
    } else if (password.length < 8) {
      setErrorMessage("Password must be atleast 8 characters long.");
      return;
    } else if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    try {
      await completeEmailLink(otp.trim(), password);
      router.back(); // account is now linked; return to Settings
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to verify code.",
      );
    } finally {
      setLoading(false);
      setStep("email");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        Create an account
      </Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>
        Your existing local data stays exactly as it is — this just adds cloud
        backup and sync.
      </Text>

      {step === "email" && (
        <>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.text, color: theme.text },
            ]}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Link href="/sign-in" style={styles.link}>
            Already have an account? Sign in
          </Link>
          {errorMessage && (
            <Text style={[styles.error, { color: theme.error }]}>
              {errorMessage}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.taskBase }]}
            onPress={handleSendCode}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.text }]}>
                Send verification code
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}

      {step === "verify" && (
        <>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            Enter the code sent to {email} and choose a password.
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.text, color: theme.text },
            ]}
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
          />
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.text, color: theme.text },
            ]}
            placeholder="Password (min 8 characters)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={[
              styles.input,
              { borderColor: theme.text, color: theme.text },
            ]}
            placeholder="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          {errorMessage && (
            <Text style={[styles.error, { color: theme.error }]}>
              {errorMessage}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.taskBase }]}
            onPress={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.text }]}>
                Confirm & create account
              </Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, opacity: 0.7, marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  link: {
    color: "#01696f",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  buttonText: { fontWeight: "600", fontSize: 16 },
  error: { marginBottom: 12 },
});
