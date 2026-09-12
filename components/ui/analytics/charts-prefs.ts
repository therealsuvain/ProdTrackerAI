import { useState, useCallback } from 'react';
import { DEFAULT_LAYOUT } from './charts-registry'
import storageMMKV from '@/utils/Storage-Utils/mmkv-instance'
import { STORAGE_KEYS } from '@/utils/Storage-Utils/storage-keys'


export const useDashboardLayout = ()=> {
  // Synchronous initial read prevents layout shift
  const [activeWidgets, setActiveWidgets] = useState<string[]>(() => {
    const saved = storageMMKV.getString(STORAGE_KEYS.CHART_LAYOUT);
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });

 const persist = useCallback((next: string[]) => {
    storageMMKV.set(STORAGE_KEYS.CHART_LAYOUT, JSON.stringify(next));
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setActiveWidgets((prev) => {
      const isCurrentlyActive = prev.includes(widgetId);
      const newLayout = isCurrentlyActive 
        ? prev.filter(id => id !== widgetId) 
        : [...prev, widgetId];
      
      storageMMKV.set(STORAGE_KEYS.CHART_LAYOUT, JSON.stringify(newLayout));
      return newLayout;
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: string[]) => {
    setActiveWidgets(newOrder);
    persist(newOrder);
  }, [persist]);

 const resetLayout = useCallback(() => {
   setActiveWidgets(DEFAULT_LAYOUT);
   persist(DEFAULT_LAYOUT);
 }, [persist])

  return { activeWidgets, toggleWidget, reorderWidgets, resetLayout };
};