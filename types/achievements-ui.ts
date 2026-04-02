import { AchievementTier } from '@/types/achievements';
import { MetricKey } from '@/types/metrics';

export interface AchievementDefinition {
    id: string;
    title: string;
    description: string;
    unlockedDescription: string;
    tier: AchievementTier;
    target: number;
    metricTrigger: MetricKey | 'meta';
}

// Strictly defining our scalable milestone logic
export const TASK_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'tasks_1',
        title: 'DUMMY TASK 1 (TO BE REMOVED)',
        description: 'DUM DUM TASK ONCE.',
        unlockedDescription: 'One small step for man, one giant leap for mankind.',
        tier: 'bronze',
        target: 1,
        metricTrigger: 'tasksCompleted'
    },
    {
        id: 'tasks_10',
        title: 'The First Step',
        description: 'Complete your first 10 tasks.',
        unlockedDescription: 'One small step for man, one giant leap for mankind.',
        tier: 'bronze',
        target: 10,
        metricTrigger: 'tasksCompleted'
    },
    {
        id: 'tasks_100',
        title: 'Task Slayer',
        description: 'Complete 100 tasks.',
        unlockedDescription: 'Rip and tear\'em until it is done',
        tier: 'silver',
        target: 100,
        metricTrigger: 'tasksCompleted'
    },
    {
        id: 'tasks_250',
        title: 'TaskMaster',
        description: 'Complete 1,000 tasks.',
        unlockedDescription: 'You\'ve gathered serious momentum.',
        tier: 'gold',
        target: 250,
        metricTrigger: 'tasksCompleted'
    },
    {
        id: 'tasks_500',
        title: 'The Chosen One',
        description: 'Complete 2,000 tasks.',
        unlockedDescription: 'The first one, the real one',
        tier: 'platinum',
        target: 500,
        metricTrigger: 'tasksCompleted'
    },
    {
        id: 'tasks_1000',
        title: 'The One Above All',
        description: 'Complete 1,000 tasks.',
        unlockedDescription: 'All that is, was, and ever will be.',
        tier: 'diamond',
        target: 1000,
        metricTrigger: 'tasksCompleted'

    },
];

export const HABIT_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'habits_1',
        title: 'DUMMY HABIT 1 (REMOVE LATER)',
        description: 'DUM YOUR CEHCKO ONCE',
        unlockedDescription: 'The routine begins. Every legend starts with a few reps.',
        tier: 'bronze',
        target: 1,
        metricTrigger: 'habitsCheckedIn'
    }, {
        id: 'habits_2',
        title: 'DUMMY HABIT 2 (REMOVE LATER)',
        description: 'DUM GOALS ONCE',
        unlockedDescription: 'The routine begins. Every legend starts with a few reps.',
        tier: 'bronze',
        target: 1,
        metricTrigger: 'habitsGoalsCompleted'
    }, {
        id: 'habits_10',
        title: 'Wax On, Wax Off',
        description: 'Check-in your habits 10 times.',
        unlockedDescription: 'The routine begins. Every legend starts with a few reps.',
        tier: 'bronze',
        target: 10,
        metricTrigger: 'habitsCheckedIn'
    },
    {
        id: 'habits_100',
        title: 'Training Montage',
        description: 'Check-in your habits 100 times.',
        unlockedDescription: 'Day after day, you keep showing up. Cue the montage music.\n',
        tier: 'silver',
        target: 100,
        metricTrigger: 'habitsCheckedIn'
    },
    {
        id: 'habits_250',
        title: 'The Daily Grind',
        description: 'Check-in your habits 250 times.',
        unlockedDescription: 'Discipline beats motivation. You\'re building something real',
        tier: 'gold',
        target: 250,
        metricTrigger: 'habitsCheckedIn'
    },
    {
        id: 'habits_500',
        title: 'Creature of Habit',
        description: 'Check-in your habits 500 times.',
        unlockedDescription: 'Consistency is now second nature. The system runs itself.',
        tier: 'platinum',
        target: 500,
        metricTrigger: 'habitsCheckedIn'
    },
    {
        id: 'habits_1000',
        title: 'Ultra Instinct',
        description: 'Check-in your habits 1,000 times.',
        unlockedDescription: 'Your routines run on autopilot. Discipline has become instinct.',
        tier: 'diamond',
        target: 1000,
        metricTrigger: 'habitsCheckedIn'
    },
    {
        id: 'habits_freezes_5',
        title: 'Time Out',
        description: 'Use 5 habit streak freeze.',
        unlockedDescription: 'Even heroes take a breather.',
        tier: 'bronze',
        target: 5,
        metricTrigger: 'habitsFrozen'
    },
    {
        id: 'habits_freezes_10',
        title: 'Dormammu, I\'ve Come to Bargain',
        description: 'Use 10 habit streak freezes.',
        unlockedDescription: 'Sometimes the only winning move is looping time.',
        tier: 'silver',
        target: 10,
        metricTrigger: 'habitsFrozen'
    },
    {
        id: 'habits_freezes_25',
        title: 'ZA WARUDO',
        description: 'Use 25 habit streak freezes.',
        unlockedDescription: 'Time itself pauses at your command.',
        tier: 'gold',
        target: 25,
        metricTrigger: 'habitsFrozen'
    },
    {
        id: 'habits_freezes_50',
        title: 'Plot Armor',
        description: 'Use 50 habit streak freezes.',
        unlockedDescription: 'Somehow… the streak survives.',
        tier: 'platinum',
        target: 50,
        metricTrigger: 'habitsFrozen'
    },
    {
        id: 'habits_freezes_100',
        title: 'Master of Time',
        description: 'Use 100 habit streak freezes.',
        unlockedDescription: 'Deadlines, destiny, and time itself bend to your will.',
        tier: 'diamond',
        target: 100,
        metricTrigger: 'habitsFrozen'
    }
];

