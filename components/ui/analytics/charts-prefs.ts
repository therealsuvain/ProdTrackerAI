import { createMMKV } from 'react-native-mmkv';
import { useState, useCallback } from 'react';
import { DEFAULT_LAYOUT } from './charts-registry'

const storage = createMMKV();
const LAYOUT_KEY = 'analytics_dashboard_layout';

export const useDashboardLayout = ()=> {
  // Synchronous initial read prevents layout shift
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => {
    const saved = storage.getString(LAYOUT_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });

 const persist = useCallback((next: string[]) => {
    storage.set(LAYOUT_KEY, JSON.stringify(next));
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setActiveWidgets((prev) => {
      const isCurrentlyActive = prev.includes(widgetId);
      const newLayout = isCurrentlyActive 
        ? prev.filter(id => id !== widgetId) 
        : [...prev, widgetId];
      
      storage.set(LAYOUT_KEY, JSON.stringify(newLayout));
      return newLayout;
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: string[]) => {
    setActiveWidgets(newOrder);
    persist(newOrder);
  }, [persist]);


  return { activeWidgets, toggleWidget, reorderWidgets };
};