import React, { act, useEffect, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { View, Pressable } from "react-native";

import { CategoryBadge } from "../../shared/categories/category-badge";
import { TagBadge } from "../../shared/tags/tag-badge";
import { CategoryCreator } from "../../shared/categories/category-creation-view";
import { TagsEditModal } from "../../shared/tags/tags-edit-modal";
import { resolveIcon } from "@/utils/AI-utils/tags-and-categories-handlers";
import { Category } from "@/types/category";
import { ActionChipProps } from "./chip-props";

export const TaxonomyChip = ({
  action,
  isConfirmed,
  isExpired,
  onUpdateAction,
}: ActionChipProps & { type: "Category" | "Tag" }) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const isCategory = action.name.includes("Category");
  const isEditable = !isConfirmed && !isExpired;
  const [tagName, setTagName] = useState("");
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isCategory) {
      setTagName(action.args.name);
    }
  }, [isCategory, action.args.name]);

  if (isCategory) {
    const categoryData: Category = {
      name: action.args.name || action.extraInfo?.name,
      color: action.args.hexColor || action.extraInfo?.color || "black",
      icon:
        action.extraInfo?.icon ||
        resolveIcon(action.args.proposedIconConcept) ||
        "folder",
    } as Category;

    return (
      <>
        <Pressable
          onPress={() => isEditable && setIsEditorOpen(true)}
          style={({ pressed }) => ({
            opacity: pressed && isEditable ? 0.7 : 1,
          })}
        >
          <CategoryBadge category={categoryData} size="big" />
        </Pressable>
        {action.args.fallbackCategoryId &&
          action.extraInfo?.fallbackCategory && (
            <>
              <Ionicons
                name="arrow-redo-circle-outline"
                size={30}
                style={{ marginHorizontal: 5 }}
                color={"black"}
              />
              <CategoryBadge
                category={action.extraInfo.fallbackCategory}
                size="big"
              />
            </>
          )}
        {isEditorOpen && isEditorOpen && (
          <CategoryCreator
            isCreating={true}
            onClose={() => setIsEditorOpen(false)}
            editingCategory={categoryData}
            // Bypasses DB save, lifts state back to chat-screen
            onCreateCategory={async (name, color, icon) => {
              onUpdateAction({
                ...action.args,
                name,
                hexColor: color,
                proposedIconConcept: icon,
              });
              setIsEditorOpen(false);
            }}
          />
        )}
      </>
    );
  }

  // Tag Rendering
  return (
    <>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {action.args.names ? (
          action.args.names.map((name: string, index: number) => (
            <Pressable
              key={index}
              onPress={() => {
                if (isEditable) {
                  setTagName(name); // Load current name into the modal's state
                  setEditingTagIndex(index); // 2. ADDED: Save the pointer!
                  setIsEditorOpen(true);
                }
              }}
            >
              <TagBadge tagName={name} holeColor={"white"} mode="big" />
            </Pressable>
          ))
        ) : (
          <TagBadge tagId={action.args.id} holeColor={"white"} mode="big" />
        )}
      </View>
      {isEditorOpen && isEditorOpen && (
        <TagsEditModal
          tagToEdit="true"
          editNameValue={tagName}
          setEditNameValue={setTagName}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingTagIndex(null); // Clean up pointer
          }}
          onSave={() => {
            if (action.args.names && editingTagIndex !== null) {
              // 3. ADDED: Array Mutator Logic
              // Shallow copy the array to respect immutability
              const updatedNames = [...action.args.names];

              // Replace the specific tag at the tracked index
              updatedNames[editingTagIndex] = tagName;

              // Push the ENTIRE array back up to the chat screen
              onUpdateAction({
                ...action.args,
                names: updatedNames,
              });
            } else {
              // Fallback for single tag actions
              onUpdateAction({
                ...action.args,
                names: [tagName],
              });
            }

            setIsEditorOpen(false);
            setEditingTagIndex(null);
          }}
        />
      )}
    </>
  );
};
