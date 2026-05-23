import React from "react";
import { CategorySelector } from "./categories/category-selector";
import { TagInput } from "./tags/tag-input";

interface agsAndCategorySectionProps {
  editor: any; // The return object from useItemMetadata
  itemType: "task" | "habit" | "event" | "log";
  updateField?: (field: string, value: any) => void;
}

export const TagsAndCategorySection = ({
  editor,
  itemType,
  updateField,
}: agsAndCategorySectionProps) => {
  const { state, actions } = editor;

  return (
    <>
      <CategorySelector
        itemType={itemType}
        categoriesDb={state.categoriesDb}
        sessionCategories={state.sessionCatIds}
        selectedCategory={state.category}
        onSelectCategory={(catId) => {
          actions.setCategory(catId);
          // Assuming CategorySelector already calls updateField internally,
          // but if not, we do it here:
          if (updateField) updateField("category", catId);
        }}
        onCreateCategory={actions.handleCreateCategory}
        onDeleteCategory={actions.handleDeleteCategory}
        updateField={updateField}
      />

      <TagInput
        itemType={itemType}
        currentTags={state.tagNames}
        userTagsDb={state.userTagsDb}
        onAddTag={actions.addTag}
        onRemoveTag={actions.removeTag}
      />
    </>
  );
};
