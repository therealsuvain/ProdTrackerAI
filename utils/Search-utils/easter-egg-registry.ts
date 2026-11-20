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
    {
        id: "lightning_strike",
        triggers: ["lighting strike", "zap me", "electrify me", "shock me", "lightning bolt", "thunderbolt"],
        title: "Lightning Strike",
        subtitle: "A powerful electrical display",
        activation: {
            kind: "animation",
            effect: "lightningStrike",
        },
    },
    {
        id: "space_invaders",
        triggers: ["space invaders", "invade space", "alien invasion", "defend earth", "shoot aliens"],
        title: "Space Invaders",
        subtitle: "Defend Earth from alien invaders",
        activation: {
            kind: "animation",
            effect: "spaceInvaders",
        },
    },
    {
        id: "pacman",
        triggers: ["pacman", "eat dots", "chomp chomp", "ghosts"],
        title: "Pac-Man",
        subtitle: "Classic arcade fun",
        activation: {
            kind: "animation",
            effect: "pacman",
        },
    },
    {
        id: "snake",
        triggers: ["snake", "slither", "eat apples", "grow longer"],
        title: "Snake Game",
        subtitle: "Classic arcade fun",
        activation: {
            kind: "animation",
            effect: "snake",
        },
    },
    {
        id: "copy_paste",
        triggers: ["copy machine", "copy paste"],
        title: "The Copy Machine",
        subtitle: "One copy is never enough",
        activation: {
            kind: "animation",
            effect: "copyPaste",
        },
    },
    {
        id: "breaking_point",
        triggers: ["crack it", "breaking point"],
        title: "Breaking Point",
        subtitle: "Crack your screen",
        activation: {
            kind: "animation",
            effect: "breakingPoint",
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