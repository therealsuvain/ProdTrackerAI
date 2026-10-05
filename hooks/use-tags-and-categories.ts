import { useState, useEffect, useRef } from "react";
import { randomUUID } from "expo-crypto";
import { addCategoryWithEffects, deleteCategoryWithEffects, incrementCategoryUsageWithEffects } from "@/utils/Data-services/taxonomy-services/category-actions";
import { selectTagList, useTagStore } from "@/stores/use-tag-store";
import { useShallow } from "zustand/shallow";
import { addTagsWithEffects } from "@/utils/Data-services/taxonomy-services/tag-actions";
import { selectCategoryList, useCategoryStore } from "@/stores/use-category-store";
import { or } from "drizzle-orm";

interface UseTagsAndCategoriesProps {
  visible: boolean;
  initialTags?: string[];
  initialCategory?: string | null;
  updateField?: (field: string, value: any) => void;
}

//TODO check if categories and tags full arrays needed to passed from here to minor components, or if minor components itself can just sub to these directly , will this improve performance in any way
export function useTagsAndCategories({ visible, initialTags, initialCategory, updateField }: UseTagsAndCategoriesProps) {

  // Local State
  const [category, setCategory] = useState<string | null>(null);
  const [sessionCatIds, setSessionCatIds] = useState<Set<string>>(new Set<string>());
  const [tagNames, setTagNames] = useState<string[]>([]);
  const tags = useTagStore(useShallow(selectTagList));
  const categories = useCategoryStore(useShallow(selectCategoryList));
  // Refs for Diffing
  const originalTagIdsRef = useRef<string[]>([]);
  const originalCategoryRef = useRef<string | null>(null);

  // Synchronization Effect
  useEffect(() => {
    if (visible) {
      originalTagIdsRef.current = initialTags ?? [];
      originalCategoryRef.current = initialCategory ?? null;

      if (initialTags && initialTags.length > 0) {
        const names = initialTags
          .map((id) => tags.find((t) => t.id === id)?.name)
          .filter(Boolean) as string[];
        setTagNames(names);
      } else {
        setTagNames([]);
      }
      setCategory(initialCategory ?? null);
    } else {
      // Cleanup
      originalTagIdsRef.current = [];
      setTagNames([]);
      setCategory(null);
    }
  }, [visible, initialTags, initialCategory]); // DO NOT add 'tags' here, it will trigger unnecessary re-renders

  // Actions
  const addTag = (tag: string) => setTagNames((prev) => [...prev, tag]);
  const removeTag = (tag: string) => setTagNames((prev) => prev.filter((t) => t !== tag));

  const handleCreateCategory = async (name: string, color: string, icon: string) => {
    const id = randomUUID();
    await addCategoryWithEffects({ id, name, color, icon });
    setSessionCatIds((prev) => new Set(prev).add(id));
    setCategory(id);
    if (updateField) { updateField("category", id); } // Sync parent form
  };

  const handleDeleteCategory = async (draftId: string) => {
    setSessionCatIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(draftId);
      return newSet;
    });
    if (category === draftId) {
      setCategory(null);
      if (updateField) { updateField("category", null) };
    }
    await deleteCategoryWithEffects(draftId, null, "user", "undo");
  };
  // console.log(tagNames)
  // The Master Save Function (Diffing Logic)
  const processMetadataOnSave = async (currentFormCategory: string | null): Promise<string[]> => {
    let finalIds: string[] = [];

    if (originalTagIdsRef.current && originalTagIdsRef.current.length > 0) {
      const originalNames = originalTagIdsRef.current
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[];

      const newNames = tagNames.filter((name) => !originalNames.includes(name));
      const existingNames = tagNames.filter((name) => originalNames.includes(name));
      console.log("newNames", newNames, "existingNames", existingNames, "eoGNames", originalNames);
      const existingIds = existingNames
        .map((name) => tags.find((t) => t.name === name)?.id)
        .filter(Boolean) as string[];

      const newIds = newNames.length > 0 ? await addTagsWithEffects(newNames.map(name => ({ id: randomUUID(), name }))) : [];
      finalIds = [...existingIds, ...newIds];
    } else {
      finalIds = tagNames.length > 0
        ? await addTagsWithEffects(tagNames.map(name => ({ id: randomUUID(), name })))
        : [];
    }

    if (currentFormCategory !== originalCategoryRef.current && currentFormCategory) {
      await incrementCategoryUsageWithEffects(currentFormCategory);
    }

    return finalIds;
  };

  return {
    state: { category, sessionCatIds, tagNames, categoriesDb: categories, userTagsDb: tags },
    actions: { addTag, removeTag, handleCreateCategory, handleDeleteCategory, setCategory },
    processMetadataOnSave,
  };
}