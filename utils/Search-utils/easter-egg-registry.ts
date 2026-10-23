import type {
    GlobalSearchEasterEggDefinition,
} from "@/types/global-search";

const easterEggs = [
    {
        id: "rickroll",
        triggers: ["rickroll me"],
        title: "Rickroll",
        subtitle: "A classic internet surprise",
        activation: {
            kind: "externalUrl",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
    },
    {
        id: "launch_sequence",
        triggers: ["launch sequence", "nuke my backlog"],
        title: "Launch Sequence",
        subtitle: "Prepare for liftoff",
        activation: {
            kind: "animation",
            effect: "launchSequence",
        },
    },
    {
        id: "answer_42",
        triggers: ["42", "the answer"],
        title: "The Answer",
        subtitle: "The answer to life, the universe, and everything",
        activation: {
            kind: "animation",
            effect: "answer42",
        },
    },
    {
        id: "hello_there",
        triggers: ["hello there"],
        title: "Hello There",
        subtitle: "A little salute",
        activation: {
            kind: "animation",
            effect: "helloThere",
        },
    },
    {
        id: "abracadabra",
        triggers: ["abracadabra"],
        title: "Magic",
        subtitle: "Now you see it...",
        activation: {
            kind: "animation",
            effect: "abracadabra",
        },
    },
] satisfies readonly GlobalSearchEasterEggDefinition[];

export const GLOBAL_SEARCH_EASTER_EGGS =
    easterEggs satisfies readonly GlobalSearchEasterEggDefinition[];

export const GLOBAL_SEARCH_EASTER_EGGS_BY_ID: ReadonlyMap<
    string,
    GlobalSearchEasterEggDefinition
> = new Map(
    GLOBAL_SEARCH_EASTER_EGGS.map((egg) => [egg.id, egg]),
);