import { useState, useEffect, useRef } from "react";
import { randomUUID } from "expo-crypto";
import { useData } from "@/hooks/use-data"; // Adjust path as needed

interface UseTagsAndCategoriesProps {
  visible: boolean;
  initialTags?: string[];
  initialCategory?: string | null;
  updateField?: (field: string, value: any) => void;
}

export function useTagsAndCategories({ visible, initialTags, initialCategory, updateField }: UseTagsAndCategoriesProps) {
  const {
    tags,
    addTags,
    categories,
    addCategory,
    incrementCategoryUsage,
    deleteUserCategory,
  } = useData();

  // Local State
  const [category, setCategory] = useState<string | null>(null);
  const [sessionCatIds, setSessionCatIds] = useState<Set<string>>(new Set<string>());
  const [tagNames, setTagNames] = useState<string[]>([]);

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
    await addCategory({ id, name, color, icon });
    setSessionCatIds((prev) => new Set(prev).add(id));
    setCategory(id);
    if(updateField)
    {updateField("category", id);} // Sync parent form
  };

  const handleDeleteCategory = async (draftId: string) => {
    setSessionCatIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(draftId);
      return newSet;
    });
    if (category === draftId) {
      setCategory(null);
      if(updateField)
      {updateField("category", null)};
    }
    await deleteUserCategory(draftId);
  };

  // The Master Save Function (Diffing Logic)
  const processMetadataOnSave = async (currentFormCategory: string | null): Promise<string[]> => {
    let finalIds: string[] = [];

    if (originalTagIdsRef.current && originalTagIdsRef.current.length > 0) {
      const originalNames = originalTagIdsRef.current
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[];

      const newNames = tagNames.filter((name) => !originalNames.includes(name));
      const existingNames = tagNames.filter((name) => originalNames.includes(name));

      const existingIds = existingNames
        .map((name) => tags.find((t) => t.name === name)?.id)
        .filter(Boolean) as string[];

      const newIds = newNames.length > 0 ? await addTags(newNames.map(name => ({ id: randomUUID(), name }))) : [];
      finalIds = [...existingIds, ...newIds];
    } else {
      finalIds = tagNames.length > 0 
        ? await addTags(tagNames.map(name => ({ id: randomUUID(), name }))) 
        : [];
    }

    if (currentFormCategory !== originalCategoryRef.current && currentFormCategory) {
      await incrementCategoryUsage(currentFormCategory);
    }

    return finalIds;
  };

  return {
    state: { category, sessionCatIds, tagNames, categoriesDb: categories, userTagsDb: tags },
    actions: { addTag, removeTag, handleCreateCategory, handleDeleteCategory, setCategory },
    processMetadataOnSave,
  };
}