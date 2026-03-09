import { AchievementTier } from '../types/achievements';

export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    tier: AchievementTier;
    target: number;
}

// Strictly defining our scalable milestone logic
export const TASK_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'tasks_10',
        title: 'Getting Started',
        description: 'Complete your first 10 tasks.',
        tier: 'bronze',
        target: 10
    },
    {
        id: 'tasks_100',
        title: 'Centurion',
        description: 'Complete 100 tasks.',
        tier: 'silver',
        target: 100
    },
    {
        id: 'tasks_250',
        title: 'Master Ticker',
        description: 'Complete 1,000 tasks.',
        tier: 'gold',
        target: 250
    },
    {
        id: 'tasks_500',
        title: 'Task Master',
        description: 'Complete 2,000 tasks.',
        tier: 'platinum',
        target: 500
    },
    {
        id: 'tasks_1000',
        title: 'Task God',
        description: 'Complete 1,000 tasks.',
        tier: 'diamond',
        target: 1000
    },
];

export const HABIT_ACHIEVEMENTS: AchievementDefinition[] = [{
    id: 'habits_10',
    title: 'Getting Shit Done',
    description: 'Check-in your habits 10 times.',
    tier: 'bronze',
    target: 10
},
{
    id: 'habits_100',
    title: 'Disciplinarian',
    description: 'Check-in your habits 100 times.',
    tier: 'silver',
    target: 100
},
{
    id: 'habits_250',
    title: 'Concurrency Master',
    description: 'Check-in your habits 250 times.',
    tier: 'gold',
    target: 250
},
{
    id: 'habits_500',
    title: 'Habit Master',
    description: 'Check-in your habits 500 times.',
    tier: 'platinum',
    target: 500
},
{
    id: 'habits_1000',
    title: 'Habit God',
    description: 'Check-in your habits 1,000 times.',
    tier: 'diamond',
    target: 1000
},];

export const TIMER_ACHIEVEMENTS: AchievementDefinition[] = [{
    id: 'timer_60',
    title: 'Timed up',
    description: 'Record 60 minutes of focus time.',
    tier: 'bronze',
    target: 60
},
{
    id: 'timer_600',
    title: 'Focus Master',
    description: 'Record 600 minutes of focus time.',
    tier: 'silver',
    target: 600
},
{
    id: 'timer_1440',
    title: 'Focus God',
    description: 'Record 1,440 minutes of focus time.',
    tier: 'gold',
    target: 1200
},
{
    id: 'timer_3000',
    title: 'Focus Supreme 0',
    description: 'Record 3,000 minutes of focus time.',
    tier: 'platinum',
    target: 3000
},
{
    id: 'timer_6000',
    title: 'Focus Supreme 2',
    description: 'Record 6,000 minutes of focus time.',
    tier: 'diamond',
    target: 6000
},]

export const ACHIEVEMENTS_ACHIEVEMENTS: AchievementDefinition[] = [

    {
        id: 'achievements_5',
        title: 'Achiever',
        description: 'Complete 5 achievements.',
        tier: 'bronze',
        target: 5
    },
    {
        id: 'achievements_10',
        title: 'Achievement Master',
        description: 'Complete 10 achievements.',
        tier: 'silver',
        target: 10
    },
    {
        id: 'achievements_25',
        title: 'Achievement God',
        description: 'Complete 20 achievements.',
        tier: 'gold',
        target: 25
    },
    {
        id: 'achievements_50',
        title: 'Achievement Supreme 1',
        description: 'Complete 30 achievements.',
        tier: 'platinum',
        target: 50
    },
    {
        id: 'achievements_all',
        title: 'Achievement Supreme 2',
        description: 'Complete all achievements.',
        tier: 'diamond',
        target: 100
    },];

export const ALL_ACHIEVEMENTS = [
  ...TASK_ACHIEVEMENTS,
  ...HABIT_ACHIEVEMENTS,
  ...TIMER_ACHIEVEMENTS,
  ...ACHIEVEMENTS_ACHIEVEMENTS
];