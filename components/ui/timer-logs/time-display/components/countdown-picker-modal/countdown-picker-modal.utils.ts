export const getPickerDimensions = (Size:number) => {
    const ITEM_HEIGHT = Size;
    const VISIBLE_ROWS = 3;
    const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
    const SCROLL_PAD = ITEM_HEIGHT;

    const HOURS = Array.from({ length: 24 }, (_, i) => i);
    const MINUTES = Array.from({ length: 60 }, (_, i) => i);
    const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

    return { ITEM_HEIGHT, PICKER_HEIGHT, SCROLL_PAD, HOURS, MINUTES, SECONDS_LIST };
}