export const pad = (n: number) => n.toString().padStart(2, "0");

export const toTimeStr = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export const getTimerDimensions = (size: number) => {
  const STROKE = size * 0.025;
  const RADIUS = size / 2;
  const CIRCLE_R = (size - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

  return { STROKE, RADIUS, CIRCLE_R, CIRCUMFERENCE };
};