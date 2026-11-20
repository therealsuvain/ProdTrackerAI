import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Keyboard,
  SectionList,
  StyleSheet,
  TextInput,
  View,
  Text,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Button, IconButton, Searchbar } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ThemeContext } from "@/context/ThemeContext";
import { withAlpha } from "@/utils/common-utils";
import { SearchResult } from "@/utils/search-utils";
import { SearchResultRow } from "@/components/ui/global-search/search-result-row";
import {
  selectCategoryList,
  useCategoryStore,
} from "@/stores/use-category-store";
import { selectTagList, useTagStore } from "@/stores/use-tag-store";
import { useShallow } from "zustand/shallow";
import { GlobalSearchFilterModal } from "./global-search-filter-modal";
import { useGlobalSearchController } from "@/hooks/use-global-search-controller";
import type {
  GlobalSearchSelectionRequest,
  GlobalSearchTarget,
  GlobalSearchFilterKind,
  GlobalSearchKind,
  GlobalSearchResult,
} from "@/types/global-search";

import { GlobalSearchConveniencePanel } from "@/components/ui/global-search/global-search-convenience-panel";
import { GlobalSearchSavedScopesModal } from "@/components/ui/global-search/global-search-saved-scopes-modal";
import { GlobalSearchShortcutsModal } from "@/components/ui/global-search/global-search-shortcuts-modal";
import type {
  RecentGlobalSearchItem,
  SavedGlobalSearchScope,
} from "@/types/global-search-convenience";
import { Alert, Linking } from "react-native";

import { GlobalSearchEasterEggRow } from "@/components/ui/global-search/search-result-row-easter-egg";
import { matchGlobalSearchEasterEggs } from "@/utils/Search-utils/easter-egg-matcher";
import { GLOBAL_SEARCH_EASTER_EGGS_BY_ID } from "@/utils/Search-utils/easter-egg-registry";
import { recordGlobalSearchEasterEggDiscovery } from "@/utils/Search-utils/easter-egg-discovery";

import { createGlobalSearchSelectionRequest } from "@/utils/Search-utils/selection-dispatcher";
import { CategoryBadge } from "../shared/categories/category-badge";
import { TagBadge } from "../shared/tags/tag-badge";
import { useHelloThereEasterEggAnimation } from "@/hooks/animations/easter-eggs/hello-there/hello-there-phase-1-animation";
import { useNoNoNoEasterEggAnimation } from "@/hooks/animations/easter-eggs/hello-there/hello-there-phase-2-animation";
import { useSleepingZEasterEggAnimation } from "@/hooks/animations/easter-eggs/hello-there/hello-there-phase-3-animation";
import {
  EasterEggAnimationSequence,
  useEasterEggAnimationSequence,
} from "@/hooks/animations/easter-eggs/hello-there/use-hello-there-animation-sequence";
import { useNukeMyBacklogAnimation } from "@/hooks/animations/easter-eggs/nuke-my-backlog/nuke-my-backlog-animation-v14";
import {
  LightningStrikerOverlayHost,
  type LightningStrikerOverlayHostHandle,
} from "@/hooks/animations/easter-eggs/lighting-striker/lightning-striker-overlay-host";
import { setRainSplashSurface } from "@/hooks/animations/easter-eggs/lighting-striker/rain-splash-surface-registry";
import { useSpaceInvadersEasterEgg } from "@/hooks/animations/easter-eggs/space-invaders-v3/use-space-invaders-easter-egg";
import { usePacManEasterEgg } from "@/hooks/animations/easter-eggs/pacman-v2/use-pacman-easter-egg";
import { useSnakeEasterEgg } from "@/hooks/animations/easter-eggs/snake-game/use-snake-easter-egg";
import { useCopyMachineAnimation } from "@/hooks/animations/easter-eggs/copy-paste/copy-machine-animation-cv3.1";
import { useBreakingPointEasterEgg } from "@/hooks/animations/easter-eggs/breaking-point/use-breaking-point-easter-egg-v2";
import {
  RowFireHandle,
  RowFireOverlayHost,
} from "@/hooks/animations/easter-eggs/lighting-striker/row-fire-animation";

type SearchFilter = "all" | GlobalSearchFilterKind;

type SearchSection = {
  title: string;
  type: GlobalSearchKind;
  data: GlobalSearchResult[];
};

const TYPE_LABELS: Record<GlobalSearchFilterKind, string> = {
  task: "Tasks",
  event: "Events",
  habit: "Habits",
  log: "Logs",
  tag: "Tags",
  category: "Categories",
  achievement: "Achievements",
  setting: "Settings",
  chart: "Charts",
  action: "Actions",
};

const FILTERS: { label: string; value: SearchFilter }[] = [
  { label: "Everything", value: "all" },
  { label: "Tasks", value: "task" },
  { label: "Events", value: "event" },
  { label: "Habits", value: "habit" },
  { label: "Logs", value: "log" },
  { label: "Tags", value: "tag" },
  { label: "Categories", value: "category" },
  { label: "Achievements", value: "achievement" },
  { label: "Settings", value: "setting" },
  { label: "Charts", value: "chart" },
  { label: "Actions", value: "action" },
];

type Props = {
  visible: boolean;
  query: string;
  results?: SearchResult[];
  onQueryChange: (query: string) => void;
  onDismiss: () => void;
  onItemPress: (request: GlobalSearchSelectionRequest) => void;
};

