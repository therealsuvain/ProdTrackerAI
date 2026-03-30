export const withAlpha = (hex: string, alpha: string): string =>
  `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

export const getTodayISO = () => new Date().toISOString().split("T")[0];
export const getNowISO = () => new Date().toISOString();
export const getTodayStartISO = () => { 
  const today = new Date(); 
  today.setHours(0, 0, 0, 0); 
  return today.toISOString(); 
};

export const getWeekStartISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d.toISOString().split("T")[0];
};