export const TIMER_ACHIEVEMENTS: AchievementDefinition[] = [{
    id: 'timer_60',
    title: 'Entering the Flow',
    description: 'Record 60 minutes of focus time.',
    unlockedDescription: 'The world fades out. The work begins.',
    tier: 'bronze',
    target: 3600,
    metricTrigger: 'timeTracked'
},
{
    id: 'timer_600',
    title: 'This Is the Way',
    description: 'Record 600 minutes of focus time.',
    unlockedDescription: 'Focus. Discipline. No distractions. This is the way.',
    tier: 'silver',
    target: 36000,
    metricTrigger: 'timeTracked'
},
{
    id: 'timer_1440',
    title: 'Doctor Strange',
    description: 'Record 1 full day of focus time.',
    unlockedDescription: 'You\'ve bent time to your will. The clock obeys',
    tier: 'gold',
    target: 86400,
    metricTrigger: 'timeTracked'
},
{
    id: 'timer_3000',
    title: 'Hyperbolic Time Chamber',
    description: 'Record 3 full days of focus time.',
    unlockedDescription: 'Hours feel like minutes. Minutes feel like seconds.',
    tier: 'platinum',
    target: 259200,
    metricTrigger: 'timeTracked'
},
{
    id: 'timer_6000',
    title: 'Enlightenment Achieved',
    description: 'Record 1 full week of focus time.',
    unlockedDescription: 'You and the clock are now one.',
    tier: 'diamond',
    target: 604800,
    metricTrigger: 'timeTracked'
},]

export const ACHIEVEMENTS_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'achievements_1',
        title: 'DUMMY ACHIEVMETN 1 (TO BE REMOVED)',
        description: 'Complete 1 achievement.',
        unlockedDescription: 'DUMACHIEVE',
        tier: 'bronze',
        target: 1,
        metricTrigger: 'meta'
    },

    {
        id: 'achievements_5',
        title: 'Achievement Unlocked',
        description: 'Complete 5 achievements.',
        unlockedDescription: 'The first few trophies on the shelf. Many more await.',
        tier: 'bronze',
        target: 5,
        metricTrigger: 'meta'
    },
    {
        id: 'achievements_10',
        title: 'Completionist',
        description: 'Complete 10 achievements.',
        unlockedDescription: 'You\'re not just playing the game. You\'re finishing it.',
        tier: 'silver',
        target: 10,
        metricTrigger: 'meta'
    },
    {
        id: 'achievements_25',
        title: 'Gotta Catch \'Em All',
        description: 'Complete 25 achievements.',
        unlockedDescription: 'Collecting achievements like they\'re Pokémon.',
        tier: 'gold',
        target: 25,
        metricTrigger: 'meta'
    },
    {
        id: 'achievements_50',
        title: 'The Collector',
        description: 'Complete 30 achievements.',
        unlockedDescription: 'Your trophy case is starting to look ridiculous.',
        tier: 'platinum',
        target: 50,
        metricTrigger: 'meta'
    },
    {
        id: 'achievements_all',
        title: '100% Sync',
        description: 'Complete all achievements.',
        unlockedDescription: 'Every challenge conquered. Every achievement claimed.',
        tier: 'diamond',
        target: 100,
        metricTrigger: 'meta'
    },];