export function GlobalSearchScreen({
  visible,
  query,
  onQueryChange,
  onDismiss,
  onItemPress,
}: Props) {
  const { theme } = useContext(ThemeContext);

  const searchInputRef = useRef<TextInput>(null);

  const categories = useCategoryStore(useShallow(selectCategoryList));
  const tags = useTagStore(useShallow(selectTagList));

  const controller = useGlobalSearchController({
    query,
    onQueryChange,
  });

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSavedScopesModal, setShowSavedScopesModal] = useState(false);
  const openFilterModal = useCallback(() => {
    controller.openFilterPicker();
    setShowFilterModal(true);
  }, [controller.openFilterPicker]);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const activeEggActivationRef = useRef<string | null>(null);
  const [activeAnimatedEggId, setActiveAnimatedEggId] = useState<string | null>(
    null,
  );
  const animationCanvasRef = useRef<View | null>(null);
  const keyboardVisibleRef = useRef(false);
  const easterEggKeyboardDismissPendingRef = useRef(false);
  const nukeKeyboardDismissPendingRef = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const helloThereAnimation = useHelloThereEasterEggAnimation(theme.background);
  const noNoNo = useNoNoNoEasterEggAnimation();
  const sleepingZ = useSleepingZEasterEggAnimation();
  const sequence = useEasterEggAnimationSequence();
  const nukeMyBacklog = useNukeMyBacklogAnimation();
  /* const lightningStriker = useLightningStrikerAnimation({
    strike: require("@/assets/easter-eggs/lighting-strike/thunder-clap-512544.mp3"),
    thunder: require("@/assets/easter-eggs/lighting-strike/thunder-rumble-321631.mp3"),
  }); */
  const lightningStrikerRef = useRef<LightningStrikerOverlayHostHandle>(null);
  const splashSurfaceRefCallbacks = useMemo(
    () => ({
      searchBar: (node: View | null) =>
        setRainSplashSurface("search-bar", node, "top"),
      filterButton: (node: View | null) =>
        setRainSplashSurface("filter-button", node, "top"),
      filters: new Map(
        FILTERS.map((filter) => [
          filter.value,
          (node: View | null) =>
            setRainSplashSurface(`filter:${filter.value}`, node, "top"),
        ]),
      ),
    }),
    [],
  );
  const rowFireRef = useRef<RowFireHandle>(null);
  const [hiddenLightningRowId, setHiddenLightningRowId] = useState<
    string | null
  >(null);

  const spaceInvaders = useSpaceInvadersEasterEgg({ onSound: (name, n) => {} });
  const pacman = usePacManEasterEgg({
    onSound: (event, pts) => {
      // Optional hook-in for sound effects:
      // "chomp" | "powerPellet" | "eatGhost" | "eatFruit" | "playerDie" | "extraLife" | "stageClear" | "gameOver" | "victory"
    },
  });
  const snake = useSnakeEasterEgg({ onSound: (name, n) => {} });
  const copyMachine = useCopyMachineAnimation();
  const breakingPoint = useBreakingPointEasterEgg();
  // handlers: spaceInvaders: () => spaceInvaders.start(rowRef, animationCanvasRef)  (rowRef is already passed to your handlers)
  // render {spaceInvaders.overlayLayer} last inside animationCanvas
  // cancel it in your !visible effect, and add spaceInvaders.active to scrollEnabled

  // Resolve the ranked document targets back to their live source records.
  // This compatibility adapter lets the current SearchResultRow and
  // onItemPress continue to work while the richer dispatcher is deferred.
  const filteredResults = controller.results;

  const selectedType = controller.filters.type as SearchFilter;

  const activeCategoryFilters = useMemo(
    () =>
      controller.filters.categoryIds.map((id) => ({
        id,
        label:
          categories.find((category) => category.id === id)?.name ??
          "Unknown category",
      })),
    [controller.filters.categoryIds, categories],
  );

  const activeTagFilters = useMemo(
    () =>
      controller.filters.tagIds.map((id) => ({
        id,
        label: tags.find((tag) => tag.id === id)?.name ?? "Unknown tag",
      })),
    [controller.filters.tagIds, tags],
  );

  const easterEggResults = useMemo(
    () => matchGlobalSearchEasterEggs(query),
    [query],
  );

  const sections = useMemo<SearchSection[]>(() => {
    const next: SearchSection[] = [];

    if (easterEggResults.length > 0) {
      next.push({
        title: "Easter eggs",
        type: "easterEgg",
        data: easterEggResults,
      });
    }

    const ordinaryTypes = [
      ...new Set(filteredResults.map((result) => result.document.kind)),
    ].filter((kind) => kind !== "easterEgg");

    for (const kind of ordinaryTypes) {
      next.push({
        title: TYPE_LABELS[kind as keyof typeof TYPE_LABELS] ?? "Results",
        type: kind,
        data: filteredResults.filter((result) => result.document.kind === kind),
      });
    }

    return next;
  }, [easterEggResults, filteredResults]);

  const getAccentColor = (type: SearchFilter) => {
    switch (type) {
      case "task":
        return theme.taskBase;
      case "event":
        return theme.eventBase;
      case "habit":
        return theme.habitBase;
      case "log":
        return theme.timerBase;
      default:
        return theme.taskBase;
    }
  };

  const handleApplySavedScope = useCallback(
    (scope: SavedGlobalSearchScope) => {
      // Only replace filters. Current query remains untouched.
      controller.applySavedScope(scope);
    },
    [controller.applySavedScope],
  );

  const handleSaveScope = useCallback(
    (name: string) => controller.saveScope(name, controller.filters),
    [controller.saveScope, controller.filters],
  );

  const handleRenameScope = useCallback(
    (scope: SavedGlobalSearchScope, name: string) =>
      controller.updateScope(scope.id, name, scope.filters),
    [controller.updateScope],
  );

  const handleUpdateScopeFilters = useCallback(
    (scope: SavedGlobalSearchScope) =>
      controller.updateScope(scope.id, scope.name, controller.filters),
    [controller.updateScope, controller.filters],
  );

  const isQueryEmpty = query.trim().length === 0;
  const hasActiveFilters = controller.hasActiveFilters;

  const emptyTitle =
    isQueryEmpty && !hasActiveFilters
      ? "Your search starts here"
      : isQueryEmpty
        ? "No items match these filters"
        : "No matches found";

  const emptyDescription =
    isQueryEmpty && !hasActiveFilters
      ? "Search for tasks, events, habits and timer logs, all in one place."
      : isQueryEmpty
        ? "Try removing a category or tag filter, or choose a different type."
        : `We couldn't find anything for "${query.trim()}". Try another keyword or adjust your filters.`;

  const handleEmptyAction = () => {
    if (controller.hasActiveFilters) {
      controller.clearAllFilters();
      return;
    }

    controller.clearQuery();
  };

  const onClose = useCallback(() => {
    rowFireRef.current?.cancel();
    setHiddenLightningRowId(null);
    onDismiss();
  }, [rowFireRef, hiddenLightningRowId, onDismiss]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      keyboardVisibleRef.current = true;
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardVisibleRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const waitForKeyboardDismissal = useCallback(
    () =>
      new Promise<void>((resolve) => {
        let settled = false;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
        let hideSubscription: { remove: () => void } | null = null;

        const finish = () => {
          if (settled) return;
          settled = true;
          hideSubscription?.remove();
          if (fallbackTimer) clearTimeout(fallbackTimer);
          // Give KeyboardAvoidingView one more layout pass before measurement.
          setTimeout(resolve, 90);
        };

        hideSubscription = Keyboard.addListener("keyboardDidHide", finish);
        fallbackTimer = setTimeout(finish, Platform.OS === "ios" ? 650 : 450);
        Keyboard.dismiss();
      }),
    [],
  );
  useEffect(() => {
    if (!visible) return;

    const delay = Platform.OS === "android" ? 250 : 100;

    const timeout = setTimeout(() => {
      searchInputRef.current?.focus();
    }, delay);

    return () => clearTimeout(timeout);
  }, [visible]);

  type AnimationActivationHandler = (
    rowRef: React.RefObject<View | null>,
  ) => Promise<any>;

  const animationActivationHandlers = useMemo<
    Record<string, AnimationActivationHandler>
  >(
    () => ({
      // Hello There is a multi-part animation sequence. Its internal
      // hello-there / no-no-no / sleeping-z keys are sequence steps, not
      // separate Global Search Easter egg activations.
      helloThere: (rowRef) =>
        sequence.activate({
          "hello-there": () =>
            helloThereAnimation.start(rowRef, animationCanvasRef),
          "no-no-no": () => noNoNo.start(rowRef, animationCanvasRef),
          "sleeping-z": () => sleepingZ.start(rowRef, animationCanvasRef),
        }),

      // Lightning is a standalone one-shot animation. Do not also call
      // sequence.activate() for this effect.
      /*  lightningStrike: () =>
        lightningStrikerRef.current?.start() ?? Promise.resolve(false), */
      lightningStrike: (rowRef) =>
        lightningStrikerRef.current?.start({
          specialEvent: "random",
          onRowFire: () =>
            rowFireRef.current?.start(rowRef, animationCanvasRef, (hidden) =>
              setHiddenLightningRowId(hidden ? "lightning_strike" : null),
            ) ?? Promise.resolve(false),
        }) ?? Promise.resolve(false),
      spaceInvaders: (rowRef) =>
        spaceInvaders.start(rowRef, animationCanvasRef),
      pacman: (rowRef) => pacman.start(rowRef, animationCanvasRef),
      snake: (rowRef) => snake.start(rowRef, animationCanvasRef),
    }),
    [
      sequence.activate,
      helloThereAnimation.start,
      noNoNo.start,
      sleepingZ.start,
    ],
  );

  const handleEasterEggPress = useCallback(
    async (
      eggId: string,
      rowRef: React.RefObject<View | null>,
      pressedResult: GlobalSearchResult,
      normalizedX = 0.5,
    ) => {
      const egg = GLOBAL_SEARCH_EASTER_EGGS_BY_ID.get(eggId);
      if (!egg) return;
      // The Copy Machine accepts every press while its pile is active.
      // The controller creates one physical visual copy per accepted tap.
      /* if (eggId === "copy_paste" && egg.activation.kind === "animation") {
        if (
          activeEggActivationRef.current &&
          activeEggActivationRef.current !== eggId
        ) {
          return;
        }
        console.log("asdsad");
        copyMachine.press(rowRef, animationCanvasRef, pressedResult, {
          onFirstPress: () => {
            activeEggActivationRef.current = eggId;
            controller.recordSubmittedSearch();
            void recordGlobalSearchEasterEggDiscovery(eggId).catch(
              (storageError) => {
                console.warn(
                  "[Global Search] Couldn't persist Easter egg discovery.",
                  storageError,
                );
              },
            );
          },
          onFinished: () => {
            if (activeEggActivationRef.current === eggId) {
              activeEggActivationRef.current = null;
            }
          },
        });
        return;
      } */
      const isCopyMachine =
        eggId === "copy_paste" && egg.activation.kind === "animation";

      const isNukePump =
        egg.activation.kind === "animation" &&
        egg.activation.effect === "launchSequence";

      // Reconcile the screen lock with Nuke's actual controller state.
      // This recovers if the completion callback was missed.
      const nukeIsRunning = nukeMyBacklog.isRunning();
      console.log("isCopyMachine active", isCopyMachine);
      console.log(
        "isNukePump active",
        isNukePump,
        "is it running",
        nukeIsRunning,
      );
      console.log(
        "is there anyt active easter egg activtion",
        activeEggActivationRef.current,
      );
      if (
        activeEggActivationRef.current === "launch_sequence" &&
        !nukeIsRunning
      ) {
        activeEggActivationRef.current = null;
      }
      // Allow another Easter egg to replace Nuke if the user abandons
      // it before completing the manual pumping interaction.
      /*  const nukeCanBeInterrupted =
        activeEggActivationRef.current === "launch_sequence" &&
        (nukeMyBacklog.stage === "measuring" ||
          nukeMyBacklog.stage === "pumping");

      if (nukeCanBeInterrupted && !isNukePump) {
        nukeMyBacklog.cancel();

        // Defensive cleanup; cancel() also invokes the onFinished callback.
        if (activeEggActivationRef.current === "launch_sequence") {
          activeEggActivationRef.current = null;
        }
      } */

      // Breaking Point is intentionally progressive: accepted taps extend the
      // same fracture network while its screen-level interaction lock is held.
      if (
        eggId === "breaking_point" &&
        activeEggActivationRef.current === eggId
      ) {
        void breakingPoint.press(rowRef, animationCanvasRef, normalizedX);
        console.log("BP 1st");
        return;
      }

      if (isCopyMachine && activeEggActivationRef.current === eggId) {
        copyMachine.press(rowRef, animationCanvasRef, pressedResult);
        console.log("CM 1st");
        return;
      }

      // Nuke's repeated taps are part of its active interaction. Forward them
      // before the general one-shot lock and keyboard preflight.
      /* if (isNukePump && activeEggActivationRef.current === eggId) {
        nukeMyBacklog.press(rowRef, animationCanvasRef);
        return;
      } */
      // Forward repeated taps while Nuke is genuinely active.
      // Also restore the screen lock if it was unexpectedly out of sync.
      if (isNukePump && nukeIsRunning) {
        activeEggActivationRef.current = eggId;
        nukeMyBacklog.press(rowRef, animationCanvasRef);
        console.log("NMB 1st");
        return;
      }

      // Ordinary one-shot or double tap activations cannot overlap another active Easter egg.
      if (
        activeEggActivationRef.current ||
        easterEggKeyboardDismissPendingRef.current
      ) {
        return;
      }
      console.log(
        "Ordinary one-shot or double tap activations cannot overlap another active Easter egg",
      );
      // Shared keyboard preflight: dismiss before measuring/starting any first
      // activation, not only Nuke My Backlog. The pending ref prevents two taps
      // from racing the asynchronous keyboard close/reflow.
      if (keyboardVisibleRef.current) {
        /* if (easterEggKeyboardDismissPendingRef.current) return; */
        easterEggKeyboardDismissPendingRef.current = true;

        try {
          await waitForKeyboardDismissal();
        } finally {
          easterEggKeyboardDismissPendingRef.current = false;
        }

        if (!visibleRef.current) return;
      }
      console.log("Keyboard dismissal", activeEggActivationRef.current);
      // Re-check after the await in case another activation acquired the lock.
      if (
        activeEggActivationRef.current ||
        easterEggKeyboardDismissPendingRef.current
      ) {
        return;
      }
      console.log(
        "Re-check after the await in case another activation acquired the lock.",
        activeEggActivationRef.current,
      );
      // Nuke remains the only multi-tap activation. Its first accepted press
      // acquires the screen-level lock synchronously through onFirstPress.
      if (isNukePump) {
        console.log("NMB 2nd", activeEggActivationRef.current);
        nukeMyBacklog.press(rowRef, animationCanvasRef, {
          onFirstPress: () => {
            activeEggActivationRef.current = eggId;
            controller.recordSubmittedSearch();
            void recordGlobalSearchEasterEggDiscovery(eggId).catch(
              (storageError) => {
                console.warn(
                  "[Global Search] Couldn't persist Easter egg discovery.",
                  storageError,
                );
              },
            );
          },
          onFinished: () => {
            if (activeEggActivationRef.current === eggId) {
              activeEggActivationRef.current = null;
            }
          },
        });
        return;
      }

      if (isCopyMachine) {
        console.log("CM 2nd", activeEggActivationRef.current);
        copyMachine.press(rowRef, animationCanvasRef, pressedResult, {
          onFirstPress: () => {
            activeEggActivationRef.current = eggId;
            controller.recordSubmittedSearch();
            void recordGlobalSearchEasterEggDiscovery(eggId).catch(
              (storageError) => {
                console.warn(
                  "[Global Search] Couldn't persist Easter egg discovery.",
                  storageError,
                );
              },
            );
          },
          onFinished: () => {
            if (activeEggActivationRef.current === eggId) {
              activeEggActivationRef.current = null;
            }
          },
        });
        return;
      }
      if (eggId === "breaking_point") {
        // Acquire the screen-level lock before async row measurement so a
        // different Easter egg cannot start during the measurement window.
        console.log("BP 2nd", activeEggActivationRef.current);
        activeEggActivationRef.current = eggId;
        const accepted = await breakingPoint.press(
          rowRef,
          animationCanvasRef,
          normalizedX,
          {
            onFirstAccepted: () => {
              controller.recordSubmittedSearch();
              void recordGlobalSearchEasterEggDiscovery(eggId).catch(
                (storageError) => {
                  console.warn(
                    "[Global Search] Couldn't persist Easter egg discovery.",
                    storageError,
                  );
                },
              );
            },
          },
        );
        if (
          !accepted &&
          breakingPoint.stage === 0 &&
          activeEggActivationRef.current === eggId
        ) {
          activeEggActivationRef.current = null;
        }
        return;
      }

      console.log("NOW only single tap path", activeEggActivationRef.current);
      if (egg.activation.kind === "animation") {
        const runAnimation = animationActivationHandlers[egg.activation.effect];
        console.log(egg.activation.effect, "selected");
        // An animation kind alone does not mean the effect is implemented.
        // Unknown effects remain discoverable in the registry but show the
        // existing staging alert and are not recorded as discovered.
        if (!runAnimation) {
          Alert.alert(
            "Surprise still in development",
            "This Easter egg's effect is being designed. It isn't activated yet.",
          );
          return;
        }

        // Acquire synchronously before invoking an animation. The selected
        // handler is the ONLY animation launched for this row press.
        activeEggActivationRef.current = eggId;

        try {
          controller.recordSubmittedSearch();

          void recordGlobalSearchEasterEggDiscovery(eggId).catch(
            (storageError) => {
              console.warn(
                "[Global Search] Couldn't persist Easter egg discovery.",
                storageError,
              );
            },
          );

          const completedAnimation = await runAnimation(rowRef);

          if (!completedAnimation) {
            console.warn(
              `[Global Search] Animation for "${eggId}" did not complete.`,
            );
          }
        } catch (error) {
          console.warn(
            `[Global Search] Animation for "${eggId}" failed.`,
            error,
          );
        } finally {
          if (activeEggActivationRef.current === eggId) {
            activeEggActivationRef.current = null;
          }
        }
        return;
      }

      activeEggActivationRef.current = eggId;
      console.log("RICKROLL ONLY", activeEggActivationRef.current);
      // If the user submits or activates an egg, retain their current query.
      controller.recordSubmittedSearch();

      try {
        // Discovery is recorded on tap, before trying to open the URL.
        // A failed external URL still counts as an explicit activation tap.
        try {
          await recordGlobalSearchEasterEggDiscovery(eggId);
        } catch (storageError) {
          console.warn(
            "[Global Search] Couldn't persist Easter egg discovery.",
            storageError,
          );
        }

        try {
          // Rickroll only: external navigation happens after the explicit tap.
          await Linking.openURL(egg.activation.url);
        } catch {
          Alert.alert(
            "Couldn't open YouTube",
            "The surprise was activated, but the external link couldn't be opened.",
          );
        }
      } finally {
        activeEggActivationRef.current = null;
      }
      console.log("final stage", activeEggActivationRef.current);
    },

    [
      animationActivationHandlers,
      controller.recordSubmittedSearch,
      nukeMyBacklog.press,
      /*  nukeMyBacklog.cancel,
      nukeMyBacklog.stage, */ // IMPORTANT: refresh callback when Nuke changes phase
      waitForKeyboardDismissal,
      visible,
      copyMachine.press,
      breakingPoint.press,
      breakingPoint.stage,
    ],
  );
  // const waitForKeyboardDismissal = useCallback(
  //   () =>
  //     new Promise<void>((resolve) => {
  //       if (!keyboardVisibleRef.current) {
  //         resolve();
  //         return;
  //       }

  //       let settled = false;
  //       let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  //       let hideSubscription: { remove: () => void } | null = null;

  //       const finish = () => {
  //         if (settled) return;
  //         settled = true;
  //         // CRITICAL: Always clear keyboardVisibleRef so it can never get stuck true!
  //         keyboardVisibleRef.current = false;
  //         hideSubscription?.remove();
  //         if (fallbackTimer) clearTimeout(fallbackTimer);
  //         // Give KeyboardAvoidingView one more layout pass before measurement.
  //         setTimeout(resolve, 90);
  //       };

  //       hideSubscription = Keyboard.addListener("keyboardDidHide", finish);
  //       fallbackTimer = setTimeout(finish, Platform.OS === "ios" ? 650 : 450);
  //       Keyboard.dismiss();
  //     }),
  //   [],
  // );

  // useEffect(() => {
  //   if (!visible) return;

  //   const delay = Platform.OS === "android" ? 250 : 100;

  //   const timeout = setTimeout(() => {
  //     searchInputRef.current?.focus();
  //   }, delay);

  //   return () => clearTimeout(timeout);
  // }, [visible]);

  // type AnimationActivationHandler = (
  //   rowRef: React.RefObject<View | null>,
  // ) => Promise<any>;

  // const animationActivationHandlers = useMemo<
  //   Record<string, AnimationActivationHandler>
  // >(
  //   () => ({
  //     helloThere: (rowRef) =>
  //       sequence.activate({
  //         "hello-there": () =>
  //           helloThereAnimation.start(rowRef, animationCanvasRef),
  //         "no-no-no": () => noNoNo.start(rowRef, animationCanvasRef),
  //         "sleeping-z": () => sleepingZ.start(rowRef, animationCanvasRef),
  //       }),
  //     lightningStrike: (rowRef) =>
  //       lightningStrikerRef.current?.start({
  //         specialEvent: "random",
  //         onRowFire: () =>
  //           rowFireRef.current?.start(rowRef, animationCanvasRef, (hidden) =>
  //             setHiddenLightningRowId(hidden ? "lightning_strike" : null),
  //           ) ?? Promise.resolve(false),
  //       }) ?? Promise.resolve(false),
  //     spaceInvaders: (rowRef) =>
  //       spaceInvaders.start(rowRef, animationCanvasRef),
  //     pacman: (rowRef) => pacman.start(rowRef, animationCanvasRef),
  //     snake: (rowRef) => snake.start(rowRef, animationCanvasRef),
  //   }),
  //   [
  //     sequence.activate,
  //     helloThereAnimation.start,
  //     noNoNo.start,
  //     sleepingZ.start,
  //     spaceInvaders.start,
  //     pacman.start,
  //     snake.start,
  //   ],
  // );

  // // Buffer taps made on Nuke while the keyboard is still sliding down on Tap #1
  // const pendingNukeTapsDuringKeyboardRef = useRef(0);

  // const handleEasterEggPress = useCallback(
  //   async (
  //     eggId: string,
  //     rowRef: React.RefObject<View | null>,
  //     pressedResult: GlobalSearchResult,
  //     normalizedX = 0.5,
  //   ) => {
  //     const egg = GLOBAL_SEARCH_EASTER_EGGS_BY_ID.get(eggId);
  //     if (!egg) return;

  //     const isCopyMachine =
  //       eggId === "copy_paste" && egg.activation.kind === "animation";
  //     const isNukePump =
  //       egg.activation.kind === "animation" &&
  //       egg.activation.effect === "launchSequence";
  //     const isBreakingPoint = eggId === "breaking_point";

  //     // -------------------------------------------------------------------
  //     // 1. SELF-HEALING LOCK RECONCILIATION
  //     // If activeEggActivationRef thinks an egg is running, verify that its
  //     // underlying hook is actually still active. If not, release the lock!
  //     // -------------------------------------------------------------------
  //     const currentLock = activeEggActivationRef.current;
  //     const nukeIsRunning = nukeMyBacklog.isRunning();

  //     if (currentLock === "launch_sequence" && !nukeIsRunning) {
  //       activeEggActivationRef.current = null;
  //     } else if (currentLock === "copy_paste" && !copyMachine.active) {
  //       activeEggActivationRef.current = null;
  //     } else if (
  //       currentLock === "breaking_point" &&
  //       breakingPoint.stage === 0 /* && !breakingPoint.active */
  //     ) {
  //       activeEggActivationRef.current = null;
  //     } else if (
  //       currentLock === "hello_there" &&
  //       !helloThereAnimation.active &&
  //       !noNoNo.active &&
  //       !sleepingZ.active &&
  //       !sequence.isRunning
  //     ) {
  //       activeEggActivationRef.current = null;
  //     } else if (currentLock === "space_invaders" && !spaceInvaders.active) {
  //       activeEggActivationRef.current = null;
  //     } else if (currentLock === "pacman" && !pacman.active) {
  //       activeEggActivationRef.current = null;
  //     } else if (currentLock === "snake" && !snake.active) {
  //       activeEggActivationRef.current = null;
  //     }

  //     // -------------------------------------------------------------------
  //     // 2. ALLOW INTERRUPTING UNFINISHED MULTI-TAP EGGS
  //     // If the user started pumping Nuke, stacking Copy Machine, or tapping
  //     // Breaking Point, and then switches to a DIFFERENT Easter egg, cancel
  //     // the unfinished multi-tap egg so the new one can run immediately.
  //     // -------------------------------------------------------------------
  //     if (
  //       activeEggActivationRef.current &&
  //       activeEggActivationRef.current !== eggId
  //     ) {
  //       const canInterruptNuke =
  //         activeEggActivationRef.current === "launch_sequence" &&
  //         (nukeMyBacklog.stage === "measuring" ||
  //           nukeMyBacklog.stage === "pumping");

  //       if (canInterruptNuke) {
  //         nukeMyBacklog.cancel();
  //         activeEggActivationRef.current = null;
  //       } else if (activeEggActivationRef.current === "copy_paste") {
  //         copyMachine.cancel();
  //         activeEggActivationRef.current = null;
  //       } else if (activeEggActivationRef.current === "breaking_point") {
  //         breakingPoint.cancel();
  //         activeEggActivationRef.current = null;
  //       }
  //     }

  //     // -------------------------------------------------------------------
  //     // 3. FAST-PATH FOR REPEATED TAPS ON ACTIVE MULTI-TAP EGGS
  //     // Always pass callbacks so a 2nd tap never wipes out `onFinished`!
  //     // -------------------------------------------------------------------
  //     if (isBreakingPoint && activeEggActivationRef.current === eggId) {
  //       void breakingPoint.press(
  //         rowRef,
  //         animationCanvasRef,
  //         normalizedX /* , {
  //         onFinished: () => {
  //           if (activeEggActivationRef.current === eggId) {
  //             activeEggActivationRef.current = null;
  //           }
  //         },
  //       } as any */,
  //       );
  //       return;
  //     }

  //     if (isCopyMachine && activeEggActivationRef.current === eggId) {
  //       copyMachine.press(rowRef, animationCanvasRef, pressedResult, {
  //         onFinished: () => {
  //           if (activeEggActivationRef.current === eggId) {
  //             activeEggActivationRef.current = null;
  //           }
  //         },
  //       });
  //       return;
  //     }

  //     if (isNukePump && nukeIsRunning) {
  //       activeEggActivationRef.current = eggId;
  //       nukeMyBacklog.press(rowRef, animationCanvasRef, {
  //         onFinished: () => {
  //           if (activeEggActivationRef.current === eggId) {
  //             activeEggActivationRef.current = null;
  //           }
  //         },
  //       });
  //       return;
  //     }

  //     // If Nuke's first tap is currently waiting for the keyboard to close,
  //     // buffer extra pumping taps instead of dropping them!
  //     if (isNukePump && easterEggKeyboardDismissPendingRef.current) {
  //       pendingNukeTapsDuringKeyboardRef.current += 1;
  //       return;
  //     }

  //     // Block overlapping activations if another non-interruptible egg is running
  //     if (
  //       activeEggActivationRef.current ||
  //       easterEggKeyboardDismissPendingRef.current
  //     ) {
  //       return;
  //     }

  //     // -------------------------------------------------------------------
  //     // 4. KEYBOARD PREFLIGHT BEFORE FIRST ACTIVATION
  //     // -------------------------------------------------------------------
  //     if (keyboardVisibleRef.current) {
  //       easterEggKeyboardDismissPendingRef.current = true;
  //       pendingNukeTapsDuringKeyboardRef.current = 0;

  //       try {
  //         await waitForKeyboardDismissal();
  //       } finally {
  //         easterEggKeyboardDismissPendingRef.current = false;
  //       }

  //       if (!visibleRef.current) return;
  //     }

  //     if (
  //       activeEggActivationRef.current ||
  //       easterEggKeyboardDismissPendingRef.current
  //     ) {
  //       return;
  //     }

  //     // -------------------------------------------------------------------
  //     // 5. FIRST ACTIVATION DISPATCH
  //     // -------------------------------------------------------------------
  //     if (isNukePump) {
  //       const extraBufferedTaps = pendingNukeTapsDuringKeyboardRef.current;
  //       pendingNukeTapsDuringKeyboardRef.current = 0;

  //       nukeMyBacklog.press(rowRef, animationCanvasRef, {
  //         onFirstPress: () => {
  //           activeEggActivationRef.current = eggId;
  //           controller.recordSubmittedSearch();
  //           void recordGlobalSearchEasterEggDiscovery(eggId).catch(
  //             (storageError) => {
  //               console.warn(
  //                 "[Global Search] Couldn't persist Easter egg discovery.",
  //                 storageError,
  //               );
  //             },
  //           );
  //         },
  //         onFinished: () => {
  //           if (activeEggActivationRef.current === eggId) {
  //             activeEggActivationRef.current = null;
  //           }
  //         },
  //       });

  //       // Replay any rapid pump taps the user made while the keyboard was closing
  //       for (let i = 0; i < extraBufferedTaps; i += 1) {
  //         nukeMyBacklog.press(rowRef, animationCanvasRef);
  //       }
  //       return;
  //     }

  //     if (isCopyMachine) {
  //       copyMachine.press(rowRef, animationCanvasRef, pressedResult, {
  //         onFirstPress: () => {
  //           activeEggActivationRef.current = eggId;
  //           controller.recordSubmittedSearch();
  //           void recordGlobalSearchEasterEggDiscovery(eggId).catch(
  //             (storageError) => {
  //               console.warn(
  //                 "[Global Search] Couldn't persist Easter egg discovery.",
  //                 storageError,
  //               );
  //             },
  //           );
  //         },
  //         onFinished: () => {
  //           if (activeEggActivationRef.current === eggId) {
  //             activeEggActivationRef.current = null;
  //           }
  //         },
  //       });
  //       return;
  //     }

  //     if (isBreakingPoint) {
  //       activeEggActivationRef.current = eggId;
  //       const accepted = await breakingPoint.press(
  //         rowRef,
  //         animationCanvasRef,
  //         normalizedX,
  //         {
  //           onFirstAccepted: () => {
  //             controller.recordSubmittedSearch();
  //             void recordGlobalSearchEasterEggDiscovery(eggId).catch(
  //               (storageError) => {
  //                 console.warn(
  //                   "[Global Search] Couldn't persist Easter egg discovery.",
  //                   storageError,
  //                 );
  //               },
  //             );
  //           } /* ,
  //           onFinished: () => {
  //             if (activeEggActivationRef.current === eggId) {
  //               activeEggActivationRef.current = null;
  //             }
  //           }, */,
  //         } /* as any */,
  //       );
  //       if (
  //         !accepted &&
  //         breakingPoint.stage === 0 &&
  //         activeEggActivationRef.current === eggId
  //       ) {
  //         activeEggActivationRef.current = null;
  //       }
  //       return;
  //     }

  //     if (egg.activation.kind === "animation") {
  //       const runAnimation = animationActivationHandlers[egg.activation.effect];

  //       if (!runAnimation) {
  //         Alert.alert(
  //           "Surprise still in development",
  //           "This Easter egg's effect is being designed. It isn't activated yet.",
  //         );
  //         return;
  //       }

  //       activeEggActivationRef.current = eggId;

  //       try {
  //         controller.recordSubmittedSearch();

  //         void recordGlobalSearchEasterEggDiscovery(eggId).catch(
  //           (storageError) => {
  //             console.warn(
  //               "[Global Search] Couldn't persist Easter egg discovery.",
  //               storageError,
  //             );
  //           },
  //         );

  //         const completedAnimation = await runAnimation(rowRef);

  //         if (!completedAnimation) {
  //           console.warn(
  //             `[Global Search] Animation for "${eggId}" did not complete.`,
  //           );
  //         }
  //       } catch (error) {
  //         console.warn(
  //           `[Global Search] Animation for "${eggId}" failed.`,
  //           error,
  //         );
  //       } finally {
  //         if (activeEggActivationRef.current === eggId) {
  //           activeEggActivationRef.current = null;
  //         }
  //       }
  //       return;
  //     }

  //     activeEggActivationRef.current = eggId;
  //     controller.recordSubmittedSearch();

  //     try {
  //       try {
  //         await recordGlobalSearchEasterEggDiscovery(eggId);
  //       } catch (storageError) {
  //         console.warn(
  //           "[Global Search] Couldn't persist Easter egg discovery.",
  //           storageError,
  //         );
  //       }

  //       try {
  //         await Linking.openURL(egg.activation.url);
  //       } catch {
  //         Alert.alert(
  //           "Couldn't open YouTube",
  //           "The surprise was activated, but the external link couldn't be opened.",
  //         );
  //       }
  //     } finally {
  //       activeEggActivationRef.current = null;
  //     }
  //   },
  //   [
  //     animationActivationHandlers,
  //     controller.recordSubmittedSearch,
  //     nukeMyBacklog,
  //     copyMachine,
  //     breakingPoint,
  //     helloThereAnimation.active,
  //     noNoNo.active,
  //     sleepingZ.active,
  //     sequence.isRunning,
  //     spaceInvaders.active,
  //     pacman.active,
  //     snake.active,
  //     waitForKeyboardDismissal,
  //   ],
  // );

  const visibleResultCount = filteredResults.length + easterEggResults.length;

  useEffect(() => {
    if (visible) return;

    activeEggActivationRef.current = null;
    nukeKeyboardDismissPendingRef.current = false;
    helloThereAnimation.cancel();
    noNoNo.cancel();
    sleepingZ.cancel();
    nukeMyBacklog.cancel();
    /* lightningStriker.cancel(); */
    lightningStrikerRef.current?.cancel();
    snake.cancel();
    pacman.cancel();
    spaceInvaders.cancel();
    copyMachine.cancel();
    breakingPoint.cancel();
  }, [
    visible,
    helloThereAnimation.cancel,
    noNoNo.cancel,
    sleepingZ.cancel,
    nukeMyBacklog.cancel,
    pacman.cancel,
    snake.cancel,
    spaceInvaders.cancel,
    copyMachine.cancel,
    breakingPoint.cancel,
  ]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView
          edges={["top", "left", "right", "bottom"]}
          style={[styles.screen, { backgroundColor: theme.background }]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              ref={animationCanvasRef}
              collapsable={false}
              style={styles.animationCanvas}
            >
              <View style={styles.searchContentLayer}>
                {/* Header */}
                <View style={styles.header}>
                  <IconButton
                    icon="arrow-left"
                    size={25}
                    iconColor={theme.text}
                    onPress={onDismiss}
                    accessibilityLabel="Close search"
                  />

                  <View style={styles.headerCopy}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>
                      Search Everything
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{ color: withAlpha(theme.text, "A8") }}
                    >
                      {isQueryEmpty && !hasActiveFilters
                        ? "Search across your app"
                        : `${visibleResultCount} result${
                            visibleResultCount === 1 ? "" : "s"
                          } ${
                            isQueryEmpty
                              ? "matching current filters"
                              : `for "${query.trim()}"`
                          }`}
                    </Text>
                  </View>
                </View>

                {/* Search input */}
                <View
                  ref={splashSurfaceRefCallbacks.searchBar}
                  collapsable={false}
                >
                  <Searchbar
                    placeholder="Search everything"
                    ref={searchInputRef}
                    value={query}
                    onChangeText={controller.setQuery}
                    iconColor={theme.text}
                    placeholderTextColor={withAlpha(theme.text, "80")}
                    inputStyle={{ color: theme.text }}
                    style={[
                      styles.searchbar,
                      {
                        backgroundColor: theme.taskBaseTransToo,
                        borderColor: withAlpha(theme.text, "12"),
                      },
                    ]}
                    accessibilityLabel="Search everything"
                    onSubmitEditing={controller.recordSubmittedSearch}
                  />
                </View>
                {/* Type filters */}
                <View style={styles.filterControlsWrap}>
                  <View style={styles.filterChipsWrap}>
                    <Pressable
                      ref={splashSurfaceRefCallbacks.filterButton}
                      accessibilityRole="button"
                      accessibilityLabel={
                        controller.activeFacetCount > 0
                          ? `Edit filters, ${controller.activeFacetCount} active`
                          : "Edit search filters"
                      }
                      onPress={openFilterModal}
                      style={[
                        styles.filterButton,
                        {
                          backgroundColor: withAlpha(theme.text, "08"),
                          borderColor: withAlpha(theme.text, "24"),
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="tune-variant"
                        size={16}
                        color={theme.text}
                      />

                      {controller.activeFacetCount > 0 && (
                        <View
                          style={[
                            styles.filterCountBadge,
                            { backgroundColor: theme.taskBase },
                          ]}
                        >
                          <Text
                            style={{
                              color: theme.whiteBase,
                              fontSize: 10,
                              fontWeight: "500",
                            }}
                          >
                            {controller.activeFacetCount}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    {FILTERS.map((filter) => {
                      const selected = controller.filters.type === filter.value;
                      const accent = getAccentColor(filter.value);

                      return (
                        <Pressable
                          key={filter.value}
                          ref={splashSurfaceRefCallbacks.filters.get(
                            filter.value,
                          )}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => controller.setType(filter.value)}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: selected
                                ? accent
                                : withAlpha(theme.text, "08"),
                              borderColor: selected
                                ? accent
                                : withAlpha(theme.text, "18"),
                            },
                          ]}
                        >
                          <Text
                            numberOfLines={1}
                            style={{
                              color: selected ? theme.whiteBase : theme.text,
                              fontWeight: selected ? "700" : "500",
                              fontSize: 12,
                            }}
                          >
                            {filter.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                {controller.hasActiveFilters && (
                  <View style={styles.activeFiltersWrap}>
                    {activeCategoryFilters.map((category) => (
                      <Pressable
                        key={`active-category-${category.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove category filter ${category.label}`}
                        onPress={() =>
                          controller.removeCategoryFilter(category.id)
                        }
                        style={[
                          styles.activeFilterChip,
                          {
                            backgroundColor: withAlpha(theme.taskBase, "12"),
                            borderColor: withAlpha(theme.taskBase, "40"),
                          },
                        ]}
                      >
                        <CategoryBadge
                          categoryId={category.id}
                          variant="iconOnly"
                        />
                        <MaterialCommunityIcons
                          name="close"
                          size={12}
                          color={theme.text}
                        />
                      </Pressable>
                    ))}

                    {activeTagFilters.map((tag) => (
                      <Pressable
                        key={`active-tag-${tag.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove tag filter ${tag.label}`}
                        onPress={() => controller.removeTagFilter(tag.id)}
                        style={[
                          styles.activeFilterChip,
                          {
                            backgroundColor: withAlpha(theme.taskBase, "12"),
                            borderColor: withAlpha(theme.taskBase, "40"),
                          },
                        ]}
                      >
                        <TagBadge tagId={tag.id} holeColor={theme.background} />
                        <MaterialCommunityIcons
                          name="close"
                          size={12}
                          color={theme.text}
                        />
                      </Pressable>
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Save current filters as a scope"
                      onPress={() => setShowSavedScopesModal(true)}
                      style={styles.clearFiltersButton}
                    >
                      <Text
                        style={{ color: theme.taskBase, fontWeight: "600" }}
                      >
                        Save scope
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={controller.clearAllFilters}
                      style={styles.clearFiltersButton}
                    >
                      <Text
                        style={{ color: theme.taskBase, fontWeight: "600" }}
                      >
                        Clear all
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Grouped results */}
                <SectionList<GlobalSearchResult, SearchSection>
                  sections={sections}
                  keyExtractor={(item, index) =>
                    `${String(item.document.key ?? index)}`
                  }
                  ListHeaderComponent={
                    isQueryEmpty && !controller.hasActiveFilters ? (
                      <GlobalSearchConveniencePanel
                        savedScopes={controller.savedScopes}
                        recentSearches={controller.recentSearches}
                        recentItems={controller.recentItems}
                        shortcuts={controller.documents.filter(
                          (document) => document.kind === "action",
                        )}
                        isLoaded={controller.isConvenienceStoreLoaded}
                        onApplyScope={handleApplySavedScope}
                        onManageScopes={() => setShowSavedScopesModal(true)}
                        onRestoreSearch={controller.restoreRecentSearch}
                        onRemoveSearch={controller.removeRecentSearch}
                        onClearSearches={controller.clearRecentSearches}
                        onOpenShortcuts={() => setShowShortcutsModal(true)}
                        onOpenRecentItem={(recent: RecentGlobalSearchItem) => {
                          const document = controller.documents.find(
                            (candidate) => candidate.key === recent.key,
                          );

                          if (!document) {
                            void controller.removeRecentItem(recent.key);
                            return;
                          }

                          controller.recordSelectedResult(document);

                          onItemPress(
                            createGlobalSearchSelectionRequest(document.target),
                          );
                        }}
                        onRemoveRecentItem={controller.removeRecentItem}
                        onClearRecentItems={controller.clearRecentItems}
                        onActivateShortcut={(document) => {
                          controller.recordSelectedResult(document);

                          onItemPress(
                            createGlobalSearchSelectionRequest(document.target),
                          );
                        }}
                      />
                    ) : null
                  }
                  renderSectionHeader={({ section }) => (
                    <View
                      style={[
                        styles.sectionHeader,
                        {
                          backgroundColor: theme.background,
                          borderBottomColor: withAlpha(theme.text, "12"),
                        },
                      ]}
                    >
                      <Text
                        style={[styles.sectionTitle, { color: theme.text }]}
                      >
                        {section.title}
                      </Text>

                      <Text
                        style={{
                          color: withAlpha(
                            section.type === "easterEgg"
                              ? "#ed62ff"
                              : getAccentColor(section.type),
                            "FF",
                          ),
                          fontWeight: "500",
                          fontSize: 16,
                        }}
                      >
                        {section.data.length}
                      </Text>
                    </View>
                  )}
                  renderItem={({ item }) => {
                    if (item.document.kind === "easterEgg") {
                      const eggId = item.document.target.eggId;
                      //console.log(eggId);
                      const activationEnabled =
                        eggId === "rickroll" ||
                        eggId === "hello_there" ||
                        eggId === "launch_sequence" ||
                        eggId === "lightning_strike" ||
                        eggId === "copy_paste" ||
                        eggId === "space_invaders" ||
                        eggId === "pacman" ||
                        eggId === "snake" ||
                        eggId === "breaking_point";
                      const nukeMyBackLogHint =
                        eggId === "launch_sequence" && nukeMyBacklog.hintVisible
                          ? nukeMyBacklog.hintText
                          : undefined;

                      return (
                        <GlobalSearchEasterEggRow
                          result={item}
                          activationEnabled={activationEnabled}
                          onPress={(rowRef, normalizedX) => {
                            void handleEasterEggPress(
                              eggId,
                              rowRef,
                              item,
                              normalizedX,
                            );
                          }}
                          onLayout={
                            visible && eggId === "launch_sequence"
                              ? (rowRef) => {
                                  nukeMyBacklog.prewarmAct3(
                                    rowRef,
                                    animationCanvasRef,
                                  );
                                }
                              : undefined
                          }
                          hintText={nukeMyBackLogHint}
                          hidden={eggId === hiddenLightningRowId}
                        />
                      );
                    }
                    return (
                      <SearchResultRow
                        result={item}
                        query={query}
                        onPress={() => {
                          controller.recordSelectedResult(item.document);
                          onItemPress(
                            createGlobalSearchSelectionRequest(
                              item.document.target,
                            ),
                          );
                        }}
                      />
                    );
                  }}
                  ItemSeparatorComponent={() => (
                    <View style={styles.rowSeparator} />
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <View
                        style={[
                          styles.emptyIconContainer,
                          {
                            backgroundColor: withAlpha(theme.taskBase, "18"),
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isQueryEmpty ? "magnify" : "text-search"}
                          size={34}
                          color={theme.taskBase}
                        />
                      </View>

                      <Text style={[styles.emptyTitle, { color: theme.text }]}>
                        {emptyTitle}
                      </Text>

                      <Text
                        style={[
                          styles.emptyDescription,
                          { color: withAlpha(theme.text, "A8") },
                        ]}
                      >
                        {emptyDescription}
                      </Text>

                      {(!isQueryEmpty || controller.hasActiveFilters) && (
                        <Button
                          mode="text"
                          textColor={theme.taskBase}
                          onPress={handleEmptyAction}
                          style={styles.emptyAction}
                        >
                          {isQueryEmpty ? "Clear filters" : "Clear search"}
                        </Button>
                      )}
                    </View>
                  }
                  contentContainerStyle={styles.resultsContent}
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled={
                    !helloThereAnimation.active &&
                    !noNoNo.active &&
                    !sleepingZ.active &&
                    !nukeMyBacklog.active &&
                    !sequence.isRunning &&
                    !copyMachine.active &&
                    !snake.active &&
                    !pacman.active &&
                    !spaceInvaders.active
                  }
                  keyboardDismissMode={
                    Platform.OS === "ios" ? "interactive" : "on-drag"
                  }
                  stickySectionHeadersEnabled={false}
                  showsVerticalScrollIndicator={false}
                />
                <GlobalSearchFilterModal
                  visible={showFilterModal}
                  categories={categories}
                  tags={tags}
                  draftFilters={controller.draftFilters ?? controller.filters}
                  onToggleCategory={controller.toggleDraftCategory}
                  onToggleTag={controller.toggleDraftTag}
                  onTagMatchModeChange={controller.setDraftTagMatchMode}
                  onClearFacets={controller.clearDraftFacets}
                  onApply={() => {
                    controller.applyFilterEditing();
                    setShowFilterModal(false);
                  }}
                  onCancel={() => {
                    controller.cancelFilterEditing();
                    setShowFilterModal(false);
                  }}
                  palette={{
                    background: theme.background,
                    surface: theme.background,
                    text: theme.text,
                    secondaryText: theme.greyBasePrimary,
                    border: theme.greyBaseTertiary,
                    accent: theme.taskBase,
                    selectedSurface: withAlpha(theme.taskBase, "08"),
                  }}
                />
                <GlobalSearchSavedScopesModal
                  visible={showSavedScopesModal}
                  scopes={controller.savedScopes}
                  currentFilters={controller.filters}
                  canSaveCurrentFilters={controller.hasActiveFilters}
                  onClose={() => setShowSavedScopesModal(false)}
                  onSaveScope={handleSaveScope}
                  onApplyScope={handleApplySavedScope}
                  onRenameScope={handleRenameScope}
                  onUpdateScopeFilters={handleUpdateScopeFilters}
                  onDeleteScope={controller.deleteScope}
                  onClearScopes={controller.clearScopes}
                />
                <GlobalSearchShortcutsModal
                  visible={showShortcutsModal}
                  shortcuts={controller.documents.filter(
                    (document) => document.kind === "action",
                  )}
                  savedScopes={controller.savedScopes}
                  isLoaded={controller.isConvenienceStoreLoaded}
                  onClose={() => setShowShortcutsModal(false)}
                  onManageScopes={() => setShowSavedScopesModal(true)}
                  onApplyScope={(scope) => {
                    controller.applySavedScope(scope);
                  }}
                  onActivateShortcut={(document) => {
                    controller.recordSelectedResult(document);

                    onItemPress(
                      createGlobalSearchSelectionRequest(document.target),
                    );
                  }}
                />
              </View>

              {helloThereAnimation.behindLayer}
              {noNoNo.behindLayer}
              {sleepingZ.behindLayer}
              {nukeMyBacklog.behindLayer}
              {copyMachine.layer}
              {helloThereAnimation.foregroundLayer}
              {noNoNo.foregroundLayer}
              {/* {lightningStriker.overlayLayer} */}
              <LightningStrikerOverlayHost
                ref={lightningStrikerRef}
                canvasRef={animationCanvasRef}
              />
              <RowFireOverlayHost
                ref={rowFireRef}
                canvasRef={animationCanvasRef}
              />
              {spaceInvaders.overlayLayer}
              {pacman.overlayLayer}
              {snake.overlayLayer}
              {breakingPoint.overlayLayer}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  animationCanvas: {
    flex: 1,
    overflow: "visible",
  },
  searchContentLayer: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
    backgroundColor: "transparent",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingVertical: 4,
  },
  headerCopy: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontWeight: "700",
    fontSize: 22,
  },
  searchbar: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 16,
    elevation: 0,
  },
  //!OLD FILTER CHIP SCROLL VIEW VERSION
  /*   typeFilterRow: {
    width: "100%",
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  filtersScroll: {
    flex: 1,
    height: 50,
    // flexGrow: 0,
    flexShrink: 1,
    marginBottom: 8,
  },
  filtersContent: {
    height: 50,
    paddingHorizontal: 16,
    paddingVertical: 4,
    alignItems: "center",
    gap: 8,
  }, 
   filterChip: {
    height: 44,
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 0,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  }, 
   taxnonomyChip: {
    height: 40,
    width: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  }, */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 16,
  },
  rowSeparator: {
    height: 2,
  },
  resultsContent: {
    flexGrow: 1,
    paddingBottom: 28,
    //zIndex: 1000,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 70,
    paddingBottom: 50,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 22,
  },
  emptyDescription: {
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 320,
    fontSize: 14,
  },
  emptyAction: {
    marginTop: 10,
  },

  filtersButton: {
    flexDirection: "row",
    gap: 6,
  },
  //!OLD FILTER CHIP SCROLL VIEW VERSION
  /*  filterCountBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  }, */
  activeFiltersScroll: {
    maxHeight: 42,
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 6,
  },
  activeFiltersContent: {
    paddingHorizontal: 16,
    paddingVertical: 3,
    alignItems: "center",
    gap: 8,
  },
  activeFilterChip: {
    maxWidth: 210,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderRadius: 16,
  },
  clearFiltersButton: {
    minHeight: 30,
    justifyContent: "center",
    paddingHorizontal: 5,
  },

  filterControlsWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
    //zIndex: 100,
  },

  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  filterChipsWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    //zIndex: 100,
  },

  filterChip: {
    minHeight: 30,
    flexShrink: 0,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountBadge: {
    position: "absolute",
    right: -3,
    top: -3,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  activeFiltersWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
});
