import React, { useEffect, useRef, useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
  Animated,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { SegmentedButtons, TextInput } from "react-native-paper";

import { ThemeContext } from "@/context/ThemeContext";
import { Habit } from "@/types/habits";
import {
  getDifficulty,
  Difficulty,
  restartHabitAfterGoal,
} from "@/utils/habit-utils";
import DaySelector from "@/components/ui/day-selector";

interface GoalCompletionModalProps {
  visible: boolean;
  habit: Habit;
  onRestart: (updated: Habit) => void;
  onDelete: () => void;
  onDismiss: () => void;
}

// ─── Difficulty Config ────────────────────────────────────────────────────────

interface DifficultyConfig {
  confettiCount: number;
  colors: string[];
  message: string;
  subMessage: string;
  accentColor: string;
  borderStyle: "none" | "solid" | "shimmer";
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    confettiCount: 15,
    colors: ["#a8edbb", "#78d49e", "#4fc07e", "#ffffff"],
    message: "Nice work!",
    subMessage: "You completed your goal. Keep the momentum going!",
    accentColor: "#4fc07e",
    borderStyle: "none",
  },
  medium: {
    confettiCount: 30,
    colors: ["#60b4f6", "#a78bfa", "#f472b6", "#fbbf24", "#ffffff"],
    message: "Impressive!",
    subMessage:
      "Two weeks of consistency — that's real discipline. You've built something solid.",
    accentColor: "#a78bfa",
    borderStyle: "solid",
  },
  hard: {
    confettiCount: 60,
    colors: ["#f97316", "#ef4444", "#fbbf24", "#fb923c", "#ffffff", "#fde68a"],
    message: "Outstanding!!",
    subMessage:
      "A full month (or more) of showing up every single day. Most people never get here. You did.",
    accentColor: "#f97316",
    borderStyle: "solid",
  },
  legendary: {
    confettiCount: 90,
    colors: ["#fde68a", "#fbbf24", "#f59e0b", "#ffffff", "#fcd34d", "#fef3c7"],
    message: "LEGENDARY!!!",
    subMessage:
      "What you've done is genuinely extraordinary. This level of commitment defines who you are. Wear it.",
    accentColor: "#fbbf24",
    borderStyle: "shimmer",
  },
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Component ────────────────────────────────────────────────────────────────

export const GoalCompletionModal = ({
  visible,
  habit,
  onRestart,
  onDelete,
  onDismiss,
}: GoalCompletionModalProps) => {
  const { theme } = useContext(ThemeContext);
  const difficulty = getDifficulty(habit); //"hard" as Difficulty;
  const config = DIFFICULTY_CONFIG[difficulty];
  const [newGoal, setNewGoal] = useState(habit.goal);
  const [newTargetDays, setNewTargetDays] = useState(habit.targetDays || []);
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekly">(
    habit.frequency
  );

  // Two confetti cannons — left and right — staggered 150ms for an explosive
  // "burst from both sides" feel rather than a single central spray
  const leftCannonRef = useRef<ConfettiCannon>(null);
  const rightCannonRef = useRef<ConfettiCannon>(null);

  // Shimmer animation only rendered for legendary tier
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Fire left cannon immediately, right cannon 150ms later
    leftCannonRef.current?.start();
    const rightTimer = setTimeout(() => rightCannonRef.current?.start(), 150);

    // Shimmer loop for legendary border
    if (difficulty === "legendary") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    }

    return () => clearTimeout(rightTimer);
  }, [visible]);

  const borderColor =
    difficulty === "legendary"
      ? shimmerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["#f59e0b", "#ffffff"],
        })
      : config.accentColor;

  const handleRestart = () => {;
    if (!newGoal || newGoal < 1) return; // guard against empty/invalid input
 
    // Apply the user's updated goal and frequency before restarting.
    // restartHabitAfterGoal then sets pendingStreakResetAfter and logs the
    // completion — streak resets on next check-in, not right now.
    const oldGoal = habit.goal;

    //TODOX - in TESTING : targetDays only work if targeet days selected, if frequency weekly and target days not selected, target days should be undefined, and restart should from next week same day
    //TODOX - in TESTING : Above has been fixed, but there was same issue with Freezing for weekly without targetdays, fixed that too, check was similar 
    const habitWithUpdates: Habit = {
      ...habit,
      goal: newGoal,
      targetDays: newFrequency === "weekly" ? newTargetDays : undefined,
      frequency: newFrequency,
    };
    onRestart(restartHabitAfterGoal(habitWithUpdates, oldGoal));
    onDismiss();
  };

  const handleDelete = () => {
    onDelete();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      {/* Confetti rendered outside the card so it covers the full screen */}
      {visible && (
        <>
          <ConfettiCannon
            ref={leftCannonRef}
            count={config.confettiCount}
            origin={{ x: 0, y: SCREEN_HEIGHT * 0.4 }}
            colors={config.colors}
            explosionSpeed={400}
            fallSpeed={3000}
            fadeOut
            autoStart={false}
          />
          <ConfettiCannon
            ref={rightCannonRef}
            count={config.confettiCount}
            origin={{ x: SCREEN_WIDTH, y: SCREEN_HEIGHT * 0.4 }}
            colors={config.colors}
            explosionSpeed={400}
            fallSpeed={3000}
            fadeOut
            autoStart={false}
          />
        </>
      )}

      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: theme.habitDarkPrimary },
            /* difficulty !== "none" && */ {
              borderWidth: difficulty === "easy" ? 0 : 2,
              borderColor,
            },
          ]}
        >
          {/* Completion count badge — shown only after first restart */}
          {(habit.goalCompletions?.length ?? 0) > 0 && (
            <View
              style={[styles.badge, { backgroundColor: config.accentColor }]}
            >
              <Text style={styles.badgeText}>
                #{(habit.goalCompletions?.length ?? 0) + 1} completion
              </Text>
            </View>
          )}

          <Text style={[styles.emoji]}>
            {difficulty === "legendary"
              ? "👑"
              : difficulty === "hard"
                ? "🏆"
                : difficulty === "medium"
                  ? "🔥"
                  : "🎉"}
          </Text>

          <Text style={[styles.headline, { color: config.accentColor }]}>
            {config.message}
          </Text>

          <Text style={[styles.habitName, { color: theme.whiteBase }]}>
            {habit.title}
          </Text>

          <Text style={[styles.goalLine, { color: config.accentColor }]}>
            {habit.frequency === "daily" ? "Daily" : "Weekly"} goal of{" "}
            <Text style={{ fontWeight: "bold" }}>{habit.goal}</Text> reached!
          </Text>

          <Text style={[styles.subMessage, { color: theme.whiteBase }]}>
            {config.subMessage}
          </Text>

          <View style={styles.divider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <StatPill
              label="Streak"
              value={habit.streak}
              accent={config.accentColor}
            />
            <StatPill
              label="Best"
              value={habit.longestStreak}
              accent={config.accentColor}
            />
            <StatPill
              label="Times completed"
              value={(habit.goalCompletions?.length ?? 0) + 1}
              accent={config.accentColor}
            />
          </View>

          <View style={styles.divider} />

          {/* Actions */}
          <View style={{ flexDirection: "column", marginBottom: 12, width: "100%", alignItems: "center" }}>
          <SegmentedButtons
            //style={styles.verticalMargin}
            value={newFrequency}
            onValueChange={(val) =>
             setNewFrequency( val as "daily" | "weekly")
            }
            buttons={[
              {
                value: "daily",
                label: "Daily",
                uncheckedColor: theme.whiteBase,
                checkedColor: config.accentColor,
                style: { backgroundColor: theme.habitDarkSecondary },
              },
              {
                value: "weekly",
                label: "Weekly",
                uncheckedColor: theme.whiteBase,
                checkedColor: config.accentColor,
                style: { backgroundColor: theme.habitDarkSecondary },
              },
            ]}
          />
          <DaySelector
            visible={newFrequency == "weekly"}
            selectedDays={newTargetDays}
            setTargetDaysOnly={setNewTargetDays}
          />
          <TextInput
            style={{marginVertical: 4, maxHeight: 50, width: "100%" }}
            label="New Goal"
            mode="outlined"
            activeOutlineColor={config.accentColor}
            defaultValue={String(newGoal)}
            onChangeText={(text) => setNewGoal(parseInt(text) || 0)}
            keyboardType="numeric"
          />
          </View>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: config.accentColor }]}
            onPress={handleRestart}
          >
            <Text style={styles.primaryBtnText}>Restart Habit</Text>
          </Pressable>

          <Pressable style={[styles.deleteBtn]} onPress={handleDelete}>
            <Text style={[styles.deleteBtnText, { color: theme.whiteBase }]}>
              I'm done — delete this habit
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  badge: {
    position: "absolute",
    top: -12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emoji: {
    fontSize: 52,
    marginTop: 12,
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  habitName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  goalLine: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: "center",
  },
  subMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
    paddingHorizontal: 8,
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  statPill: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: "center",
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 16,
  },
  deleteBtn: {
    width: "100%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.5)",
  },
  deleteBtnText: {
    fontSize: 16,
    opacity: 0.6,
    fontWeight: "500",
  },
});
