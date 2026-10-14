import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, Text } from "react-native-paper";

import { withAlpha } from "@/utils/common-utils";

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export type HomeEmptyAction = {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  accentColor: string;
  onPress: () => void;
};

type HomeEmptyStateCardProps = {
  icon: IconName;
  accentColor: string;
  title: string;
  description: string;
  actionLabel: string;
  onPress: () => void;
  textColor: string;
};

/**
 * Compact empty state used when an individual Home section is empty.
 */
export function HomeEmptyStateCard({
  icon,
  accentColor,
  title,
  description,
  actionLabel,
  onPress,
  textColor,
}: HomeEmptyStateCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: withAlpha(accentColor, "10"),
          borderColor: withAlpha(accentColor, "30"),
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: withAlpha(accentColor, "20") },
          ]}
        >
          <MaterialCommunityIcons name={icon} size={24} color={accentColor} />
        </View>

        <View style={styles.cardCopy}>
          <Text
            variant="titleMedium"
            style={[styles.cardTitle, { color: textColor }]}
          >
            {title}
          </Text>

          <Text
            variant="bodyMedium"
            style={[
              styles.cardDescription,
              { color: withAlpha(textColor, "B8") },
            ]}
          >
            {description}
          </Text>
        </View>
      </View>

      <Button
        mode="text"
        compact
        icon="plus"
        textColor={accentColor}
        onPress={onPress}
        contentStyle={styles.buttonContent}
        style={styles.button}
      >
        {actionLabel}
      </Button>
    </View>
  );
}

type HomeAllEmptyStateProps = {
  actions: HomeEmptyAction[];
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  onViewTimeline: () => void;
};

/**
 * Welcome panel displayed when all four Home sections are empty.
 */
export function HomeAllEmptyState({
  actions,
  accentColor,
  backgroundColor,
  textColor,
  onViewTimeline,
}: HomeAllEmptyStateProps) {
  return (
    <View
      style={[styles.allEmptyContainer, { backgroundColor: backgroundColor }]}
    >
      <View
        style={[
          styles.hero,
          {
            backgroundColor: withAlpha(accentColor, "12"),
            borderColor: withAlpha(accentColor, "30"),
          },
        ]}
      >
        <View
          style={[
            styles.heroIcon,
            { backgroundColor: withAlpha(accentColor, "20") },
          ]}
        >
          <MaterialCommunityIcons
            name="weather-sunset-up"
            size={34}
            color={accentColor}
          />
        </View>

        <Text
          variant="headlineSmall"
          style={[styles.heroTitle, { color: textColor }]}
        >
          A fresh start
        </Text>

        <Text
          variant="bodyMedium"
          style={[
            styles.heroDescription,
            { color: withAlpha(textColor, "C0") },
          ]}
        >
          Your day is wide open. Add something meaningful, or enjoy the
          breathing room.
        </Text>

        <Button
          mode="text"
          icon="calendar-clock"
          textColor={accentColor}
          onPress={onViewTimeline}
        >
          View today's timeline
        </Button>
      </View>

      <View style={styles.actionsContainer}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.actionPressed,
            ]}
          >
            <View
              style={[
                styles.actionIcon,
                {
                  backgroundColor: withAlpha(action.accentColor, "20"),
                },
              ]}
            >
              <MaterialCommunityIcons
                name={action.icon}
                size={28}
                color={action.accentColor}
              />
            </View>

            <View style={styles.actionCopy}>
              <Text variant="titleSmall" style={{ color: textColor }}>
                {action.title}
              </Text>

              <Text
                variant="bodySmall"
                style={{ color: withAlpha(textColor, "A8") }}
              >
                {action.subtitle}
              </Text>
            </View>

            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={23}
              color={action.accentColor}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginHorizontal: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  cardCopy: {
    flex: 1,
    marginLeft: 12,
  },

  cardTitle: {
    fontWeight: "600",
  },

  cardDescription: {
    marginTop: 3,
    lineHeight: 20,
  },

  button: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginLeft: -8,
  },

  buttonContent: {
    justifyContent: "flex-start",
  },

  allEmptyContainer: {
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 16,
    flex: 1,
  },

  hero: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },

  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  heroTitle: {
    fontWeight: "700",
    textAlign: "center",
  },

  heroDescription: {
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 4,
    maxWidth: 330,
  },

  actionsContainer: {
    marginTop: 12,
    paddingHorizontal: 4,
  },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },

  actionPressed: {
    opacity: 0.65,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  actionCopy: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
});
