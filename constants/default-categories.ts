import { CategoryInsert } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export const DEFAULT_CATEGORIES: CategoryInsert[] = [
    { id: randomUUID(), name: 'Work', color: '#4CAF50', icon: 'briefcase', count: 0 },
    { id: randomUUID(), name: 'Personal', color: '#2196F3', icon: 'person', count: 0 },
    { id: randomUUID(), name: 'Health & Fitness', color: '#F44336', icon: 'fitness', count: 0 },
    { id: randomUUID(), name: 'Finance', color: '#FFC107', icon: 'logo-usd', count: 0 },
    { id: randomUUID(), name: 'Learning', color: '#9C27B0', icon: 'school', count: 0 },
    { id: randomUUID(), name: 'Household', color: '#795548', icon: 'home', count: 0 },
    { id: randomUUID(), name: 'Social', color: '#E91E63', icon: 'people', count: 0 },
    { id: randomUUID(), name: 'Errands', color: '#FF9800', icon: 'car', count: 0 },
];