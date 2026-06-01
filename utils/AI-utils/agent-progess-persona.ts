// Helper function to grab a random string from an array
export const getRandomProgressText = (options: string[]) => {
    return options[Math.floor(Math.random() * options.length)];
};

export const AgentPersona = {
    WAKING_UP: [
        "Initiating HyperDrive",
        "Brewing digital coffee",
        "Stretching neural networks",
        "Waking up the agent",
    ],
    PLANNING: [
        "Mapping the multiverse",
        "Drafting the master plan",
        "Connecting the dots",
        "Analyzing complex request",
    ],
    ROUTING: [
        "Choosing weapons",
        "Assembling the toolset",
        "Selecting the right tools",
        "Loading domain expertise",
    ],
    EVALUATING: [
        "Double-checking the math",
        "Checking the checklist",
        "Surveying the results",
        "Evaluating execution",
    ],
    // Specific Tool Actions
    ACTION_TASK: [
        "Forging a new task",
        "Writing it in stone",
        "Adding task to the docket",
    ],
    ACTION_HABIT: [
        "Spraying in Consistency",
        "Wiring new routines",
        "Building good habits",
    ],
    ACTION_CATEGORY: [
        "Organizing the chaos",
        "Painting categories",
        "Filing into folders",
    ],
    ACTION_TAG: [
        "Slapping on tags",
        "Labeling things",
        "Pinning tags",
    ],
    ACTION_SEARCH: [
        "Scouring the database",
        "Hunting for context",
        "Flipping through archives",
    ]
};