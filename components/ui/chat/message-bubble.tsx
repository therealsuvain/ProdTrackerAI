import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { Message } from "@/types/chat";
import { ActionChip } from "./action-chip";
import { ThemeContext } from "@/context/ThemeContext";

interface Props {
  message: Message;
  onActionConfirm: (actions: any[]) => void;
  onActionCancel: () => void;
  onRemoveIndividualAction: (actionIndex: number) => void;
  onEnrichAction: (action: any) => any;
}

export const MessageBubble = ({
  message,
  onActionConfirm,
  onActionCancel,
  onRemoveIndividualAction,
  onEnrichAction,
}: Props) => {
  const { theme } = useContext(ThemeContext);
  const isUser = message.sender === "user";
  const isExpired = message.isExpired;
  /*   if (message.type === "action") {
    console.log(message.pendingActions);
  }
 */
  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <View
        style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}
      >
        <Text
          selectable={true}
          style={[
            styles.text,
            isUser
              ? styles.userText
              : isExpired
                ? styles.expiredText
                : styles.aiText,
          ]}
        >
          {message.text}
        </Text>

        {/* Action Buttons for AI Confirmation Bubbles */}
        {message.type === "action" && (
          <View style={styles.actionContainer}>
            <View style={styles.manifestContainer}>
              {message.pendingActions?.map((action, index) => (
                <ActionChip
                  key={index}
                  action={onEnrichAction(action)}
                  onRemove={() => onRemoveIndividualAction(index)}
                  isConfirmed={message.isConfirmed}
                  isExpired={message.isExpired}
                />
              ))}
            </View>
            {!message.isConfirmed && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    isExpired
                      ? { backgroundColor: theme.greyBaseSecondary }
                      : { backgroundColor: "#0084ff1a" },
                  ]}
                  disabled={isExpired}
                  onPress={() => onActionConfirm(message.pendingActions || [])}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isExpired
                        ? { color: theme.greyBasePrimary }
                        : { color: theme.blueLightPrimary },
                    ]}
                  >
                    {isExpired ? "Expired" : "Confirm"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    isExpired
                      ? { backgroundColor: theme.greyBaseSecondary }
                      : { backgroundColor: "#ff81815d" },
                  ]}
                  disabled={isExpired}
                  onPress={onActionCancel}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isExpired
                        ? { color: theme.greyBasePrimary }
                        : { color: theme.error },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      <Text style={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
    marginHorizontal: 12,
    maxWidth: "85%",
  },
  userContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  aiContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: "#108374", //"#00BFA5", // Teal
    borderBottomRightRadius: 4, // iMessage style
  },
  aiBubble: {
    backgroundColor: "#e0e0e0", //"#F0F0F0", // Neutral Gray
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: { color: "#FFFFFF" },
  aiText: { color: "#000000" },
  expiredText: { color: "#8E8E93", fontStyle: "italic" },
  timestamp: {
    fontSize: 10,
    color: "#8E8E93",
    marginTop: 4,
    marginHorizontal: 5,
  },
  // Inline Confirmation Buttons
  manifestContainer: {
    flexDirection: "column",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingTop: 5,
  },
  actionContainer: {
    flexDirection: "column",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  confirmBtn: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 15,
    marginRight: 10,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  btnText: {
    fontWeight: "600",
    fontSize: 14,
  },
});
