import { getRecoverySnapshotSummary } from "@/db/repositories/sync-repository";
import { RecoverySnapshotSummary } from "@/types/recovery-snapshot";
import { useRecoveryConsumedStore } from "@/utils/Account-utils/snapshot-status-store";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";

export const RestoreRecoveryWidget = () => {
  const [snapshotDetails, setSnapshotDetails] =
    useState<RecoverySnapshotSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sameSnapsot, setSameSnapsot] = useState(false);
  const snapshotRestoredId = useRecoveryConsumedStore(
    (state) => state.lastConsumedSnapshotId,
  );
  const snapshotRestoredTimeStamp = useRecoveryConsumedStore(
    (state) => state.lastConsumedTimestamp,
  );
  const snapshotRestoredAction = useRecoveryConsumedStore(
    (state) => state.lastConsumedAction,
  );
  //console.log(snapshotDetails);
  const loadSnapshot = async () => {
    try {
      const snapshot = await getRecoverySnapshotSummary();
      setSnapshotDetails(snapshot);
      if (snapshot) {
        setSameSnapsot(snapshot.id === snapshotRestoredId);
      }
      setLoading(false);
    } catch (error) {
      console.error("Failed to load recovery snapshot:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSnapshot();
    }, [loadSnapshot]),
  );

  if (loading) {
    return (
      <View>
        <Text style={styles.text}>Loading recovery...</Text>
      </View>
    );
  }

  if (!snapshotDetails) {
    return (
      <View>
        <Text style={styles.text}>No recovery found</Text>
      </View>
    );
  }
  const createdAt = new Date(snapshotDetails.createdAt).toLocaleDateString(
    "en-US",
    {
      hour: "numeric",
      minute: "numeric",
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
  const expiresAt = new Date(snapshotDetails.expiresAt).toLocaleDateString(
    "en-US",
    {
      hour: "numeric",
      minute: "numeric",
      month: "short",
      day: "numeric",
      year: "numeric",
    },
  );
  return (
    <View>
      <Text style={styles.text}>Created At : {createdAt}</Text>
      <Text style={styles.text}>Expires On : {expiresAt}</Text>
      {sameSnapsot && (
        <Text style={[styles.text, { color: "#ffbbbb7c" }]}>
          {snapshotRestoredAction} on :{" "}
          {new Date(snapshotRestoredTimeStamp!).toLocaleDateString("en-US", {
            hour: "numeric",
            minute: "numeric",
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    color: "#ffffff7c",
  },
});