export const CHAT_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'chat_messages_50',
        title: 'Hello, Computer',
        description: 'Send 50 messages to the AI.',
        unlockedDescription: 'The conversation begins.',
        tier: 'bronze',
        target: 50,
        metricTrigger: 'chatMessagesSent'
    },
    {
        id: 'chat_messages_250',
        title: 'Talk to Me',
        description: 'Send 250 messages to the AI.',
        unlockedDescription: 'You and the machine are starting to understand each other.',
        tier: 'silver',
        target: 250,
        metricTrigger: 'chatMessagesSent'
    },
    {
        id: 'chat_messages_500',
        title: 'Human-AI Interface',
        description: 'Send 500 messages to the AI.',
        unlockedDescription: 'The line between thought and prompt grows thinner.',
        tier: 'gold',
        target: 500,
        metricTrigger: 'chatMessagesSent'
    },
    {
        id: 'chat_messages_1000',
        title: 'The Prompt Whisperer',
        description: 'Send 1,000 messages to the AI.',
        unlockedDescription: 'You speak fluent prompt.',
        tier: 'platinum',
        target: 1000,
        metricTrigger: 'chatMessagesSent'
    },
    {
        id: 'chat_messages_2500',
        title: 'Operator',
        description: 'Send 2,500 messages to the AI.',
        unlockedDescription: 'You and the AI now run the show together.',
        tier: 'diamond',
        target: 2500,
        metricTrigger: 'chatMessagesSent'
    },
    {
        id: 'chat_functions_10',
        title: 'Make It So',
        description: 'Have the AI perform 10 actions for you.',
        unlockedDescription: 'Your first commands are executed.',
        tier: 'bronze',
        target: 10,
        metricTrigger: 'chatActionsConfirmed'
    },
    {
        id: 'chat_functions_25',
        title: 'Delegation Protocol',
        description: 'Have the AI perform 25 actions for you.',
        unlockedDescription: 'Why do it yourself when the AI can handle it?',
        tier: 'silver',
        target: 25,
        metricTrigger: 'chatActionsConfirmed'
    },
    {
        id: 'chat_functions_50',
        title: 'Jarvis',
        description: 'Have the AI perform 50 actions for you.',
        unlockedDescription: 'Your digital assistant is fully operational.',
        tier: 'gold',
        target: 50,
        metricTrigger: 'chatActionsConfirmed'
    },
    {
        id: 'chat_functions_100',
        title: 'Command Console',
        description: 'Have the AI perform 100 actions for you.',
        unlockedDescription: 'You issue commands. The system obeys.',
        tier: 'platinum',
        target: 100,
        metricTrigger: 'chatActionsConfirmed'
    },
    {
        id: 'chat_functions_250',
        title: 'The Architect',
        description: 'Have the AI perform 250 actions for you.',
        unlockedDescription: 'You shape the system with a few words.',
        tier: 'diamond',
        target: 250,
        metricTrigger: 'chatActionsConfirmed'
    }
];

export const HIDDEN_ACHIEVEMENTS: AchievementDefinition[] = [
    {
        id: 'hidden_1',
        title: 'Insomniac',
        description: 'Log activity between 2 AM and 4 AM.',
        unlockedDescription: 'Sleep is optional. Productivity is eternal.',
        tier: 'gold',
        target: 1,
        metricTrigger: 'meta'

    },
    {
        id: 'hidden_2',
        title: 'Speedrunner',
        description: 'Complete a task within 10 seconds of creating it.',
        unlockedDescription: 'Any% productivity run.',
        tier: 'silver',
        target: 1,
        metricTrigger: 'meta'
    },
    {
        id: 'hidden_3',
        title: 'Procrastinator',
        description: 'Reschedule the same task 5 times.',
        unlockedDescription: 'Future you will definitely handle it.',
        tier: 'bronze',
        target: 1,
        metricTrigger: 'meta'
    },
    {
        id: 'hidden_4',
        title: 'Touch Grass',
        description: 'Go 24 hours without opening the app.',
        unlockedDescription: 'Productivity also means taking a break.',
        tier: 'silver',
        target: 1,
        metricTrigger: 'meta'
    },
    {
        id: 'hidden_5',
        title: 'Main Character Energy',
        description: 'Complete 10 tasks in a single day.',
        unlockedDescription: 'Cue the montage music.',
        tier: 'gold',
        target: 10,
        metricTrigger: 'meta'
    },
    {
        id: 'hidden_6',
        title: 'Groundhog Day',
        description: 'Check in the same habit 30 times.',
        unlockedDescription: 'Every day feels strangely familiar.',
        tier: 'gold',
        target: 30,
        metricTrigger: 'meta'
    },
    {
        id: 'hidden_7',
        title: 'The Deep Work',
        description: 'Run a focus timer longer than 3 hours.',
        unlockedDescription: 'The outside world no longer exists.',
        tier: 'gold',
        target: 1,
        metricTrigger: 'meta'
    }
];
export const ALL_ACHIEVEMENTS = [
    ...TASK_ACHIEVEMENTS,
    ...HABIT_ACHIEVEMENTS,
    ...TIMER_ACHIEVEMENTS,
    ...CHAT_ACHIEVEMENTS,
    ...HIDDEN_ACHIEVEMENTS,
    ...ACHIEVEMENTS_ACHIEVEMENTS
];