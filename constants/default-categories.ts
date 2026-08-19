import { CategoryInsert } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export const DEFAULT_CATEGORIES: CategoryInsert[] = [
    { id: "00000000-0000-0000-0000-000000000001", name: 'Work', color: '#4CAF50', icon: 'briefcase', count: 0 },
    { id: "00000000-0000-0000-0000-000000000002", name: 'Personal', color: '#2196F3', icon: 'person', count: 0 },
    { id: "00000000-0000-0000-0000-000000000003", name: 'Health & Fitness', color: '#F44336', icon: 'fitness', count: 0 },
    { id: "00000000-0000-0000-0000-000000000004", name: 'Finance', color: '#FFC107', icon: 'logo-usd', count: 0 },
    { id: "00000000-0000-0000-0000-000000000005", name: 'Learning', color: '#9C27B0', icon: 'school', count: 0 },
    { id: "00000000-0000-0000-0000-000000000006", name: 'Household', color: '#795548', icon: 'home', count: 0 },
    { id: "00000000-0000-0000-0000-000000000007", name: 'Social', color: '#E91E63', icon: 'people', count: 0 },
    { id: "00000000-0000-0000-0000-000000000008", name: 'Errands', color: '#FF9800', icon: 'car', count: 0 },
];