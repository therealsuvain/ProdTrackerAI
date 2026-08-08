export function getTickCount(
  variant: "grid" | "detail" | undefined,
  dataLength: number,
): number {
  const isDetail = variant === "detail";
  const target = isDetail ? 6 : 3;
  const min = isDetail ? 4 : 2;
  const max = isDetail ? 8 : 4;
  // Never request more ticks than there are actual data points to label.
  return Math.max(min, Math.min(max, Math.min(target, dataLength)));
}