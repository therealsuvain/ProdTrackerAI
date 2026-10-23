import React, { useContext } from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Text } from "react-native-paper";
import { Pressable, StyleSheet, View, Text as NativeText } from "react-native";

import type { GlobalSearchMatch } from "@/types/global-search";
import {
  normalizeSearchText,
  tokenizeSearchText,
} from "@/utils/Search-utils/text-normalization";

import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import { SearchResult } from "@/utils/search-utils";
import type {
  GlobalSearchKind,
  GlobalSearchResult,
} from "@/types/global-search";

const RESULT_META: Record<
  Exclude<GlobalSearchKind, "easterEgg">,
  { label: string; icon: string }
> = {
  task: { label: "Task", icon: "checkbox-marked-circle-outline" },
  event: { label: "Event", icon: "calendar-blank-outline" },
  habit: { label: "Habit", icon: "sprout" },
  log: { label: "Timer log", icon: "timer-outline" },
  tag: { label: "Tag", icon: "tag-outline" },
  category: { label: "Category", icon: "shape-outline" },
  achievement: { label: "Achievement", icon: "trophy-outline" },
  setting: { label: "Setting", icon: "cog-outline" },
  chart: { label: "Chart", icon: "chart-box-outline" },
  action: { label: "Action", icon: "lightning-bolt-outline" },
};

type Props = {
  result: GlobalSearchResult;
  onPress: () => void;
  //match?: GlobalSearchMatch;
  query?: string;
};

interface HighlightSegment {
  text: string;
  matched: boolean;
}

function isFuzzyTokenMatch(queryToken: string, word: string): boolean {
  if (queryToken.length < 3 || word.length < 3) return false;

  const maxLength = Math.max(queryToken.length, word.length);
  const maxDistance = queryToken.length <= 7 ? 1 : 2;
  const minSimilarity =
    queryToken.length <= 4 ? 0.66 : queryToken.length <= 7 ? 0.72 : 0.78;

  const rows = queryToken.length + 1;
  const columns = word.length + 1;

  const distances = Array.from({ length: rows }, () =>
    Array<number>(columns).fill(0),
  );

  for (let i = 0; i < rows; i++) distances[i][0] = i;
  for (let j = 0; j < columns; j++) distances[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < columns; j++) {
      const cost = queryToken[i - 1] === word[j - 1] ? 0 : 1;

      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );

      // Treat an adjacent character transposition as one edit.
      if (
        i > 1 &&
        j > 1 &&
        queryToken[i - 1] === word[j - 2] &&
        queryToken[i - 2] === word[j - 1]
      ) {
        distances[i][j] = Math.min(
          distances[i][j],
          distances[i - 2][j - 2] + 1,
        );
      }
    }
  }

  const distance = distances[rows - 1][columns - 1];

  return distance <= maxDistance && 1 - distance / maxLength >= minSimilarity;
}

/**
 * Splits the original text while preserving punctuation and spacing.
 * Matching is performed against normalized words, but displayed text
 * remains unchanged.
 */
function getHighlightSegments(
  value: string,
  query: string,
  allowFuzzy = false,
): HighlightSegment[] {
  if (!value || !query.trim()) {
    return [{ text: value, matched: false }];
  }

  const queryTokens = tokenizeSearchText(query);

  if (queryTokens.length === 0) {
    return [{ text: value, matched: false }];
  }

  const segments: HighlightSegment[] = [];
  const expression = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = expression.exec(value)) !== null) {
    const start = match.index;
    const word = match[0];

    if (start > cursor) {
      segments.push({
        text: value.slice(cursor, start),
        matched: false,
      });
    }

    const normalizedWord = normalizeSearchText(word);

    /* const isLiteralMatch = queryTokens.some(
      (token) =>
        normalizedWord === token ||
        (token.length >= 2 && normalizedWord.startsWith(token)),
    ); */
    const isLiteralMatch = queryTokens.some(
      (token) =>
        normalizedWord === token ||
        (token.length >= 2 && normalizedWord.startsWith(token)) ||
        (allowFuzzy && isFuzzyTokenMatch(token, normalizedWord)),
    );

    segments.push({
      text: word,
      matched: isLiteralMatch,
    });

    cursor = start + word.length;
  }

  if (cursor < value.length) {
    segments.push({
      text: value.slice(cursor),
      matched: false,
    });
  }

  return segments.length > 0 ? segments : [{ text: value, matched: false }];
}

function HighlightedText({
  value,
  query,
  color,
  accentColor,
  allowFuzzy = false,
}: {
  value: string;
  query: string;
  color: string;
  accentColor: string;
  allowFuzzy?: boolean;
}) {
  const segments = getHighlightSegments(value, query, allowFuzzy);

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <NativeText
            key={index}
            style={{
              color: accentColor,
              backgroundColor: withAlpha(accentColor, "30"),
              fontWeight: "700",
            }}
          >
            {segment.text}
          </NativeText>
        ) : (
          <NativeText key={index} style={{ color }}>
            {segment.text}
          </NativeText>
        ),
      )}
    </>
  );
}

export function SearchResultRow({ result, onPress, query = "" }: Props) {
  const { theme } = useContext(ThemeContext);

  const { document, match } = result;
  if (document.kind === "easterEgg") return null;
  const type = document.kind;

  const meta = RESULT_META[type as Exclude<GlobalSearchKind, "easterEgg">];

  const typeAccentColor =
    type === "task"
      ? theme.taskBase
      : type === "event"
        ? theme.eventBase
        : type === "habit"
          ? theme.habitBase
          : type === "log"
            ? theme.timerBase
            : theme.taskBase;

  const accentColor =
    document.display.presentation?.accentColor ?? typeAccentColor;

  const title = document.display.title.trim() || "Untitled";
  const queryText = query ?? "";
  const matchedValue = match.snippet ?? match.matchedText ?? "";

  const subtitle =
    match.field === "description" || match.field === "unlockedDescription"
      ? matchedValue || document.display.subtitle || meta.label
      : match.field === "tag"
        ? `Tag · ${matchedValue}`
        : match.field === "category"
          ? `Category · ${matchedValue}`
          : match.field === "alias"
            ? `Also known as · ${matchedValue}`
            : document.display.subtitle || meta.label;

  const iconName = document.display.presentation?.icon?.name ?? meta.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}: ${title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: withAlpha(theme.text, "07"),
          borderColor: withAlpha(theme.text, "10"),
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: withAlpha(accentColor, "20") },
        ]}
      >
        <MaterialCommunityIcons
          name={
            iconName as React.ComponentProps<
              typeof MaterialCommunityIcons
            >["name"]
          }
          size={23}
          color={accentColor}
        />
      </View>

      <View style={styles.content}>
        <Text
          variant="titleSmall"
          numberOfLines={1}
          style={[styles.title, { color: theme.text }]}
        >
          <HighlightedText
            value={title}
            query={queryText}
            color={theme.text}
            accentColor={accentColor}
            allowFuzzy={
              match.field === "title" && match.quality === "fuzzy-title"
            }
          />
        </Text>

        <Text
          variant="bodySmall"
          numberOfLines={2}
          style={[styles.description, { color: withAlpha(theme.text, "A8") }]}
        >
          <HighlightedText
            value={subtitle}
            query={queryText}
            color={withAlpha(theme.text, "A8")}
            accentColor={accentColor}
          />
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={withAlpha(theme.text, "70")}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 15,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    marginTop: 4,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
