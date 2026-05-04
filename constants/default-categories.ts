import { CategoryInsert } from '@/db/schema';
import { randomUUID } from 'expo-crypto';

export const DEFAULT_CATEGORIES: CategoryInsert[] = [
    { id: randomUUID(), name: 'Work', color: '#3b82f6', count: 0 },
    { id: randomUUID(), name: 'Personal', color: '#10b981', count: 0 },
    { id: randomUUID(), name: 'Health', color: '#ef4444', count: 0 },
    { id: randomUUID(), name: 'Finance', color: '#f59e0b', count: 0 },
    { id: randomUUID(), name: 'Education', color: '#8b5cf6', count: 0 },
];