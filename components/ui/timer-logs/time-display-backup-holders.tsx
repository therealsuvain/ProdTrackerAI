/**
 * TimerDisplay — circle only. No ScrollView inside the circle ever.
 *
 * Why: ScrollViews inside overflow:hidden + backfaceVisibility containers
 * are broken on Android — the compositor can't handle them, causing flicker
 * and gesture conflicts regardless of implementation approach.
 *
 * New model:
 * - Circle shows text only (either elapsed time or countdown target)
 * - Coin flip works cleanly because both faces are pure text — no ScrollViews
 * - Countdown picker lives in a sibling component (CountdownPickerPanel)
 *   exported from this file, rendered by timer-screen.tsx below the circle
 * - Picker slides in/out with a simple opacity+translateY animation
 */

import { ThemeContext } from "@/context/ThemeContext";
import { TimerMode } from "@/context/TimerContext";
import { useContext, useRef, useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Animated,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE          = 250;
const RADIUS        = 125;
const STROKE        = 6;
const CIRCLE_R      = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
const FLIP_DURATION = 380;

const ITEM_HEIGHT   = 48;
const VISIBLE_ROWS  = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SCROLL_PAD    = ITEM_HEIGHT;

const HOURS        = Array.from({ length: 24 }, (_, i) => i);
const MINUTES      = Array.from({ length: 60 }, (_, i) => i);
const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const withAlpha = (hex: string, alpha: string): string =>
  `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

const pad = (n: number) => n.toString().padStart(2, "0");

const toTimeStr = (seconds: number) =>
  `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;

// ─── TimerDisplay Props ───────────────────────────────────────────────────────

interface TimerDisplayProps {
  time:            number;
  mode:            TimerMode;
  countdownTarget: number;
  isRunning:       boolean;
  onToggleMode:    () => void;
}

// ─── TimerDisplay ─────────────────────────────────────────────────────────────

export default function TimerDisplay({
  time,
  mode,
  countdownTarget,
  isRunning,
  onToggleMode,
}: TimerDisplayProps) {
  const { theme } = useContext(ThemeContext);

  // ── Flip ──────────────────────────────────────────────────────────────────
  // useState so re-render fires after flip, recalculating outputRange ternaries
  const [showingFront, setShowingFront] = useState(true);
  const showingFrontRef = useRef(true); // ref for use inside callback (no stale closure)
  const flipAnim        = useRef(new Animated.Value(0)).current;
  const isFlipping      = useRef(false);

  const triggerFlip = () => {
    if (isRunning || isFlipping.current) return;
    isFlipping.current = true;
    onToggleMode();
    flipAnim.setValue(0);
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: FLIP_DURATION,
      useNativeDriver: true,
    }).start(() => {
      const next = !showingFrontRef.current;
      showingFrontRef.current = next;
      setShowingFront(next);
      isFlipping.current = false;
      flipAnim.setValue(0);
    });
  };

  // showingFront=true  → Face A (stopwatch) visible now, flipping away; B coming in
  // showingFront=false → Face B (countdown)  visible now, flipping away; A coming in
  const aRotate = flipAnim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: showingFront
      ? ["0deg", "90deg", "90deg"]
      : ["-90deg", "-90deg", "0deg"],
  });
  const bRotate = flipAnim.interpolate({
    inputRange:  [0, 0.5, 1],
    outputRange: showingFront
      ? ["-90deg", "-90deg", "0deg"]
      : ["0deg", "90deg", "90deg"],
  });

  // ── Pulse ─────────────────────────────────────────────────────────────────
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const prevSecond = useRef(-1);
  useEffect(() => {
    if (mode !== "stopwatch" || !isRunning) return;
    const s = Math.floor(time);
    if (s !== prevSecond.current) {
      prevSecond.current = s;
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.025, duration: 100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,     duration: 100, useNativeDriver: true }),
      ]).start();
    }
  }, [time, mode, isRunning]);

  // ── SVG drain ring ────────────────────────────────────────────────────────
  const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
  const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
  const ringColor  = mode === "countdown" && time <= 10 && time > 0
    ? "#ef4444" : theme.timerBase;

  // ── Face content ──────────────────────────────────────────────────────────
  // Both faces are pure Text — no ScrollViews, no gesture conflicts
  // Face A: elapsed stopwatch time
  // Face B: countdown target time (static — picker is outside the circle)
  const faceA = <Text style={[faceStyles.time, { color: theme.timerBase }]}>{toTimeStr(time)}</Text>;
  const faceB = (
    <View style={faceStyles.countdownFace}>
     {/*  <Text style={[faceStyles.countdownLabel, { color: withAlpha(theme.timerBase, "88") }]}>
        {isRunning ? "REMAINING" : "SET TIME"}
      </Text> */}
      <Text style={[faceStyles.time, { color: theme.timerBase }]}>
        {toTimeStr(isRunning ? time : countdownTarget)}
      </Text>
      {/* {!isRunning && (
        <Text style={[faceStyles.hint, { color: withAlpha(theme.timerBase, "66") }]}>
          scroll below to set
        </Text>
      )} */}
    </View>
  );

  const renderFace = (
    rotateY:    Animated.AnimatedInterpolation<string>,
    isAbsolute: boolean,
    content:    React.ReactNode
  ) => (
    <Animated.View style={[
      styles.face,
      isAbsolute && styles.absoluteFace,
      { borderColor: withAlpha(theme.timerBase, "44") },
      { transform: [{ perspective: 800 }, { rotateY }],
        backfaceVisibility: "hidden" },
    ]}>
      {content}
    </Animated.View>
  );

  return (
    <TouchableOpacity
      onLongPress={triggerFlip}
      delayLongPress={350}
      activeOpacity={0.9}
      disabled={isRunning}
    >
      <Animated.View style={[styles.outer, { transform: [{ scale: pulseAnim }] }]}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle
            cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
            stroke={withAlpha(theme.timerBase, "22")}
            strokeWidth={STROKE} fill="none"
          />
          <Circle
            cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
            stroke={ringColor}
            strokeWidth={STROKE} fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${SIZE/2}, ${SIZE/2}`}
          />
        </Svg>

        {renderFace(aRotate, false, faceA)}
        {renderFace(bRotate, true,  faceB)}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── CountdownPickerPanel ─────────────────────────────────────────────────────
// Exported separately — rendered by timer-screen.tsx below the circle.
// Slides in when mode=countdown and not running, slides out otherwise.
// Pure ScrollViews with no parent gesture conflicts whatsoever.

interface CountdownPickerPanelProps {
  visible:         boolean; // mode === "countdown" && !isRunning
  countdownTarget: number;
  onChange:        (seconds: number) => void;
  color:           string;
}

export function CountdownPickerPanel({
  visible,
  countdownTarget,
  onChange,
  color,
}: CountdownPickerPanelProps) {
  // Slide + fade animation
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const translateY = anim.interpolate({
    inputRange: [0, 1], outputRange: [20, 0],
  });

  // Picker values held in refs — no re-render on scroll
  const initH = Math.floor(countdownTarget / 3600);
  const initM = Math.floor((countdownTarget % 3600) / 60);
  const initS = countdownTarget % 60;

  const hVal = useRef(initH);
  const mVal = useRef(initM);
  const sVal = useRef(initS);

  const hRef = useRef<ScrollView | null>(null);
  const mRef = useRef<ScrollView | null>(null);
  const sRef = useRef<ScrollView | null>(null);

  // Scroll to reflect countdownTarget when panel becomes visible.
  // Uses countdownTarget as dep so if user edits it externally (rare) it syncs.
  useEffect(() => {
    if (!visible) return;
    const newH = Math.floor(countdownTarget / 3600);
    const newM = Math.floor((countdownTarget % 3600) / 60);
    const newS = countdownTarget % 60;
    hVal.current = newH;
    mVal.current = newM;
    sVal.current = newS;
    const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
      setTimeout(() => r.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false }), 50);
    go(hRef, newH);
    go(mRef, newM);
    go(sRef, newS);
  }, [visible]); // only on visibility change, not every countdownTarget tick

  const commit = () =>
    onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

  const makeHandler =
    (ref: React.MutableRefObject<number>, list: number[]) =>
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
      commit();
    };

  const column = (
    list:    number[],
    ref:     React.RefObject<ScrollView | null>,
    handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
    label:   string
  ) => (
    <View style={pickerStyles.col}>
      <Text style={[pickerStyles.label, { color: withAlpha(color, "88") }]}>
        {label}
      </Text>
      <ScrollView
        ref={ref}
        style={{ height: PICKER_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handler}
        contentContainerStyle={{ paddingVertical: SCROLL_PAD }}
        scrollEventThrottle={16}
        directionalLockEnabled
      >
        {list.map((v) => (
          <View key={v} style={pickerStyles.item}>
            <Text style={[pickerStyles.digit, { color }]}>
              {v.toString().padStart(2, "0")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  // Always rendered but opacity-animated — keeps ScrollView refs alive
  return (
    <Animated.View style={[
      pickerStyles.panel,
      { opacity: anim, transform: [{ translateY }] },
      !visible && { pointerEvents: "none" } as any,
    ]}>
      {/* Selection band */}
      <View
        pointerEvents="none"
        style={[pickerStyles.band, { borderColor: withAlpha(color, "55") }]}
      />
      <View style={pickerStyles.row}>
        {column(HOURS,        hRef, makeHandler(hVal, HOURS),        "HH")}
        <Text style={[pickerStyles.colon, { color }]}>:</Text>
        {column(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MM")}
        <Text style={[pickerStyles.colon, { color }]}>:</Text>
        {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SS")}
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outer: {
    width: SIZE, height: SIZE,
    alignItems: "center", justifyContent: "center",
  },
  face: {
    width: SIZE, height: SIZE,
    borderRadius: RADIUS, borderWidth: 2,
    justifyContent: "center", alignItems: "center",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  absoluteFace: { position: "absolute" },
});

const faceStyles = StyleSheet.create({
  time: {
    fontSize: 40,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 2,
  },
  countdownFace: {
    alignItems: "center",
    justifyContent: "center",
  },
  countdownLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 6,
  },
  hint: {
    fontSize: 10,
    marginTop: 6,
    letterSpacing: 0.5,
  },
});

const pickerStyles = StyleSheet.create({
  panel: {
    width: "100%",
    alignItems: "center",
    position: "relative",
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  col:   { alignItems: "center", width: 72 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
  item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
  digit: { fontSize: 32, fontWeight: "600" },
  colon: { fontSize: 28, fontWeight: "700", marginTop: 14, marginHorizontal: 4 },
  band:  {
    position: "absolute",
    top: ITEM_HEIGHT + 22, // label(~22) + top padding row
    left: 0, right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
});
//!PICKER MODAL BACKUP
// import { ThemeContext } from "@/context/ThemeContext";
// import { TimerMode } from "@/context/TimerContext";
// import { useContext, useRef, useEffect, useState } from "react";
// import {
//   Text,
//   StyleSheet,
//   View,
//   Animated,
//   ScrollView,
//   NativeSyntheticEvent,
//   NativeScrollEvent,
//   TouchableOpacity,
//   Modal,
//   Pressable,
// } from "react-native";
// import Svg, { Circle } from "react-native-svg";

// // ─── Constants ────────────────────────────────────────────────────────────────

// const SIZE          = 250;
// const RADIUS        = 125;
// const STROKE        = 6;
// const CIRCLE_R      = (SIZE - STROKE) / 2;
// const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
// const FLIP_DURATION = 380;
// const ITEM_HEIGHT   = 48;
// const VISIBLE_ROWS  = 3;
// const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
// const SCROLL_PAD    = ITEM_HEIGHT;

// const HOURS        = Array.from({ length: 24 }, (_, i) => i);
// const MINUTES      = Array.from({ length: 60 }, (_, i) => i);
// const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const withAlpha = (hex: string, alpha: string): string =>
//   `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

// const pad = (n: number) => n.toString().padStart(2, "0");

// const toTimeStr = (s: number) =>
//   `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// // ─── Props ────────────────────────────────────────────────────────────────────

// interface TimerDisplayProps {
//   time:                    number;
//   mode:                    TimerMode;
//   countdownTarget:         number;
//   isRunning:               boolean;
//   onToggleMode:            () => void;
//   onCountdownTargetChange: (seconds: number) => void;
// }

// // ─── Component ────────────────────────────────────────────────────────────────

// export default function TimerDisplay({
//   time,
//   mode,
//   countdownTarget,
//   isRunning,
//   onToggleMode,
//   onCountdownTargetChange,
// }: TimerDisplayProps) {
//   const { theme } = useContext(ThemeContext);

//   // ── Flip state ────────────────────────────────────────────────────────────
//   // showingFront=true  → Face A (stopwatch) facing user
//   // showingFront=false → Face B (countdown) facing user
//   const [showingFront, setShowingFront] = useState(true);
//   const showingFrontRef = useRef(true);
//   const flipAnim        = useRef(new Animated.Value(0)).current;
//   const isFlipping      = useRef(false);

//   // ── Sync showingFront with mode prop ─────────────────────────────────────
//   // When context resets mode externally (e.g. stop() resets to "stopwatch"),
//   // showingFront must follow — otherwise the circle shows the wrong face
//   // while the timer runs in a different mode behind the scenes.
//   useEffect(() => {
//     const shouldShowFront = mode === "stopwatch";
//     if (shouldShowFront !== showingFront && !isFlipping.current) {
//       showingFrontRef.current = shouldShowFront;
//       setShowingFront(shouldShowFront);
//       flipAnim.setValue(0); // reset animation value to clean state
//     }
//   }, [mode]);

//   // ── Picker modal ──────────────────────────────────────────────────────────
//   const [pickerVisible, setPickerVisible] = useState(false);

//   const handleTap = () => {
//     // Regular tap: open picker only in countdown mode and when not running
//     if (mode === "countdown" && !isRunning) {
//       setPickerVisible(true);
//     }
//   };

//   const handleLongPress = () => {
//     if (isRunning || isFlipping.current) return;
//     isFlipping.current = true;
//     onToggleMode();
//     flipAnim.setValue(0);
//     Animated.timing(flipAnim, {
//       toValue: 1,
//       duration: FLIP_DURATION,
//       useNativeDriver: true,
//     }).start(() => {
//       const next = !showingFrontRef.current;
//       showingFrontRef.current = next;
//       setShowingFront(next);
//       isFlipping.current = false;
//       flipAnim.setValue(0);
//     });
//   };

//   // Interpolations — recalculate every render because showingFront is state
//   const aRotate = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: showingFront
//       ? ["0deg",   "90deg",  "90deg" ]
//       : ["-90deg", "-90deg", "0deg"  ],
//   });
//   const bRotate = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: showingFront
//       ? ["-90deg", "-90deg", "0deg"  ]
//       : ["0deg",   "90deg",  "90deg" ],
//   });

//   // ── Pulse ─────────────────────────────────────────────────────────────────
//   const pulseAnim  = useRef(new Animated.Value(1)).current;
//   const prevSecond = useRef(-1);
//   useEffect(() => {
//     if (mode !== "stopwatch" || !isRunning) return;
//     const s = Math.floor(time);
//     if (s !== prevSecond.current) {
//       prevSecond.current = s;
//       Animated.sequence([
//         Animated.timing(pulseAnim, { toValue: 1.025, duration: 100, useNativeDriver: true }),
//         Animated.timing(pulseAnim, { toValue: 1,     duration: 100, useNativeDriver: true }),
//       ]).start();
//     }
//   }, [time, mode, isRunning]);

//   // ── SVG drain ring ────────────────────────────────────────────────────────
//   const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
//   const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
//   const ringColor  = mode === "countdown" && time <= 10 && time > 0
//     ? "#ef4444" : theme.timerBase;

//   // ── Face content — pure Text only, no ScrollViews ────────────────────────
//   // Face A: stopwatch elapsed
//   const faceA = (
//     <Text style={[faceStyles.time, { color: theme.timerBase }]}>
//       {toTimeStr(time)}
//     </Text>
//   );

//   // Face B: countdown — shows remaining when running, target when stopped
//   // No label text above/below — caused the flicker you fixed
//   const faceB = (
//     <Text style={[faceStyles.time, { color: theme.timerBase }]}>
//       {toTimeStr(isRunning ? time : countdownTarget)}
//     </Text>
//   );

//   const renderFace = (
//     rotateY:    Animated.AnimatedInterpolation<string>,
//     isAbsolute: boolean,
//     content:    React.ReactNode
//   ) => (
//     <Animated.View style={[
//       styles.face,
//       isAbsolute && styles.absoluteFace,
//       { borderColor: withAlpha(theme.timerBase, "44") },
//       { transform: [{ perspective: 800 }, { rotateY }],
//         backfaceVisibility: "hidden" },
//     ]}>
//       {content}
//     </Animated.View>
//   );

//   return (
//     <>
//       <TouchableOpacity
//         onPress={handleTap}
//         onLongPress={handleLongPress}
//         delayLongPress={350}
//         activeOpacity={isRunning ? 1 : 0.85}
//       >
//         <Animated.View style={[styles.outer, { transform: [{ scale: pulseAnim }] }]}>
//           <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
//             <Circle
//               cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//               stroke={withAlpha(theme.timerBase, "22")}
//               strokeWidth={STROKE} fill="none"
//             />
//             <Circle
//               cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//               stroke={ringColor}
//               strokeWidth={STROKE} fill="none"
//               strokeDasharray={CIRCUMFERENCE}
//               strokeDashoffset={dashOffset}
//               strokeLinecap="round"
//               rotation="-90"
//               origin={`${SIZE/2}, ${SIZE/2}`}
//             />
//           </Svg>

//           {renderFace(aRotate, false, faceA)}
//           {renderFace(bRotate, true,  faceB)}
//         </Animated.View>
//       </TouchableOpacity>

//       {/* Picker modal — opens on regular tap in countdown mode */}
//       <CountdownPickerModal
//         visible={pickerVisible}
//         countdownTarget={countdownTarget}
//         onChange={onCountdownTargetChange}
//         onClose={() => setPickerVisible(false)}
//         color={theme.timerBase}
//         darkBg={theme.timerDarkPrimary}
//       />
//     </>
//   );
// }

// // ─── Countdown Picker Modal ───────────────────────────────────────────────────

// interface CountdownPickerModalProps {
//   visible:         boolean;
//   countdownTarget: number;
//   onChange:        (seconds: number) => void;
//   onClose:         () => void;
//   color:           string;
//   darkBg:          string;
// }

// function CountdownPickerModal({
//   visible,
//   countdownTarget,
//   onChange,
//   onClose,
//   color,
//   darkBg,
// }: CountdownPickerModalProps) {
//   const initH = Math.floor(countdownTarget / 3600);
//   const initM = Math.floor((countdownTarget % 3600) / 60);
//   const initS = countdownTarget % 60;

//   const hVal = useRef(initH);
//   const mVal = useRef(initM);
//   const sVal = useRef(initS);

//   const hRef = useRef<ScrollView | null>(null);
//   const mRef = useRef<ScrollView | null>(null);
//   const sRef = useRef<ScrollView | null>(null);

//   // Sync scroll position each time modal opens
//   useEffect(() => {
//     if (!visible) return;
//     const newH = Math.floor(countdownTarget / 3600);
//     const newM = Math.floor((countdownTarget % 3600) / 60);
//     const newS = countdownTarget % 60;
//     hVal.current = newH;
//     mVal.current = newM;
//     sVal.current = newS;
//     const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
//       setTimeout(() => r.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false }), 80);
//     go(hRef, newH);
//     go(mRef, newM);
//     go(sRef, newS);
//   }, [visible]);

//   const commit = () =>
//     onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

//   const makeHandler =
//     (ref: React.MutableRefObject<number>, list: number[]) =>
//     (e: NativeSyntheticEvent<NativeScrollEvent>) => {
//       const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
//       ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
//       commit();
//     };

//   const column = (
//     list:    number[],
//     ref:     React.RefObject<ScrollView | null>,
//     handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
//     label:   string
//   ) => (
//     <View style={modalStyles.col}>
//       <Text style={[modalStyles.label, { color: withAlpha(color, "88") }]}>
//         {label}
//       </Text>
//       <ScrollView
//         ref={ref}
//         style={{ height: PICKER_HEIGHT }}
//         showsVerticalScrollIndicator={false}
//         snapToInterval={ITEM_HEIGHT}
//         decelerationRate="fast"
//         onMomentumScrollEnd={handler}
//         contentContainerStyle={{ paddingVertical: SCROLL_PAD }}
//         scrollEventThrottle={16}
//         directionalLockEnabled
//       >
//         {list.map((v) => (
//           <View key={v} style={modalStyles.item}>
//             <Text style={[modalStyles.digit, { color }]}>
//               {v.toString().padStart(2, "0")}
//             </Text>
//           </View>
//         ))}
//       </ScrollView>
//     </View>
//   );

//   return (
//     <Modal
//       visible={visible}
//       transparent
//       animationType="fade"
//       onRequestClose={onClose}
//       statusBarTranslucent
//     >
//       {/* Tap backdrop to close */}
//       <Pressable style={modalStyles.backdrop} onPress={onClose}>
//         {/* Stop tap propagation so tapping inside doesn't close */}
//         <Pressable style={[modalStyles.card, { backgroundColor: darkBg, borderColor: withAlpha(color, "44") }]}>
//           <Text style={[modalStyles.title, { color }]}>Set Countdown</Text>

//           <View style={modalStyles.row}>
//             {/* Selection band behind columns */}
//             <View
//               pointerEvents="none"
//               style={[modalStyles.band, { borderColor: withAlpha(color, "55") }]}
//             />
//             {column(HOURS,        hRef, makeHandler(hVal, HOURS),        "HOURS")}
//             <Text style={[modalStyles.colon, { color }]}>:</Text>
//             {column(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MIN")}
//             <Text style={[modalStyles.colon, { color }]}>:</Text>
//             {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SEC")}
//           </View>

//           <TouchableOpacity
//             style={[modalStyles.doneBtn, { backgroundColor: color }]}
//             onPress={onClose}
//             activeOpacity={0.8}
//           >
//             <Text style={modalStyles.doneBtnText}>Done</Text>
//           </TouchableOpacity>
//         </Pressable>
//       </Pressable>
//     </Modal>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const styles = StyleSheet.create({
//   outer: {
//     width: SIZE, height: SIZE,
//     alignItems: "center", justifyContent: "center",
//   },
//   face: {
//     width: SIZE, height: SIZE,
//     borderRadius: RADIUS, borderWidth: 2,
//     justifyContent: "center", alignItems: "center",
//     overflow: "hidden",
//     backgroundColor: "transparent",
//   },
//   absoluteFace: { position: "absolute" },
// });

// const faceStyles = StyleSheet.create({
//   time: {
//     fontSize: 40,
//     fontWeight: "bold",
//     textAlign: "center",
//     letterSpacing: 2,
//   },
// });

// const modalStyles = StyleSheet.create({
//   backdrop: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.6)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   card: {
//     width: 320,
//     borderRadius: 20,
//     borderWidth: 1,
//     padding: 24,
//     alignItems: "center",
//   },
//   title: {
//     fontSize: 16,
//     fontWeight: "700",
//     letterSpacing: 1,
//     marginBottom: 20,
//     textTransform: "uppercase",
//   },
//   row: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "relative",
//     width: "100%",
//   },
//   col:   { alignItems: "center", flex: 1 },
//   label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
//   item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
//   digit: { fontSize: 32, fontWeight: "600" },
//   colon: { fontSize: 28, fontWeight: "700", marginTop: 18, marginHorizontal: 2 },
//   band:  {
//     position: "absolute",
//     // label (~22px) + top padding row
//     top: 22 + ITEM_HEIGHT,
//     left: 0, right: 0,
//     height: ITEM_HEIGHT,
//     borderTopWidth: 1,
//     borderBottomWidth: 1,
//   },
//   doneBtn: {
//     marginTop: 24,
//     width: "100%",
//     paddingVertical: 13,
//     borderRadius: 12,
//     alignItems: "center",
//   },
//   doneBtnText: {
//     color: "#000",
//     fontWeight: "800",
//     fontSize: 15,
//   },
// });
//! v4
// import { ThemeContext } from "@/context/ThemeContext";
// import { TimerMode } from "@/context/TimerContext";
// import { useContext, useRef, useEffect, useState } from "react";
// import {
//   Text,
//   StyleSheet,
//   View,
//   Animated,
//   ScrollView,
//   NativeSyntheticEvent,
//   NativeScrollEvent,
//   TouchableOpacity,
//   Modal,
//   Pressable,
// } from "react-native";
// import Svg, { Circle } from "react-native-svg";

// // ─── Constants ────────────────────────────────────────────────────────────────

// const SIZE          = 250;
// const RADIUS        = 125;
// const STROKE        = 6;
// const CIRCLE_R      = (SIZE - STROKE) / 2;
// const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
// const FLIP_DURATION = 380;
// const ITEM_HEIGHT   = 48;
// const VISIBLE_ROWS  = 3;
// const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
// const SCROLL_PAD    = ITEM_HEIGHT;

// const HOURS        = Array.from({ length: 24 }, (_, i) => i);
// const MINUTES      = Array.from({ length: 60 }, (_, i) => i);
// const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const withAlpha = (hex: string, alpha: string): string =>
//   `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

// const pad = (n: number) => n.toString().padStart(2, "0");

// const toTimeStr = (s: number) =>
//   `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

// // ─── Props ────────────────────────────────────────────────────────────────────

// interface TimerDisplayProps {
//   time:                    number;
//   mode:                    TimerMode;
//   countdownTarget:         number;
//   isRunning:               boolean;
//   onToggleMode:            () => void;
//   onCountdownTargetChange: (seconds: number) => void;
// }

// // ─── Component ────────────────────────────────────────────────────────────────

// export default function TimerDisplay({
//   time,
//   mode,
//   countdownTarget,
//   isRunning,
//   onToggleMode,
//   onCountdownTargetChange,
// }: TimerDisplayProps) {
//   const { theme } = useContext(ThemeContext);

//   // ── Flip state ────────────────────────────────────────────────────────────
//   // showingFront=true  → Face A (stopwatch) facing user
//   // showingFront=false → Face B (countdown) facing user
//   const [showingFront, setShowingFront] = useState(true);
//   const showingFrontRef = useRef(true);
//   const flipAnim        = useRef(new Animated.Value(0)).current;
//   const isFlipping      = useRef(false);

//   // ── Sync showingFront with mode prop ─────────────────────────────────────
//   // When context resets mode externally (e.g. stop() resets to "stopwatch"),
//   // showingFront must follow — otherwise the circle shows the wrong face
//   // while the timer runs in a different mode behind the scenes.
//   useEffect(() => {
//     const shouldShowFront = mode === "stopwatch";
//     if (shouldShowFront !== showingFront && !isFlipping.current) {
//       showingFrontRef.current = shouldShowFront;
//       setShowingFront(shouldShowFront);
//       flipAnim.setValue(0); // reset animation value to clean state
//     }
//   }, [mode]);

//   // ── Picker modal ──────────────────────────────────────────────────────────
//   const [pickerVisible, setPickerVisible] = useState(false);

//   const handleTap = () => {
//     // Regular tap: open picker only in countdown mode and when not running
//     if (mode === "countdown" && !isRunning) {
//       setPickerVisible(true);
//     }
//   };

//   const handleLongPress = () => {
//     if (isRunning || isFlipping.current) return;
//     isFlipping.current = true;
//     onToggleMode();
//     flipAnim.setValue(0);
//     Animated.timing(flipAnim, {
//       toValue: 1,
//       duration: FLIP_DURATION,
//       useNativeDriver: true,
//     }).start(() => {
//       const next = !showingFrontRef.current;
//       showingFrontRef.current = next;
//       setShowingFront(next);
//       isFlipping.current = false;
//       flipAnim.setValue(0);
//     });
//   };

//   // Interpolations — recalculate every render because showingFront is state
//   const aRotate = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: showingFront
//       ? ["0deg",   "90deg",  "90deg" ]
//       : ["-90deg", "-90deg", "0deg"  ],
//   });
//   const bRotate = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: showingFront
//       ? ["-90deg", "-90deg", "0deg"  ]
//       : ["0deg",   "90deg",  "90deg" ],
//   });

//   // ── Pulse ─────────────────────────────────────────────────────────────────
//   const pulseAnim  = useRef(new Animated.Value(1)).current;
//   const prevSecond = useRef(-1);
//   useEffect(() => {
//     if (mode !== "stopwatch" || !isRunning) return;
//     const s = Math.floor(time);
//     if (s !== prevSecond.current) {
//       prevSecond.current = s;
//       Animated.sequence([
//         Animated.timing(pulseAnim, { toValue: 1.025, duration: 100, useNativeDriver: true }),
//         Animated.timing(pulseAnim, { toValue: 1,     duration: 100, useNativeDriver: true }),
//       ]).start();
//     }
//   }, [time, mode, isRunning]);

//   // ── SVG drain ring ────────────────────────────────────────────────────────
//   const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
//   const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
//   const ringColor  = mode === "countdown" && time <= 10 && time > 0
//     ? "#ef4444" : theme.timerBase;

//   // ── Face content — pure Text only, no ScrollViews ────────────────────────
//   // Face A: stopwatch elapsed
//   const faceA = (
//     <Text style={[faceStyles.time, { color: theme.timerBase }]}>
//       {toTimeStr(time)}
//     </Text>
//   );

//   // Face B: countdown — shows remaining when running, target when stopped
//   // No label text above/below — caused the flicker you fixed
//   const faceB = (
//     <Text style={[faceStyles.time, { color: theme.timerBase }]}>
//       {toTimeStr(isRunning ? time : countdownTarget)}
//     </Text>
//   );

//   const renderFace = (
//     rotateY:    Animated.AnimatedInterpolation<string>,
//     isAbsolute: boolean,
//     content:    React.ReactNode
//   ) => (
//     <Animated.View style={[
//       styles.face,
//       isAbsolute && styles.absoluteFace,
//       { borderColor: withAlpha(theme.timerBase, "44") },
//       { transform: [{ perspective: 800 }, { rotateY }],
//         backfaceVisibility: "hidden" },
//     ]}>
//       {content}
//     </Animated.View>
//   );

//   return (
//     <>
//       <TouchableOpacity
//         onPress={handleTap}
//         onLongPress={handleLongPress}
//         delayLongPress={350}
//         activeOpacity={isRunning ? 1 : 0.85}
//       >
//         <Animated.View style={[styles.outer, { transform: [{ scale: pulseAnim }] }]}>
//           <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
//             <Circle
//               cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//               stroke={withAlpha(theme.timerBase, "22")}
//               strokeWidth={STROKE} fill="none"
//             />
//             <Circle
//               cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//               stroke={ringColor}
//               strokeWidth={STROKE} fill="none"
//               strokeDasharray={CIRCUMFERENCE}
//               strokeDashoffset={dashOffset}
//               strokeLinecap="round"
//               rotation="-90"
//               origin={`${SIZE/2}, ${SIZE/2}`}
//             />
//           </Svg>

//           {renderFace(aRotate, false, faceA)}
//           {renderFace(bRotate, true,  faceB)}
//         </Animated.View>
//       </TouchableOpacity>

//       {/* Picker modal — opens on regular tap in countdown mode */}
//       <CountdownPickerModal
//         visible={pickerVisible}
//         countdownTarget={countdownTarget}
//         onChange={onCountdownTargetChange}
//         onClose={() => setPickerVisible(false)}
//         color={theme.timerBase}
//         darkBg={theme.timerDarkPrimary}
//       />
//     </>
//   );
// }

// // ─── Countdown Picker Modal ───────────────────────────────────────────────────

// interface CountdownPickerModalProps {
//   visible:         boolean;
//   countdownTarget: number;
//   onChange:        (seconds: number) => void;
//   onClose:         () => void;
//   color:           string;
//   darkBg:          string;
// }

// function CountdownPickerModal({
//   visible,
//   countdownTarget,
//   onChange,
//   onClose,
//   color,
//   darkBg,
// }: CountdownPickerModalProps) {
//   const initH = Math.floor(countdownTarget / 3600);
//   const initM = Math.floor((countdownTarget % 3600) / 60);
//   const initS = countdownTarget % 60;

//   const hVal = useRef(initH);
//   const mVal = useRef(initM);
//   const sVal = useRef(initS);

//   const hRef = useRef<ScrollView | null>(null);
//   const mRef = useRef<ScrollView | null>(null);
//   const sRef = useRef<ScrollView | null>(null);

//   // Sync scroll position each time modal opens
//   useEffect(() => {
//     if (!visible) return;
//     const newH = Math.floor(countdownTarget / 3600);
//     const newM = Math.floor((countdownTarget % 3600) / 60);
//     const newS = countdownTarget % 60;
//     hVal.current = newH;
//     mVal.current = newM;
//     sVal.current = newS;
//     const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
//       setTimeout(() => r.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false }), 80);
//     go(hRef, newH);
//     go(mRef, newM);
//     go(sRef, newS);
//   }, [visible]);

//   const commit = () =>
//     onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

//   const makeHandler =
//     (ref: React.MutableRefObject<number>, list: number[]) =>
//     (e: NativeSyntheticEvent<NativeScrollEvent>) => {
//       const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
//       ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
//       commit();
//     };

//   const column = (
//     list:    number[],
//     ref:     React.RefObject<ScrollView | null>,
//     handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
//     label:   string
//   ) => (
//     <View style={modalStyles.col}>
//       <Text style={[modalStyles.label, { color: withAlpha(color, "88") }]}>
//         {label}
//       </Text>
//       <ScrollView
//         ref={ref}
//         style={{ height: PICKER_HEIGHT }}
//         showsVerticalScrollIndicator={false}
//         snapToInterval={ITEM_HEIGHT}
//         decelerationRate="fast"
//         onMomentumScrollEnd={handler}
//         contentContainerStyle={{ paddingVertical: SCROLL_PAD }}
//         scrollEventThrottle={16}
//         directionalLockEnabled
//       >
//         {list.map((v) => (
//           <View key={v} style={modalStyles.item}>
//             <Text style={[modalStyles.digit, { color }]}>
//               {v.toString().padStart(2, "0")}
//             </Text>
//           </View>
//         ))}
//       </ScrollView>
//     </View>
//   );

//   return (
//     <Modal
//       visible={visible}
//       transparent
//       animationType="fade"
//       onRequestClose={onClose}
//       statusBarTranslucent
//     >
//       {/* Tap backdrop to close */}
//       <Pressable style={modalStyles.backdrop} onPress={onClose}>
//         {/* Stop tap propagation so tapping inside doesn't close */}
//         <Pressable style={[modalStyles.card, { backgroundColor: darkBg, borderColor: withAlpha(color, "44") }]}>
//           <Text style={[modalStyles.title, { color }]}>Set Countdown</Text>

//           <View style={modalStyles.row}>
//             {/* Selection band behind columns */}
//             <View
//               pointerEvents="none"
//               style={[modalStyles.band, { borderColor: withAlpha(color, "55") }]}
//             />
//             {column(HOURS,        hRef, makeHandler(hVal, HOURS),        "HOURS")}
//             <Text style={[modalStyles.colon, { color }]}>:</Text>
//             {column(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MIN")}
//             <Text style={[modalStyles.colon, { color }]}>:</Text>
//             {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SEC")}
//           </View>

//           <TouchableOpacity
//             style={[modalStyles.doneBtn, { backgroundColor: color }]}
//             onPress={onClose}
//             activeOpacity={0.8}
//           >
//             <Text style={modalStyles.doneBtnText}>Done</Text>
//           </TouchableOpacity>
//         </Pressable>
//       </Pressable>
//     </Modal>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const styles = StyleSheet.create({
//   outer: {
//     width: SIZE, height: SIZE,
//     alignItems: "center", justifyContent: "center",
//   },
//   face: {
//     width: SIZE, height: SIZE,
//     borderRadius: RADIUS, borderWidth: 2,
//     justifyContent: "center", alignItems: "center",
//     overflow: "hidden",
//     backgroundColor: "transparent",
//   },
//   absoluteFace: { position: "absolute" },
// });

// const faceStyles = StyleSheet.create({
//   time: {
//     fontSize: 40,
//     fontWeight: "bold",
//     textAlign: "center",
//     letterSpacing: 2,
//   },
// });

// const modalStyles = StyleSheet.create({
//   backdrop: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.6)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   card: {
//     width: 320,
//     borderRadius: 20,
//     borderWidth: 1,
//     padding: 24,
//     alignItems: "center",
//   },
//   title: {
//     fontSize: 16,
//     fontWeight: "700",
//     letterSpacing: 1,
//     marginBottom: 20,
//     textTransform: "uppercase",
//   },
//   row: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     position: "relative",
//     width: "100%",
//   },
//   col:   { alignItems: "center", flex: 1 },
//   label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
//   item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
//   digit: { fontSize: 32, fontWeight: "600" },
//   colon: { fontSize: 28, fontWeight: "700", marginTop: 18, marginHorizontal: 2 },
//   band:  {
//     position: "absolute",
//     // label (~22px) + top padding row
//     top: 22 + ITEM_HEIGHT,
//     left: 0, right: 0,
//     height: ITEM_HEIGHT,
//     borderTopWidth: 1,
//     borderBottomWidth: 1,
//   },
//   doneBtn: {
//     marginTop: 24,
//     width: "100%",
//     paddingVertical: 13,
//     borderRadius: 12,
//     alignItems: "center",
//   },
//   doneBtnText: {
//     color: "#000",
//     fontWeight: "800",
//     fontSize: 15,
//   },
// });
//!Latest v3
// import TimerDisplay from "@/components/ui/timer-logs/time-display";
// import TimerLogItem from "@/components/ui/timer-logs/timer-log-item";
// import { XButton } from "@/components/ui/x-button";
// import { ThemeContext } from "@/context/ThemeContext";
// import { formatDuration } from "@/context/TimerContext";
// import { useData } from "@/hooks/use-data";
// import { useTimer } from "@/hooks/use-timer";
// import { TimerLog } from "@/types/timer";
// import { Ionicons } from "@expo/vector-icons";
// import { useContext, useMemo } from "react";
// import {
//   View,
//   Text,
//   Alert,
//   StyleSheet,
//   Button,
//   FlatList,
//   TouchableOpacity,
// } from "react-native";
// import { GestureHandlerRootView } from "react-native-gesture-handler";
// import { TextInput } from "react-native-paper";
// import { Provider } from "react-native-paper";

// const getTodayISO = () => new Date().toISOString().split("T")[0];

// const getWeekStartISO = () => {
//   const d = new Date();
//   d.setDate(d.getDate() - d.getDay()); // back to Sunday
//   return d.toISOString().split("T")[0];
// };

// export default function TimerScreen() {
//   const { theme } = useContext(ThemeContext);
//   const { timerLogs, setTimerLogs } = useData();
//   //const addLog = (log : TimerLog) => setTimerLogs([...timerLogs, log]);
//   const {
//     time,
//     isRunning,
//     title,
//     category,
//     laps,
//     lap,
//     setTitle,
//     setCategory,
//     mode,
//     countdownTarget,
//     toggleMode,
//     setCountdownTarget,
//     start,
//     pause,
//     stop,
//     reset,
//   } = useTimer();

//   const { todayTotal, weekTotal, topCategory } = useMemo(() => {
//     const todayISO = getTodayISO();
//     const weekStartISO = getWeekStartISO();

//     let todayTotal = 0;
//     let weekTotal = 0;
//     const categoryTotals: Record<string, number> = {};

//     for (const log of timerLogs) {
//       if (!log.duration) continue;
//       const logDate =
//         typeof log.startTime === "string"
//           ? log.startTime.split("T")[0]
//           : log.startTime.toISOString().split("T")[0]; // ISO string → date part

//       if (logDate === todayISO) todayTotal += log.duration;
//       if (logDate >= weekStartISO) {
//         weekTotal += log.duration;
//         if (log.category) {
//           categoryTotals[log.category] =
//             (categoryTotals[log.category] ?? 0) + log.duration;
//         }
//       }
//     }

//     // Top category this week by total time
//     const topCategory =
//       Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0]?.[0] ??
//       null;

//     return { todayTotal, weekTotal, topCategory };
//   }, [timerLogs]);

//   // ── Last-used category suggestion ────────────────────────────────────────
//   // Find the most recently saved log that has a category — show as a
//   // one-tap suggestion chip so the user doesn't have to retype it.
//   const lastUsedCategory = useMemo(() => {
//     for (let i = timerLogs.length - 1; i >= 0; i--) {
//       if (timerLogs[i].category) return timerLogs[i].category!;
//     }
//     return null;
//   }, [timerLogs]);

//   const handleDelete = (id: string) => {
//     Alert.alert("Delete Log", "Are you sure?", [
//       { text: "Cancel" },
//       {
//         text: "Delete",
//         onPress: () =>
//           setTimerLogs((prev) => {
//             return prev.filter((log) => log.id !== id);
//           }),
//       },
//     ]);
//   };

//   const handleEdit = (updated: TimerLog) => {
//     setTimerLogs((prev) =>
//       prev.map((l) => (l.id === updated.id ? updated : l)),
//     );
//   };

//   return (
//     <Provider>
//       <GestureHandlerRootView>
//         <View style={[styles.container, { backgroundColor: theme.background }]}>
//           {/* ── Stats row (checkpoint 10) ── */}
//           <View
//             style={[
//               styles.statsRow,
//               { backgroundColor: `${theme.timerBase}18` },
//             ]}
//           >
//             <StatCell
//               label="Today"
//               value={formatDuration(todayTotal)}
//               accent={theme.timerBase}
//             />
//             <View
//               style={[
//                 styles.statDivider,
//                 { backgroundColor: `${theme.timerBase}33` },
//               ]}
//             />
//             <StatCell
//               label="This week"
//               value={formatDuration(weekTotal)}
//               accent={theme.timerBase}
//             />
//             {topCategory && (
//               <>
//                 <View
//                   style={[
//                     styles.statDivider,
//                     { backgroundColor: `${theme.timerBase}33` },
//                   ]}
//                 />
//                 <StatCell
//                   label="Top category"
//                   value={topCategory}
//                   accent={theme.timerBase}
//                 />
//               </>
//             )}
//           </View>
//           <View
//             style={{
//               flexDirection: "row",
//               width: "100%",
//               alignItems: "center",
//               justifyContent: "center",
//             }}
//           >
//             <TextInput
//               placeholder="Activity name"
//               value={title}
//               onChangeText={setTitle}
//               style={styles.input}
//               mode="outlined"
//               activeOutlineColor={theme.timerBase}
//             />
//             <TextInput
//               placeholder="Category (optional)"
//               value={category}
//               onChangeText={setCategory}
//               style={[styles.input, styles.categoryInput]}
//               mode="outlined"
//               activeOutlineColor={theme.timerBase}
//             />
//           </View>

//           <View style={styles.categoryRow}>
//             {/* Last-used suggestion chip — only shown when category field is empty */}
//             {!category && lastUsedCategory && (
//               <TouchableOpacity
//                 style={[
//                   styles.suggestionChip,
//                   { borderColor: theme.timerBase },
//                 ]}
//                 onPress={() => setCategory(lastUsedCategory)}
//                 activeOpacity={0.7}
//               >
//                 <Text
//                   style={[styles.suggestionText, { color: theme.timerBase }]}
//                 >
//                   ↩ {lastUsedCategory}
//                 </Text>
//               </TouchableOpacity>
//             )}
//           </View>
//           <TimerDisplay
//             time={time}
//             mode={mode}
//             countdownTarget={countdownTarget}
//             isRunning={isRunning}
//             onToggleMode={toggleMode}
//             onCountdownTargetChange={setCountdownTarget}
//           />
//           {/* Mode hint below the circle */}
//           <Text style={[styles.modeHint, { color: theme.timerBase }]}>
//             {isRunning
//               ? ""
//               : `Tap circle to switch to ${mode === "stopwatch" ? "countdown" : "stopwatch"}`}
//           </Text>
//           <View style={styles.buttons}>
//             {!isRunning ? (
//               <XButton icon="play" mode="timer" size="big" onPress={start} />
//             ) : (
//               <>
//                 <XButton icon="pause" mode="timer" size="big" onPress={pause} />
//                 <XButton icon="stop" mode="timer" size="big" onPress={stop} />
//                 <XButton icon="flag" mode="timer" size="big" onPress={lap} />
//                 <XButton
//                   icon="refresh"
//                   mode="timer"
//                   size="big"
//                   onPress={reset}
//                 />
//               </>
//             )}
//           </View>
//           {/* ── Lap splits inline display ── */}
//           {laps.length > 0 && (
//             <View
//               style={[
//                 styles.lapsContainer,
//                 { borderColor: `${theme.timerBase}33` },
//               ]}
//             >
//               {laps.map((lapTime, idx) => {
//                 const splitDuration =
//                   idx === 0 ? lapTime : lapTime - laps[idx - 1];
//                 return (
//                   <View key={idx} style={styles.lapRow}>
//                     <Text
//                       style={[
//                         styles.lapLabel,
//                         { color: `${theme.timerBase}99` },
//                       ]}
//                     >
//                       Lap {idx + 1}
//                     </Text>
//                     <Text style={[styles.lapValue, { color: theme.timerBase }]}>
//                       {formatDuration(splitDuration)}
//                     </Text>
//                     <Text
//                       style={[
//                         styles.lapTotal,
//                         { color: `${theme.timerBase}66` },
//                       ]}
//                     >
//                       {formatDuration(lapTime)}
//                     </Text>
//                   </View>
//                 );
//               })}
//             </View>
//           )}

//           <Text style={{ color: "white" }}>Recent Logs</Text>
//           <FlatList
//             data={timerLogs.slice(-10)}
//             keyExtractor={(item) => item.id}
//             style={{ width: "95%" }}
//             showsVerticalScrollIndicator={false}
//             renderItem={({ item }) => (
//               <TimerLogItem
//                 log={item}
//                 onDelete={() => handleDelete(item.id)}
//                 onEdit={handleEdit}
//               />
//             )}
//           />
//         </View>
//       </GestureHandlerRootView>
//     </Provider>
//   );
// }

// function StatCell({
//   label,
//   value,
//   accent,
// }: {
//   label: string;
//   value: string;
//   accent: string;
// }) {
//   return (
//     <View style={styles.statCell}>
//       <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
//       <Text style={[styles.statLabel, { color: accent }]}>{label}</Text>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, padding: 16, alignItems: "center" },
//   buttons: {
//     flexDirection: "row",
//     justifyContent: "center",
//     width: "100%",
//     marginVertical: 16,
//   },
//   statsRow: {
//     flexDirection: "row",
//     width: "100%",
//     borderRadius: 10,
//     paddingVertical: 10,
//     marginBottom: 14,
//   },
//   statCell: { flex: 1, alignItems: "center" },
//   statValue: { fontSize: 14, fontWeight: "700" },
//   statLabel: {
//     fontSize: 10,
//     textTransform: "uppercase",
//     letterSpacing: 0.4,
//     marginTop: 2,
//   },
//   statDivider: { width: 1, marginVertical: 4 },

//   input: { width: "50%", marginBottom: 10, marginHorizontal: 4 },

//   categoryRow: { width: "100%", marginBottom: 6 },
//   categoryInput: { marginBottom: 10 },
//   suggestionChip: {
//     alignSelf: "flex-start",
//     borderWidth: 1,
//     borderRadius: 12,
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     marginTop: 4,
//     marginBottom: 10,
//   },
//   suggestionText: { fontSize: 12, fontWeight: "600" },
//   modeHint: { fontSize: 11, marginTop: 6, marginBottom: 2 },
//   lapsContainer: {
//     width: "95%",
//     borderWidth: 1,
//     borderRadius: 10,
//     paddingHorizontal: 12,
//     paddingVertical: 8,
//     marginBottom: 12,
//   },
//   lapRow: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     paddingVertical: 4,
//   },
//   lapLabel: { fontSize: 12, flex: 1 },
//   lapValue: { fontSize: 12, fontWeight: "700", flex: 1, textAlign: "center" },
//   lapTotal: { fontSize: 11, flex: 1, textAlign: "right" },

//   sectionLabel: {
//     alignSelf: "flex-start",
//     fontSize: 12,
//     fontWeight: "700",
//     textTransform: "uppercase",
//     letterSpacing: 0.5,
//     marginBottom: 6,
//   },
// });



// import { ThemeContext } from "@/context/ThemeContext";
// import { TimerMode } from "@/context/TimerContext";
// import { useContext, useRef, useState, useEffect } from "react";
// import {
//   Text,
//   StyleSheet,
//   View,
//   Animated,
//   ScrollView,
//   NativeSyntheticEvent,
//   NativeScrollEvent,
//   TouchableOpacity,
// } from "react-native";
// import Svg, { Circle } from "react-native-svg";

// // ─── Constants ────────────────────────────────────────────────────────────────

// const SIZE = 250;
// const RADIUS = 125;
// const STROKE = 6;
// const CIRCLE_R = (SIZE - STROKE) / 2;
// const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
// const FLIP_DURATION = 380;
// const ITEM_HEIGHT = 44;
// const HOURS        = Array.from({ length: 24 }, (_, i) => i);
// const MINUTES      = Array.from({ length: 60 }, (_, i) => i);
// const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

// // ─── Alpha helper ─────────────────────────────────────────────────────────────

// const withAlpha = (hex: string, alpha: string): string => {
//   const base = hex.replace("#", "");
//   const six  = base.length === 8 ? base.slice(0, 6) : base.slice(0, 6);
//   return `#${six}${alpha}`;
// };

// // ─── Props ────────────────────────────────────────────────────────────────────

// interface TimerDisplayProps {
//   time:                     number;
//   mode:                     TimerMode;
//   countdownTarget:          number;
//   isRunning:                boolean;
//   onToggleMode:             () => void;
//   onCountdownTargetChange:  (seconds: number) => void;
// }

// // ─── Component ────────────────────────────────────────────────────────────────

// export default function TimerDisplay({
//   time,
//   mode,
//   countdownTarget,
//   isRunning,
//   onToggleMode,
//   onCountdownTargetChange,
// }: TimerDisplayProps) {
//   const { theme } = useContext(ThemeContext);

//   // ── Two independent face contents ─────────────────────────────────────────
//   // The fundamental bug in the previous version: a single `displayMode` state
//   // was shared between both faces. After one flip: front = countdown, back =
//   // countdown. After flipping back: front still = countdown because the state
//   // never correctly separated which face shows what.
//   //
//   // Fix: track front and back content independently.
//   // - frontContent: what the currently-visible face shows RIGHT NOW
//   // - backContent:  what the hidden face shows (pre-loaded for the next flip)
//   //
//   // On each flip:
//   //   1. backContent is already correct (opposite of front)
//   //   2. Animate front away, back into view
//   //   3. After animation: swap — old back becomes new front, new back = opposite
//   //
//   // This means both faces always hold opposite content, guaranteed.
//   const [frontContent, setFrontContent] = useState<TimerMode>(mode);
//   const [backContent,  setBackContent]  = useState<TimerMode>(
//     mode === "stopwatch" ? "countdown" : "stopwatch"
//   );
//   const flipAnim    = useRef(new Animated.Value(0)).current;
//   const isFlipping  = useRef(false);
//   // showFront: true = front face is visible, false = back face is visible
//   const showFront   = useRef(true);

//   const triggerFlip = () => {
//     if (isRunning || isFlipping.current) return;
//     isFlipping.current = true;

//     // Tell context about the mode change immediately
//     onToggleMode();

//     if (showFront.current) {
//       // Front → Back: rotate front from 0→90 (hide), back from -90→0 (show)
//       flipAnim.setValue(0);
//       Animated.timing(flipAnim, {
//         toValue: 1,
//         duration: FLIP_DURATION,
//         useNativeDriver: true,
//       }).start(() => {
//         showFront.current = false;
//         // After back is now visible, pre-load a new front for next flip
//         setFrontContent(backContent);
//         isFlipping.current = false;
//         flipAnim.setValue(0); // reset so next flip starts clean
//       });
//     } else {
//       // Back → Front: reverse direction
//       flipAnim.setValue(1);
//       Animated.timing(flipAnim, {
//         toValue: 0,
//         duration: FLIP_DURATION,
//         useNativeDriver: true,
//       }).start(() => {
//         showFront.current = true;
//         // After front is visible, pre-load new back
//         setBackContent(frontContent);
//         isFlipping.current = false;
//         flipAnim.setValue(0);
//       });
//     }
//   };

//   // Interpolations — front hides at 90°, back appears from -90°
//   const frontRotateY = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: ["0deg", "90deg", "90deg"],
//   });
//   const backRotateY = flipAnim.interpolate({
//     inputRange:  [0, 0.5, 1],
//     outputRange: ["-90deg", "-90deg", "0deg"],
//   });

//   // ── Pulse (stopwatch ticks) ───────────────────────────────────────────────
//   const pulseAnim  = useRef(new Animated.Value(1)).current;
//   const prevSecond = useRef(-1);

//   useEffect(() => {
//     if (mode !== "stopwatch" || !isRunning) return;
//     const s = Math.floor(time);
//     if (s !== prevSecond.current) {
//       prevSecond.current = s;
//       Animated.sequence([
//         Animated.timing(pulseAnim, { toValue: 1.025, duration: 100, useNativeDriver: true }),
//         Animated.timing(pulseAnim, { toValue: 1,     duration: 100, useNativeDriver: true }),
//       ]).start();
//     }
//   }, [time, mode, isRunning]);

//   // ── Drain ring ────────────────────────────────────────────────────────────
//   const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
//   const dashOffset = CIRCUMFERENCE * (1 - drainRatio);
//   const ringColor  = mode === "countdown" && time <= 10 && time > 0
//     ? "#ef4444"
//     : theme.timerBase;

//   // ── Time string ───────────────────────────────────────────────────────────
//   const h       = Math.floor(time / 3600);
//   const m       = Math.floor((time % 3600) / 60);
//   const s       = time % 60;
//   const timeStr = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;

//   const renderFaceContent = (faceMode: TimerMode) =>
//     faceMode === "stopwatch"
//       ? <ClockFace timeStr={timeStr} color={theme.timerBase} />
//       : <CountdownPicker
//           countdownTarget={countdownTarget}
//           onChange={onCountdownTargetChange}
//           color={theme.timerBase}
//         />;

//   return (
//     <Animated.View style={[styles.outerScale, { transform: [{ scale: pulseAnim }] }]}>
//       {/* SVG drain ring */}
//       <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
//         <Circle
//           cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//           stroke={withAlpha(theme.timerBase, "22")}
//           strokeWidth={STROKE} fill="none"
//         />
//         <Circle
//           cx={SIZE/2} cy={SIZE/2} r={CIRCLE_R}
//           stroke={ringColor}
//           strokeWidth={STROKE} fill="none"
//           strokeDasharray={CIRCUMFERENCE}
//           strokeDashoffset={dashOffset}
//           strokeLinecap="round"
//           rotation="-90"
//           origin={`${SIZE/2}, ${SIZE/2}`}
//         />
//       </Svg>

//       {/* Front face — TouchableOpacity handles the long-press flip.
//           onLongPress is on the face container itself, NOT wrapping the
//           ScrollView columns. This means:
//           - Short tap on the circle → nothing (no accidental flip)
//           - Long press on the circle border/background → flip
//           - Tap/scroll directly on picker columns → ScrollView handles it
//             because the TouchableOpacity tap area is behind the picker
//             via the pointerEvents approach on the picker container */}
//       <Animated.View style={[
//         styles.face,
//         { borderColor: withAlpha(theme.timerBase, "44") },
//         { transform: [{ perspective: 800 }, { rotateY: frontRotateY }],
//           backfaceVisibility: "hidden" },
//       ]}>
//         {/* Flip zone: the ring area around the content — tapping here flips */}
//         <TouchableOpacity
//           style={styles.flipZone}
//           onLongPress={triggerFlip}
//           delayLongPress={350}
//           activeOpacity={1}
//         />
//         {/* Content sits on top of flip zone, handles its own touches */}
//         <View style={styles.faceContent} pointerEvents="box-none">
//           {renderFaceContent(frontContent)}
//         </View>
//       </Animated.View>

//       {/* Back face */}
//       <Animated.View style={[
//         styles.face,
//         styles.backFace,
//         { borderColor: withAlpha(theme.timerBase, "44") },
//         { transform: [{ perspective: 800 }, { rotateY: backRotateY }],
//           backfaceVisibility: "hidden" },
//       ]}>
//         <TouchableOpacity
//           style={styles.flipZone}
//           onLongPress={triggerFlip}
//           delayLongPress={350}
//           activeOpacity={1}
//         />
//         <View style={styles.faceContent} pointerEvents="box-none">
//           {renderFaceContent(backContent)}
//         </View>
//       </Animated.View>
//     </Animated.View>
//   );
// }

// // ─── Clock Face ───────────────────────────────────────────────────────────────

// function ClockFace({ timeStr, color }: { timeStr: string; color: string }) {
//   return (
//     <Text style={[faceStyles.time, { color }]}>{timeStr}</Text>
//   );
// }

// // ─── Countdown Picker ─────────────────────────────────────────────────────────

// function CountdownPicker({
//   countdownTarget,
//   onChange,
//   color,
// }: {
//   countdownTarget: number;
//   onChange:        (s: number) => void;
//   color:           string;
// }) {
//   const initH = Math.floor(countdownTarget / 3600);
//   const initM = Math.floor((countdownTarget % 3600) / 60);
//   const initS = countdownTarget % 60;

//   const hVal = useRef(initH);
//   const mVal = useRef(initM);
//   const sVal = useRef(initS);

//   const hRef = useRef<ScrollView | null>(null);
//   const mRef = useRef<ScrollView | null>(null);
//   const sRef = useRef<ScrollView | null>(null);

//   const notify = () =>
//     onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

//   const makeHandler =
//     (valRef: React.MutableRefObject<number>, list: number[]) =>
//     (e: NativeSyntheticEvent<NativeScrollEvent>) => {
//       const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
//       valRef.current = list[Math.max(0, Math.min(idx, list.length - 1))];
//       notify();
//     };

//   useEffect(() => {
//     const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
//       setTimeout(() => r.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false }), 100);
//     go(hRef, initH);
//     go(mRef, initM);
//     go(sRef, initS);
//   }, []);

//   const VISIBLE = 3;
//   const PICKER_H = ITEM_HEIGHT * VISIBLE;
//   const PAD      = ITEM_HEIGHT;

//   const col = (
//     list:    number[],
//     ref:     React.RefObject<ScrollView | null>,
//     handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
//     label:   string
//   ) => (
//     <View style={pickerStyles.col}>
//       <Text style={[pickerStyles.label, { color: withAlpha(color, "88") }]}>
//         {label}
//       </Text>
//       {/* waitFor={[]} ensures this ScrollView doesn't defer to any parent
//           gesture handler — it gets first chance at vertical scroll events */}
//       <ScrollView
//         ref={ref}
//         style={{ height: PICKER_H }}
//         showsVerticalScrollIndicator={false}
//         snapToInterval={ITEM_HEIGHT}
//         decelerationRate="fast"
//         onMomentumScrollEnd={handler}
//         contentContainerStyle={{ paddingVertical: PAD }}
//         scrollEventThrottle={16}
//         directionalLockEnabled
//       >
//         {list.map((v) => (
//           <View key={v} style={pickerStyles.item}>
//             <Text style={[pickerStyles.digit, { color }]}>
//               {v.toString().padStart(2, "0")}
//             </Text>
//           </View>
//         ))}
//       </ScrollView>
//     </View>
//   );

//   return (
//     // pointerEvents="box-none" means this View passes taps through to the
//     // flipZone behind it, but its CHILDREN (the ScrollViews) still receive
//     // their own touch events normally. This is the key to making both
//     // long-press-to-flip AND scroll-to-set-time work simultaneously.
//     <View style={pickerStyles.root} pointerEvents="box-none">
//       <View
//         pointerEvents="none"
//         style={[pickerStyles.band, { borderColor: withAlpha(color, "55") }]}
//       />
//       {col(HOURS,        hRef, makeHandler(hVal, HOURS),        "HH")}
//       <Text style={[pickerStyles.colon, { color }]}>:</Text>
//       {col(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MM")}
//       <Text style={[pickerStyles.colon, { color }]}>:</Text>
//       {col(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SS")}
//     </View>
//   );
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────

// const styles = StyleSheet.create({
//   outerScale: {
//     width: SIZE, height: SIZE,
//     alignItems: "center", justifyContent: "center",
//   },
//   face: {
//     width: SIZE, height: SIZE,
//     borderRadius: RADIUS, borderWidth: 2,
//     justifyContent: "center", alignItems: "center",
//     overflow: "hidden",
//   },
//   backFace: { position: "absolute" },
//   // flipZone covers the full circle but sits BEHIND faceContent via z-index.
//   // Long pressing anywhere on the circle triggers the flip, but taps/scrolls
//   // on the picker or clock text are handled by faceContent on top.
//   flipZone: {
//     ...StyleSheet.absoluteFillObject,
//     borderRadius: RADIUS,
//     zIndex: 0,
//   },
//   faceContent: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: "center",
//     alignItems: "center",
//     zIndex: 1,
//   },
// });

// const faceStyles = StyleSheet.create({
//   time: {
//     fontSize: 42,
//     fontWeight: "bold",
//     textAlign: "center",
//     letterSpacing: 2,
//   },
// });

// const pickerStyles = StyleSheet.create({
//   root: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingHorizontal: 4,
//     position: "relative",
//     width: "100%",
//     height: "100%",
//   },
//   col:   { alignItems: "center", width: 58 },
//   label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
//   item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
//   digit: { fontSize: 28, fontWeight: "600" },
//   colon: { fontSize: 26, fontWeight: "700", marginTop: 14, marginHorizontal: 1 },
//   band:  {
//     position: "absolute",
//     top: 22 + ITEM_HEIGHT,
//     left: 0, right: 0,
//     height: ITEM_HEIGHT,
//     borderTopWidth: 1,
//     borderBottomWidth: 1,
//   },
// });



// import { useContext, useEffect, useRef, useState, useCallback } from "react";
// import {
//   Text,
//   StyleSheet,
//   View,
//   Animated,
//   TouchableOpacity,
//   ScrollView,
//   NativeSyntheticEvent,
//   NativeScrollEvent,
// } from "react-native";
// import Svg, { Circle } from "react-native-svg";
// import { LongPressGestureHandler, State } from "react-native-gesture-handler";

// import { TimerMode } from "@/context/TimerContext";
// import { ThemeContext } from "@/context/ThemeContext";

// const SIZE = 250;
// const RADIUS = 125;
// const STROKE = 6;
// // SVG circle radius is inset by half the stroke so it fits inside the border
// const CIRCLE_R = (SIZE - STROKE) / 2;
// const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

// const ITEM_HEIGHT = 44; // px — each picker row height
// const HOURS = Array.from({ length: 24 }, (_, i) => i);
// const MINUTES = Array.from({ length: 60 }, (_, i) => i);
// const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

// const FLIP_DURATION = 380; // ms total for full coin flip

// /**
//  * Appends a 2-char hex alpha to a colour string, stripping any existing
//  * alpha suffix first.
//  *
//  * Why needed: theme colours like "#06fabdff" already have a full-opacity "ff"
//  * suffix. Naively appending "22" would produce "#06fabdff22" — 9 hex chars,
//  * invalid, renders as black. This strips to 6 chars first then appends.
//  *
//  * Examples:
//  *   withAlpha("#06fabdff", "22") → "#06fabd22"
//  *   withAlpha("#06fabd",   "22") → "#06fabd22"
//  */
// const withAlpha = (hex: string, alpha: string): string => {
//   const base = hex.replace("#", "");
//   const sixChar = base.length === 8 ? base.slice(0, 6) : base;
//   return `#${sixChar}${alpha}`;
// };

// interface TimerDisplayProps {
//   time: number;
//   mode: TimerMode;
//   countdownTarget: number; // seconds — used to compute drain ratio
//   isRunning: boolean;
//   onToggleMode: () => void; // called after flip animation completes
//   onCountdownTargetChange: (seconds: number) => void;
// }

// export default function TimerDisplay({
//   time,
//   mode,
//   countdownTarget,
//   isRunning,
//   onToggleMode,
//   onCountdownTargetChange,
// }: TimerDisplayProps) {
//   const { theme } = useContext(ThemeContext);

//   // ── Coin flip animation ───────────────────────────────────────────────────
//   // flipAnim goes 0 → 1. Front face uses 0°→90°, back face uses 90°→180°.
//   // Content swaps at the 0.5 midpoint via `isFlipMid` state, so neither face
//   // is ever visible during the edge-on moment.
//   const flipAnim = useRef(new Animated.Value(0)).current;
//   const [displayMode, setDisplayMode] = useState<TimerMode>(mode);
//   const isFlipping = useRef(false);

//   const handleCircleTap = () => {
//     if (isRunning || isFlipping.current) return; // lock during run or mid-flip

//     isFlipping.current = true;
//     flipAnim.setValue(0);

//     Animated.timing(flipAnim, {
//       toValue: 1,
//       duration: FLIP_DURATION,
//       useNativeDriver: true,
//     }).start(({ finished }) => {
//       if (finished) {
//         isFlipping.current = false;
//       }
//     });

//     // Swap content at the exact midpoint when the circle is edge-on
//     setTimeout(() => {
//       setDisplayMode((prev) =>
//         prev === "stopwatch" ? "countdown" : "stopwatch",
//       );
//       onToggleMode(); // notify context
//     }, FLIP_DURATION / 2);
//   };

//   // Front face: 0deg → 90deg (disappears)
//   const frontRotateY = flipAnim.interpolate({
//     inputRange: [0, 0.5, 1],
//     outputRange: ["0deg", "90deg", "90deg"],
//   });

//   // Back face: starts at -90deg (hidden behind), rotates to 0deg (appears)
//   const backRotateY = flipAnim.interpolate({
//     inputRange: [0, 0.5, 1],
//     outputRange: ["-90deg", "-90deg", "0deg"],
//   });

//   // ── Pulse animation (stopwatch mode, fires on each new second) ───────────
//   const pulseAnim = useRef(new Animated.Value(1)).current;
//   const prevSecond = useRef(-1);

//   useEffect(() => {
//     if (mode !== "stopwatch" || !isRunning) return;
//     const currentSecond = Math.floor(time);
//     if (currentSecond !== prevSecond.current) {
//       prevSecond.current = currentSecond;
//       Animated.sequence([
//         Animated.timing(pulseAnim, {
//           toValue: 1.025,
//           duration: 100,
//           useNativeDriver: true,
//         }),
//         Animated.timing(pulseAnim, {
//           toValue: 1,
//           duration: 100,
//           useNativeDriver: true,
//         }),
//       ]).start();
//     }
//   }, [time, mode, isRunning]);

//   // ── Drain ring (countdown mode) ───────────────────────────────────────────
//   // strokeDashoffset: CIRCUMFERENCE = full ring (empty), 0 = full ring shown.
//   // As time drains, offset increases from 0 → CIRCUMFERENCE.
//   const drainRatio = countdownTarget > 0 ? time / countdownTarget : 1;
//   const strokeDashoffset = CIRCUMFERENCE * (1 - drainRatio);

//   // Ring colour: normal → warning red in last 10 seconds
//   const ringColor =
//     mode === "countdown" && time <= 10 && time > 0
//       ? "#ef4444"
//       : theme.timerBase;

//   // ── Time display ──────────────────────────────────────────────────────────
//   const hours = Math.floor(time / 3600);
//   const minutes = Math.floor((time % 3600) / 60);
//   const seconds = time % 60;
//   const timeStr = `${hours.toString().padStart(2, "0")}:${minutes
//     .toString()
//     .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

//   {
//     /* <View style={[styles.container, { borderColor: theme.timerBase }]}>
//       <Text style={[styles.time, { color: theme.timerBase }]}>
//         {`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}
//       </Text>
//     </View> */
//   }

//   return (
//      <LongPressGestureHandler
//       minDurationMs={400}
//       onHandlerStateChange={({ nativeEvent }) => {
//         if (nativeEvent.state === State.ACTIVE) triggerFlip();
//       }}
//     >
//     <TouchableOpacity
//       onPress={handleCircleTap}
//       activeOpacity={isRunning ? 1 : 0.85}
//       style={styles.touchWrapper}
//     >
//       <Animated.View
//         style={[styles.outerScale, { transform: [{ scale: pulseAnim }] }]}
//       >
//         {/* SVG drain ring — rendered behind both faces */}
//         <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
//           {/* Background track */}
//           <Circle
//             cx={SIZE / 2}
//             cy={SIZE / 2}
//             r={CIRCLE_R}
//             stroke={theme.timerBase}
//             strokeWidth={STROKE}
//             fill="none"
//           />
//           {/* Drain arc — rotated so it starts from top (12 o'clock) */}
//           <Circle
//             cx={SIZE / 2}
//             cy={SIZE / 2}
//             r={CIRCLE_R}
//             stroke={ringColor}
//             strokeWidth={STROKE}
//             fill="none"
//             strokeDasharray={CIRCUMFERENCE}
//             strokeDashoffset={strokeDashoffset}
//             strokeLinecap="round"
//             rotation="-90"
//             origin={`${SIZE / 2}, ${SIZE / 2}`}
//           />
//         </Svg>

//         {/* ── Front face (current displayMode) ── */}
//         <Animated.View
//           style={[
//             styles.face,
//             { borderColor: theme.timerBase },
//             {
//               transform: [{ perspective: 800 }, { rotateY: frontRotateY }],
//               backfaceVisibility: "hidden",
//             },
//           ]}
//         >
//           {displayMode === "stopwatch" ? (
//             <StopwatchFace timeString={timeString} color={theme.timerBase} />
//           ) : (
//             <CountdownPicker
//               countdownTarget={countdownTarget}
//               onChange={onCountdownTargetChange}
//               color={theme.timerBase}
//             />
//           )}
//         </Animated.View>

//         {/* ── Back face (opposite mode, shown after flip) ── */}
//         <Animated.View
//           style={[
//             styles.face,
//             { borderColor: theme.timerBase },
//             {
//               transform: [{ perspective: 800 }, { rotateY: backRotateY }],
//               backfaceVisibility: "hidden",
//               position: "absolute",
//             },
//           ]}
//         >
//           {displayMode === "stopwatch" ? (
//             <CountdownPicker
//               countdownTarget={countdownTarget}
//               onChange={onCountdownTargetChange}
//               color={theme.timerBase}
//             />
//           ) : (
//             <ClockFace timeStr={timeStr} color={theme.timerBase} />
//           )}
//         </Animated.View>
//       </Animated.View>
//     </TouchableOpacity>
//     </LongPressGestureHandler>
//   );
// }

// // ─── Stopwatch Face ───────────────────────────────────────────────────────────

// function StopwatchFace({
//   timeString,
//   color,
// }: {
//   timeString: string;
//   color: string;
// }) {
//   return <Text style={[styles.time, { color }]}>{timeString}</Text>;
// }
// function ClockFace({ timeStr, color }: { timeStr: string; color: string }) {
//   return (
//     <Text style={[faceStyles.time, { color }]}>{timeStr}</Text>
//   );
// }

// // ─── Countdown Picker ─────────────────────────────────────────────────────────

// /**
//  * Three snap-scroll columns (HH MM SS) inside the circle.
//  *
//  * Each column is a ScrollView with snapToInterval so it locks to row boundaries.
//  * The selected value is whichever item sits in the centre slot, computed from
//  * contentOffset.y / ITEM_HEIGHT on scroll-end.
//  *
//  * A thin selection band (two horizontal lines, top and bottom of the centre row)
//  * is drawn absolutely over all three columns to show which slot is active —
//  * the same visual pattern iOS uses for its native picker.
//  *
//  * Gesture conflict note: the ScrollViews consume vertical pan gestures internally.
//  * The parent TouchableOpacity only fires on a tap (no movement), so there's no
//  * conflict — scrolling the picker will not accidentally trigger the coin flip.
//  */
// function CountdownPicker({
//   countdownTarget,
//   onChange,
//   color,
// }: {
//   countdownTarget: number;
//   onChange: (seconds: number) => void;
//   color: string;
// }) {
//   const initH = Math.floor(countdownTarget / 3600);
//   const initM = Math.floor((countdownTarget % 3600) / 60);
//   const initS = countdownTarget % 60;

//   const hRef = useRef(initH);
//   const mRef = useRef(initM);
//   const sRef = useRef(initS);

//   const notify = () => {
//     onChange(hRef.current * 3600 + mRef.current * 60 + sRef.current);
//   };

//   const handleScroll =
//     (ref: React.MutableRefObject<number>, list: number[]) =>
//     (e: NativeSyntheticEvent<NativeScrollEvent>) => {
//       const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
//       ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
//       notify();
//     };

//   // Scroll to initial value on mount
//   const scrollToInitial = (
//     scrollRef: React.RefObject<ScrollView | null>,
//     idx: number,
//   ) => {
//     setTimeout(() => {
//       scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
//     }, 50);
//   };

//   const hScrollRef = useRef<ScrollView>(null);
//   const mScrollRef = useRef<ScrollView>(null);
//   const sScrollRef = useRef<ScrollView>(null);

//   useEffect(() => {
//     scrollToInitial(hScrollRef, initH);
//     scrollToInitial(mScrollRef, initM);
//     scrollToInitial(sScrollRef, initS);
//   }, []);

//   const VISIBLE_ROWS = 3; // rows visible in the circle window
//   const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
//   const PADDING = ITEM_HEIGHT; // top + bottom padding so edge items can centre

//   const renderColumn = (
//     list: number[],
//     ref: React.RefObject<ScrollView | null>,
//     onChange: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
//     label: string,
//   ) => (
//     <View style={styles.pickerColumn}>
//       <Text style={[styles.pickerLabel, { color: `${color}88` }]}>{label}</Text>
//       <ScrollView
//         ref={ref}
//         style={{ height: PICKER_HEIGHT }}
//         showsVerticalScrollIndicator={false}
//         snapToInterval={ITEM_HEIGHT}
//         decelerationRate="fast"
//         onMomentumScrollEnd={onChange}
//         contentContainerStyle={{ paddingVertical: PADDING }}
//         nestedScrollEnabled
//       >
//         {list.map((v) => (
//           <View key={v} style={styles.pickerItem}>
//             <Text style={[styles.pickerText, { color }]}>
//               {v.toString().padStart(2, "0")}
//             </Text>
//           </View>
//         ))}
//       </ScrollView>
//     </View>
//   );

//   return (
//     <View style={styles.pickerContainer}>
//       {/* Selection band — thin lines above and below the centre row */}
//       <View
//         pointerEvents="none"
//         style={[
//           styles.selectionBand,
//           {
//             top: ITEM_HEIGHT, // offset by label height + 1 row padding
//             borderColor: withAlpha(color, "55"),
//           },
//         ]}
//       />

//       {renderColumn(HOURS, hScrollRef, handleScroll(hRef, HOURS), "HH")}
//       <Text style={[pickerStyles.colon, { color }]}>:</Text>
//       {renderColumn(MINUTES, mScrollRef, handleScroll(mRef, MINUTES), "MM")}
//       <Text style={[pickerStyles.colon, { color }]}>:</Text>
//       {renderColumn(
//         SECONDS_LIST,
//         sScrollRef,
//         handleScroll(sRef, SECONDS_LIST),
//         "SS",
//       )}
//     </View>
//   );
// }


// const styles = StyleSheet.create({
//   outerScale: {
//     width: SIZE, height: SIZE,
//     alignItems: "center", justifyContent: "center",
//   },
//   face: {
//     width: SIZE, height: SIZE,
//     borderRadius: RADIUS, borderWidth: 2,
//     justifyContent: "center", alignItems: "center",
//     overflow: "hidden",
//   },
//   backFace: {
//     position: "absolute",
//   },
// });
 
// // ClockFace styles — font size matches picker digits so swapping is seamless
// const faceStyles = StyleSheet.create({
//   time: {
//     fontSize: 42,
//     fontWeight: "bold",
//     textAlign: "center",
//     letterSpacing: 2,
//   },
// });
 
// const pickerStyles = StyleSheet.create({
//   root: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingHorizontal: 4,
//     position: "relative",
//   },
//   col:   { alignItems: "center", width: 58 },
//   label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
//   item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
//   digit: { fontSize: 28, fontWeight: "600" },
//   colon: { fontSize: 26, fontWeight: "700", marginTop: 14, marginHorizontal: 1 },
//   band: {
//     position: "absolute",
//     // Top of band = label height (~22) + padding row (ITEM_HEIGHT) = centre row
//     top: 22 + ITEM_HEIGHT,
//     left: 0, right: 0,
//     height: ITEM_HEIGHT,
//     borderTopWidth: 1, borderBottomWidth: 1,
//   },
// });