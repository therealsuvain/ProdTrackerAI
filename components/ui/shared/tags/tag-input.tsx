import React, { useState, useContext, useMemo } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemeContext } from "@/context/ThemeContext";
import { TagBadge } from "./tag-badge"; // Reusing your new tag list
import { TagRow } from "@/db/schema";

interface TagInputProps {
  itemType: "task" | "habit" | "event" | "log";
  currentTags: string[];
  userTagsDb: TagRow[]; // Pass the DB rows here
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export const TagInput = ({
  itemType,
  currentTags,
  userTagsDb,
  onAddTag,
  onRemoveTag,
}: TagInputProps) => {
  const { theme } = useContext(ThemeContext);
  const [inputText, setInputText] = useState("");
  // 1. Determine Color Scheme based on itemType
  const activeColor = useMemo(() => {
    switch (itemType) {
      case "task":
        return theme.taskBase || "#3b82f6";
      case "habit":
        return theme.habitBase || "#10b981";
      case "event":
        return theme.eventBase || "#f59e0b";
      case "log":
        return theme.timerBase || "#8b5cf6";
      default:
        return theme.greyBasePrimary;
    }
  }, [itemType, theme]);

  // 2. Sanitize Function (lowercase, replace spaces with hyphens, remove special chars)
  const sanitizeTag = (val: string) => {
    return val
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
  };

  // 3. Autocomplete Logic
  const suggestion = useMemo(() => {
    if (!inputText) return "";
    const sanitizedInput = sanitizeTag(inputText);

    // Find matching tags, sort by highest count
    const matches = userTagsDb
      .filter((t) => t.name.startsWith(sanitizedInput))
      .sort((a, b) => b.count - a.count);

    if (matches.length > 0 && matches[0].name !== sanitizedInput) {
      // Return only the *remainder* of the word
      return matches[0].name.substring(sanitizedInput.length);
    }
    return "";
  }, [inputText, userTagsDb]);

  // 4. Handlers
  const handleAdd = () => {
    const finalTag = sanitizeTag(inputText);
    if (finalTag && !currentTags) onAddTag(finalTag);
    else if (finalTag && !currentTags.includes(finalTag)) {
      onAddTag(finalTag);
    }
    setInputText("");
  };

  const commitSuggestion = () => {
    if (suggestion) {
      setInputText(sanitizeTag(inputText) + suggestion);
    }
  };

  return (
    <View style={styles.container}>
      {/* Input Row */}
      <View
        style={[
          styles.inputRow,
          { borderColor: theme.greyBasePrimary, backgroundColor: "#1D1B1E" },
        ]}
      >
        <View style={styles.textInputWrapper}>
          {/* Background Suggestion Layer */}
          <Text style={styles.overlayText} pointerEvents="none">
            <Text style={{ color: "transparent" }}>{inputText}</Text>
            <Text style={{ color: theme.greyBasePrimary, opacity: 0.5 }}>
              {suggestion}
            </Text>
          </Text>

          {/* Actual Editable Input */}
          <TextInput
            style={[styles.textInput, { color: theme.whiteBase }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Add tag..."
            placeholderTextColor={theme.greyBasePrimary}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onSubmitEditing={handleAdd}
          />

          {/* Invisible overlay over the right side to detect suggestion taps */}
          {suggestion ? (
            <Pressable
              style={styles.suggestionHitbox}
              onPress={commitSuggestion}
            />
          ) : null}
        </View>

        {/* Add Button */}
        <Pressable
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: activeColor }]}
        >
          <Ionicons name="add" size={18} color={theme.whiteBase || "#FFF"} />
        </Pressable>
      </View>

      {/* Tags Display (Tappable for deletion) */}
      <View style={styles.tagsContainer}>
        {currentTags &&
          currentTags.map((tag) => (
            <Pressable key={tag} onPress={() => onRemoveTag(tag)}>
              {/* Wrap your existing TagBadge in a Pressable. 
                Assuming you extract TagBadge from TagList as requested earlier */}
              {/*             <View
              style={[
                styles.tagBadge,
                { backgroundColor: theme.taskDarkPrimary },
              ]}
            >
              <View style={[styles.dot, { backgroundColor: activeColor }]} />
              <Text style={{ color: theme.whiteBase, fontSize: 12 }}>
                {tag}
              </Text>
            </View> */}
              <TagBadge tagName={tag} holeColor={"#000000"} />
            </Pressable>
          ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInputWrapper: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    height: 32,
  },
  textInput: {
    position: "absolute",
    width: "100%",
    height: "100%",
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  overlayText: {
    position: "absolute",
    width: "100%",
    fontSize: 16,
    //fontWeight: "500",
    top: 6, // Adjust depending on your font metrics to align perfectly with TextInput
  },
  suggestionHitbox: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "75%", // Assuming the user types on the left, tapping the right half accepts it
  },
  addButton: {
    padding: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  // Basic styles for the deletable tag badge
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});
