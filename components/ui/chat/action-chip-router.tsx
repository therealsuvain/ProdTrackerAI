import React from "react";
import { ChipContainer } from "./action-chips/chip-container";
import { TaxonomyChip } from "./action-chips/taxonomy-chip";
import { ItemChip } from "./action-chips/item-chip";
import { ActionChipProps } from "./action-chips/chip-props";

const getActionIcon = (name: string) => {
  if (name.includes("add")) return "add-circle-outline";
  if (name.includes("delete")) return "trash-outline";
  return "pencil";
};

const getActionItemType = (name: string) => {
  if (name.includes("Category")) return "Category";
  if (name.includes("Tag")) return "Tag";
  return "Entity"; // Task, Habit, Event, Log
};

export const ActionChip = (props: ActionChipProps) => {
  const type = getActionItemType(props.action.name);
  const icon = getActionIcon(props.action.name);

  return (
    <ChipContainer
      color={props.action.color}
      iconName={icon as any}
      onRemove={props.onRemove}
      isConfirmed={props.isConfirmed}
      isExpired={props.isExpired}
    >
      {type === "Entity" ? (
        <ItemChip {...props} />
      ) : (
        <TaxonomyChip {...props} type={type as "Category" | "Tag"} />
      )}
    </ChipContainer>
  );
};
