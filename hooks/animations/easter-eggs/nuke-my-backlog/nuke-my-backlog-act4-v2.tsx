import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

/**
 * NUKE MY BACKLOG — ACT 4
 * -----------------------------------------------------------------------------
 * The post-camera-approach aftermath.
 *
 * The explosion video is intentionally a PLACEHOLDER in this first Act 4 pass.
 * Replace <ExplosionEffectPlaceholder /> with the prepared local video layer
 * once the user has manually keyed/composited and exported the source clip.
 *
 * Everything else in this act is code-driven:
 * - branching glass cracks
 * - screen impact / shake / flash
 * - glitch bars and scanlines
 * - full-screen critical-error takeover matching the supplied reference
 * - staggered overlapping audio cues
 *
 * This file owns only Act 4 audio players. Acts 0–3 audio ownership is untouched.
 */

const ACT4_AUDIO = {
  explosion: require("@/assets/easter-eggs/nuke-backlog-assets/audio/act4-explosion.mp3"),
  glassBreak: require("@/assets/easter-eggs/nuke-backlog-assets/audio/act4-glass-break.mp3"),
  error01: require("@/assets/easter-eggs/nuke-backlog-assets/audio/act4-error-01.mp3"),
  error02: require("@/assets/easter-eggs/nuke-backlog-assets/audio/act4-error-02.mp3"),
  error03: require("@/assets/easter-eggs/nuke-backlog-assets/audio/act4-error-03.mp3"),
};

export const NUKE_MY_BACKLOG_ACT4_TUNING = {
  // ACT 4.1 — Temporary visual while the manually prepared explosion video is pending.
  explosionFlashFadeMs: 1050,
  explosionShockwaveMs: 1150,
  explosionCoreFadeMs: 720,

  // ACT 4.2 — Screen fracture. All timings are relative to Act 4 start.
  glassCrackStartMs: 260,
  glassCrackRevealMs: 720,

  // ACT 4.3 — Digital failure and audio collision.
  glitchStartMs: 760,
  glitchDurationMs: 1500,
  errorSound01StartMs: 820,
  errorSound02StartMs: 1010,
  errorSound03StartMs: 1460,

  // ACT 4.4 — Error UI takeover.
  errorScreenStartMs: 1080,
  finalErrorSettleMs: 2460,
  dismissButtonRevealMs: 3050,

  // Audio volumes are independently tuneable (0.0–1.0).
  explosionVolume: 0.96,
  glassBreakVolume: 0.88,
  error01Volume: 0.82,
  error02Volume: 0.86,
  error03Volume: 0.78,

  // Visual intensity.
  glitchPeakOpacity: 0.72,
  errorPanelOpacity: 0.94,
  impactShakeDp: 8,
  // ACT 4.2 — Glass fracture appearance.
  crackThicknessScale: 0.62,
  crackLineOpacity: 0.74,
};

type Props = {
  width: number;
  height: number;
  onDismiss: () => void;
};

type CrackSegment = {
  left: number;
  top: number;
  width: number;
  angle: number;
  thickness: number;
  revealAt: number;
};

type Point = { x: number; y: number };

type Player = ReturnType<typeof useAudioPlayer>;

const clampPoint = (point: Point, width: number, height: number): Point => ({
  x: Math.max(0, Math.min(width, point.x)),
  y: Math.max(0, Math.min(height, point.y)),
});

/**
 * Builds a full-screen glass fracture network.
 *
 * The primary fractures travel from the impact point to every edge. Short,
 * asymmetrical branches split off along those paths so this reads as fractured
 * glass across the display rather than a small cartoon spiderweb.
 */
function buildScreenWideCrackSegments(
  width: number,
  height: number,
): CrackSegment[] {
  const centre = { x: width * 0.5, y: height * 0.49 };
  const minDimension = Math.min(width, height);
  const segments: CrackSegment[] = [];

  const addSegment = (
    a: Point,
    b: Point,
    revealAt: number,
    thickness = 0.5, //0.9,
  ) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const actualThickness = Math.max(
      0.36,
      thickness * NUKE_MY_BACKLOG_ACT4_TUNING.crackThicknessScale,
    );

    segments.push({
      left: (a.x + b.x) / 2 - length / 2,
      top: (a.y + b.y) / 2 - actualThickness / 2,
      width: length,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      thickness: actualThickness,
      revealAt: Math.max(0, Math.min(0.94, revealAt)),
    });
  };

  const rayCount = 18;

  const rayAngles = Array.from({ length: rayCount }, (_, index) => {
    const baseAngle = -Math.PI + (index / rayCount) * Math.PI * 2;

    // Deterministic angular variation prevents a uniform starburst.
    const jitter =
      Math.sin(index * 2.13) * 0.105 + Math.cos(index * 0.73) * 0.035;

    return ((baseAngle + jitter) * 180) / Math.PI;
  });
  const rayEnds: Point[] = [];

  rayAngles.forEach((angleDeg, rayIndex) => {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const tx =
      dx > 0 ? (width - centre.x) / dx : dx < 0 ? -centre.x / dx : Infinity;
    const ty =
      dy > 0 ? (height - centre.y) / dy : dy < 0 ? -centre.y / dy : Infinity;
    const distance = Math.min(tx, ty);
    const perpendicular = { x: -dy, y: dx };
    const fractions = [0, 0.11, 0.29, 0.47, 0.68, 0.86, 1];
    const points = fractions.map((fraction, pointIndex) => {
      // Deterministic, restrained bends create a natural chipped-glass edge.
      const bend =
        pointIndex === 0 || pointIndex === fractions.length - 1
          ? 0
          : Math.sin(rayIndex * 1.73 + pointIndex * 2.11) *
              minDimension *
              0.014 +
            Math.cos(rayIndex * 0.91 + pointIndex * 1.37) *
              minDimension *
              0.006;
      return clampPoint(
        {
          x: centre.x + dx * distance * fraction + perpendicular.x * bend,
          y: centre.y + dy * distance * fraction + perpendicular.y * bend,
        },
        width,
        height,
      );
    });

    const mainThickness = 0.78 + (rayIndex % 4) * 0.12;
    for (let index = 1; index < points.length; index += 1) {
      addSegment(
        points[index - 1],
        points[index],
        0.04 + (index / (points.length - 1)) * 0.68,
        mainThickness,
      );
    }
    rayEnds.push(points[points.length - 1]);

    // A substantial fork branches away from the main fracture on every ray.
    const branchIndex = rayIndex % 2 === 0 ? 2 : 3;
    const branchOrigin = points[branchIndex];
    const branchSign = rayIndex % 2 === 0 ? 1 : -1;
    const branchAngle = angle + branchSign * (0.42 + (rayIndex % 3) * 0.09);
    const branchLength = minDimension * (0.15 + (rayIndex % 4) * 0.025);
    const branchMid = clampPoint(
      {
        x: branchOrigin.x + Math.cos(branchAngle) * branchLength * 0.48,
        y: branchOrigin.y + Math.sin(branchAngle) * branchLength * 0.48,
      },
      width,
      height,
    );
    const branchEnd = clampPoint(
      {
        x:
          branchOrigin.x +
          Math.cos(branchAngle + branchSign * 0.12) * branchLength,
        y:
          branchOrigin.y +
          Math.sin(branchAngle + branchSign * 0.12) * branchLength,
      },
      width,
      height,
    );
    addSegment(branchOrigin, branchMid, 0.32 + (rayIndex % 3) * 0.035, 0.72);
    addSegment(branchMid, branchEnd, 0.43 + (rayIndex % 3) * 0.035, 0.66);

    // A second fork appears farther out on every primary fracture, usually
    // splitting in the opposite direction from the first branch.
    const secondaryOrigin = points[4];
    const secondaryAngle = angle - branchSign * (0.48 + (rayIndex % 3) * 0.08);
    const secondaryLength = minDimension * (0.095 + (rayIndex % 3) * 0.018);
    const secondaryMid = clampPoint(
      {
        x:
          secondaryOrigin.x + Math.cos(secondaryAngle) * secondaryLength * 0.52,
        y:
          secondaryOrigin.y + Math.sin(secondaryAngle) * secondaryLength * 0.52,
      },
      width,
      height,
    );
    const secondaryEnd = clampPoint(
      {
        x:
          secondaryOrigin.x +
          Math.cos(secondaryAngle - branchSign * 0.1) * secondaryLength,
        y:
          secondaryOrigin.y +
          Math.sin(secondaryAngle - branchSign * 0.1) * secondaryLength,
      },
      width,
      height,
    );
    addSegment(secondaryOrigin, secondaryMid, 0.59, 0.64);
    addSegment(secondaryMid, secondaryEnd, 0.67, 0.58);

    // Occasional fine splinter branches stop the pattern looking too radial.
    if (rayIndex % 3 === 0) {
      const splinterAngle = secondaryAngle + branchSign * 0.72;
      const splinterLength = minDimension * 0.065;
      const splinterEnd = clampPoint(
        {
          x: secondaryMid.x + Math.cos(splinterAngle) * splinterLength,
          y: secondaryMid.y + Math.sin(splinterAngle) * splinterLength,
        },
        width,
        height,
      );
      addSegment(secondaryMid, splinterEnd, 0.72, 0.52);
    }
  });

  // A few long edge-running fractures connect the perimeter and make the
  // break visibly reach across the complete display.
  for (let index = 0; index < rayEnds.length; index += 3) {
    const a = rayEnds[index];
    const b = rayEnds[(index + 1) % rayEnds.length];
    const midpoint = {
      x: (a.x + b.x) / 2 + Math.sin(index * 1.4) * minDimension * 0.025,
      y: (a.y + b.y) / 2 + Math.cos(index * 1.1) * minDimension * 0.025,
    };
    addSegment(a, clampPoint(midpoint, width, height), 0.74, 0.68);
    addSegment(clampPoint(midpoint, width, height), b, 0.78, 0.68);
  }

  // BROKEN CONCENTRIC FRACTURES
  // Partial, irregular rings surrounding the original impact.
  // These are deliberately broken rather than complete circles.

  const impactArcs = [
    { radius: 0.055, startDeg: -162, endDeg: -76 },
    { radius: 0.055, startDeg: -25, endDeg: 65 },
    { radius: 0.055, startDeg: 104, endDeg: 166 },

    { radius: 0.105, startDeg: -143, endDeg: -53 },
    { radius: 0.105, startDeg: -5, endDeg: 67 },
    { radius: 0.105, startDeg: 99, endDeg: 193 },
  ];

  impactArcs.forEach((arc, arcIndex) => {
    const steps = Math.max(4, Math.ceil((arc.endDeg - arc.startDeg) / 8));

    let previousPoint: Point | null = null;

    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;

      const angle =
        ((arc.startDeg + (arc.endDeg - arc.startDeg) * t) * Math.PI) / 180;

      const radialVariation =
        1 +
        Math.sin(step * 1.81 + arcIndex * 2.17) * 0.055 +
        Math.cos(step * 0.73 + arcIndex) * 0.025;

      const radius = minDimension * arc.radius * radialVariation;

      const point: Point = {
        x: centre.x + Math.cos(angle) * radius,
        y: centre.y + Math.sin(angle) * radius,
      };

      if (previousPoint) {
        addSegment(
          previousPoint,
          point,
          0.12 + arcIndex * 0.035 + t * 0.12,
          0.52,
        );
      }

      previousPoint = point;
    }
  });

  // A small number of hairline splinters close to the impact point.
  for (let index = 0; index < 8; index += 1) {
    const angle = ((index * 45 + 13) * Math.PI) / 180;
    const startDistance = minDimension * 0.045;
    const endDistance = minDimension * (0.095 + (index % 3) * 0.014);
    addSegment(
      {
        x: centre.x + Math.cos(angle) * startDistance,
        y: centre.y + Math.sin(angle) * startDistance,
      },
      {
        x: centre.x + Math.cos(angle + 0.13) * endDistance,
        y: centre.y + Math.sin(angle + 0.13) * endDistance,
      },
      0.16 + (index % 3) * 0.035,
      0.58,
    );
  }

  return segments;
}

const ERROR_BACKGROUND_CODE = [
  `public static void terminateAllProcesses() {\n  if (system.isCritical()) {\n    memory.releaseAll();\n    process.killAll();\n  }\n}`,
  `ERROR 0x0000DEAD\nBACKLOG_PURGE: FAILED\nTASK_QUEUE: CORRUPTED\nRECOVERY: NOT_FOUND\nSYSTEM_STATUS: HALTED`,
  `while (system.isRunning()) {\n  try {\n    restoreDatabase();\n  } catch (Exception fatal) {\n    shutdown();\n  }\n}`,
];

function ErrorCodeBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {ERROR_BACKGROUND_CODE.map((code, index) => (
        <Text
          key={`act4-code-column-${index}`}
          style={[
            styles.backgroundCode,
            {
              left: `${[3, 37, 72][index]}%`,
              top: `${[-4, 8, -1][index]}%`,
              width: "27%",
              opacity: [0.48, 0.38, 0.42][index],
            },
          ]}
        >
          {Array.from({ length: 32 }, () => code).join("\n\n")}
        </Text>
      ))}
    </View>
  );
}

function ExplosionEffectPlaceholder({
  flashOpacity,
  coreOpacity,
  shockwaveOpacity,
  shockwaveScale,
  width,
  height,
}: {
  flashOpacity: Animated.Value;
  coreOpacity: Animated.Value;
  shockwaveOpacity: Animated.Value;
  shockwaveScale: Animated.Value;
  width: number;
  height: number;
}) {
  const coreSize = Math.min(width, height) * 0.64;
  const ringSize = Math.min(width, height) * 0.48;
  const rayAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {/* Replace this component's contents with the prepared explosion VideoView. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.impactFlash,
          { opacity: flashOpacity },
        ]}
      />
      <Animated.View
        style={[
          styles.explosionCore,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            left: (width - coreSize) / 2,
            top: (height - coreSize) / 2,
            opacity: coreOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.shockwaveRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            left: (width - ringSize) / 2,
            top: (height - ringSize) / 2,
            opacity: shockwaveOpacity,
            transform: [{ scale: shockwaveScale }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { opacity: coreOpacity }]}
      >
        {rayAngles.map((angle, index) => (
          <View
            key={`act4-impact-ray-${index}`}
            style={{
              position: "absolute",
              left: width / 2 - 1.5,
              top: height / 2 - coreSize * 0.72,
              width: index % 3 === 0 ? 3 : 1.6,
              height: coreSize * 0.72,
              borderRadius: 2,
              backgroundColor: index % 2 === 0 ? "#FFF4D8" : "#FFB45C",
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/* function GlassCrackOverlay({
  width,
  height,
  progress,
}: {
  width: number;
  height: number;
  progress: Animated.Value;
}) {
  const segments = useMemo(
    () => buildScreenWideCrackSegments(width, height),
    [width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {segments.map((segment, index) => {
        const start = segment.revealAt;
        const end = Math.min(1, start + 0.16);
        const opacity = progress.interpolate({
          inputRange: [start, Math.max(start + 0.001, end)],
          outputRange: [0, NUKE_MY_BACKLOG_ACT4_TUNING.crackLineOpacity],
          extrapolate: "clamp",
        });
        return (
          <Animated.View
            key={`act4-crack-${index}`}
            style={[
              styles.crackLine,
              {
                left: segment.left,
                top: segment.top,
                width: segment.width,
                height: segment.thickness,
                opacity,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
} */

function GlassCrackOverlay({
  width,
  height,
  progress,
}: {
  width: number;
  height: number;
  progress: Animated.Value;
}) {
  const segments = useMemo(
    () => buildScreenWideCrackSegments(width, height),
    [width, height],
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {segments.map((segment, index) => {
        const start = segment.revealAt;
        const end = Math.min(1, start + 0.16);

        const opacity = progress.interpolate({
          inputRange: [start, Math.max(start + 0.001, end)],
          outputRange: [0, NUKE_MY_BACKLOG_ACT4_TUNING.crackLineOpacity],
          extrapolate: "clamp",
        });

        const angleRad = (segment.angle * Math.PI) / 180;

        // Perpendicular offsets give the fracture a slight glass-edge depth.
        const perpendicularX = -Math.sin(angleRad);
        const perpendicularY = Math.cos(angleRad);

        const centreY = segment.top + segment.thickness / 2;

        const underlayHeight = segment.thickness + 1.15;
        const highlightHeight = Math.max(0.32, segment.thickness * 0.46);

        return (
          <React.Fragment key={`act4-crack-${index}`}>
            {/* Dark refractive edge beneath the bright fracture. */}
            <Animated.View
              style={[
                styles.crackUnderlay,
                {
                  left: segment.left + perpendicularX * 0.65,
                  top: centreY - underlayHeight / 2 + perpendicularY * 0.65,
                  width: segment.width,
                  height: underlayHeight,
                  opacity,
                  transform: [{ rotate: `${segment.angle}deg` }],
                },
              ]}
            />

            {/* Narrow light reflection along the broken glass edge. */}
            <Animated.View
              style={[
                styles.crackLine,
                {
                  left: segment.left - perpendicularX * 0.2,
                  top: centreY - highlightHeight / 2 - perpendicularY * 0.2,
                  width: segment.width,
                  height: highlightHeight,
                  opacity,
                  transform: [{ rotate: `${segment.angle}deg` }],
                },
              ]}
            />
          </React.Fragment>
        );
      })}
    </View>
  );
}

export default function NukeMyBacklogAct4({ width, height, onDismiss }: Props) {
  const explosionPlayer = useAudioPlayer(ACT4_AUDIO.explosion);
  const glassBreakPlayer = useAudioPlayer(ACT4_AUDIO.glassBreak);
  const error01Player = useAudioPlayer(ACT4_AUDIO.error01);
  const error02Player = useAudioPlayer(ACT4_AUDIO.error02);
  const error03Player = useAudioPlayer(ACT4_AUDIO.error03);

  const audioReadyPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [dismissVisible, setDismissVisible] = useState(false);

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const coreOpacity = useRef(new Animated.Value(0)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0)).current;
  const shockwaveScale = useRef(new Animated.Value(0.2)).current;
  const crackProgress = useRef(new Animated.Value(0)).current;
  const errorPanelOpacity = useRef(new Animated.Value(0)).current;
  const glitchOpacity = useRef(new Animated.Value(0)).current;
  const glitchOffset = useRef(new Animated.Value(0)).current;
  const sceneShake = useRef(new Animated.Value(0)).current;

  const glitchLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shakeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const ensureAudioReady = useCallback(() => {
    if (!audioReadyPromiseRef.current) {
      audioReadyPromiseRef.current = setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      })
        .then(() => undefined)
        .catch((error) => {
          audioReadyPromiseRef.current = null;
          console.warn(
            "[Nuke My Backlog] Act 4 audio mode setup failed.",
            error,
          );
        });
    }
    return audioReadyPromiseRef.current;
  }, []);

  const playOneShot = useCallback(
    async (player: Player, volume: number) => {
      await ensureAudioReady();
      if (!mountedRef.current) return;
      try {
        player.pause();
        await player.seekTo(0);
        player.loop = false;
        player.volume = Math.max(0, Math.min(1, volume));
        player.play();
      } catch (error) {
        console.warn("[Nuke My Backlog] Act 4 sound playback failed.", error);
      }
    },
    [ensureAudioReady],
  );

  useEffect(() => {
    mountedRef.current = true;

    // ACT 4.1 — Explosion impact placeholder and explosion sound.
    void playOneShot(
      explosionPlayer,
      NUKE_MY_BACKLOG_ACT4_TUNING.explosionVolume,
    );
    flashOpacity.setValue(1);
    coreOpacity.setValue(0.92);
    shockwaveOpacity.setValue(0.88);
    shockwaveScale.setValue(0.18);

    Animated.parallel([
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: NUKE_MY_BACKLOG_ACT4_TUNING.explosionFlashFadeMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(coreOpacity, {
        toValue: 0,
        duration: NUKE_MY_BACKLOG_ACT4_TUNING.explosionCoreFadeMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(shockwaveScale, {
          toValue: 2.8,
          duration: NUKE_MY_BACKLOG_ACT4_TUNING.explosionShockwaveMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shockwaveOpacity, {
          toValue: 0,
          duration: NUKE_MY_BACKLOG_ACT4_TUNING.explosionShockwaveMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const schedule = (delayMs: number, callback: () => void) => {
      const timer = setTimeout(callback, delayMs);
      timersRef.current.push(timer);
    };

    // ACT 4.2 — Glass fracture begins while the explosion is still fading.
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.glassCrackStartMs, () => {
      void playOneShot(
        glassBreakPlayer,
        NUKE_MY_BACKLOG_ACT4_TUNING.glassBreakVolume,
      );
      Animated.timing(crackProgress, {
        toValue: 1,
        duration: NUKE_MY_BACKLOG_ACT4_TUNING.glassCrackRevealMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      shakeAnimationRef.current = Animated.sequence([
        Animated.timing(sceneShake, {
          toValue: 1,
          duration: 38,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(sceneShake, {
          toValue: -0.78,
          duration: 48,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(sceneShake, {
          toValue: 0.42,
          duration: 42,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(sceneShake, {
          toValue: 0,
          duration: 74,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      shakeAnimationRef.current.start();
    });

    // ACT 4.3 — Two error cues deliberately overlap; the third glitch cue follows.
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.errorSound01StartMs, () => {
      void playOneShot(
        error01Player,
        NUKE_MY_BACKLOG_ACT4_TUNING.error01Volume,
      );
    });
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.errorSound02StartMs, () => {
      void playOneShot(
        error02Player,
        NUKE_MY_BACKLOG_ACT4_TUNING.error02Volume,
      );
    });
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.errorSound03StartMs, () => {
      void playOneShot(
        error03Player,
        NUKE_MY_BACKLOG_ACT4_TUNING.error03Volume,
      );
    });

    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.glitchStartMs, () => {
      glitchOpacity.setValue(NUKE_MY_BACKLOG_ACT4_TUNING.glitchPeakOpacity);
      glitchLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glitchOffset, {
              toValue: 1,
              duration: 55,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(glitchOpacity, {
              toValue: 0.18,
              duration: 55,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(glitchOffset, {
              toValue: -0.75,
              duration: 65,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(glitchOpacity, {
              toValue: NUKE_MY_BACKLOG_ACT4_TUNING.glitchPeakOpacity,
              duration: 65,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(glitchOpacity, {
            toValue: 0.08,
            duration: 90,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ]),
      );
      glitchLoopRef.current.start();
    });

    // ACT 4.4 — Full-screen critical-error takeover.
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.errorScreenStartMs, () => {
      Animated.timing(errorPanelOpacity, {
        toValue: NUKE_MY_BACKLOG_ACT4_TUNING.errorPanelOpacity,
        duration: 230,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    });

    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.finalErrorSettleMs, () => {
      glitchLoopRef.current?.stop();
      glitchLoopRef.current = null;
      Animated.timing(glitchOpacity, {
        toValue: 0.08,
        duration: 280,
        useNativeDriver: true,
      }).start();
      Animated.timing(errorPanelOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });

    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.dismissButtonRevealMs, () => {
      setDismissVisible(true);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      glitchLoopRef.current?.stop();
      glitchLoopRef.current = null;
      shakeAnimationRef.current?.stop();
      shakeAnimationRef.current = null;
      [
        flashOpacity,
        coreOpacity,
        shockwaveOpacity,
        shockwaveScale,
        crackProgress,
        errorPanelOpacity,
        glitchOpacity,
        glitchOffset,
        sceneShake,
      ].forEach((value) => value.stopAnimation());

      // Do not call pause()/seekTo() here. useAudioPlayer owns these native
      // players and releases them on unmount. Effect cleanup can run after
      // Expo Audio has already released the native shared object.
      mountedRef.current = false;
    };
  }, [
    crackProgress,
    coreOpacity,
    errorPanelOpacity,
    error01Player,
    error02Player,
    error03Player,
    explosionPlayer,
    flashOpacity,
    glassBreakPlayer,
    glitchOffset,
    glitchOpacity,
    playOneShot,
    sceneShake,
    shockwaveOpacity,
    shockwaveScale,
  ]);

  const shakeX = sceneShake.interpolate({
    inputRange: [-1, 1],
    outputRange: [
      -NUKE_MY_BACKLOG_ACT4_TUNING.impactShakeDp,
      NUKE_MY_BACKLOG_ACT4_TUNING.impactShakeDp,
    ],
    extrapolate: "clamp",
  });
  const glitchX = glitchOffset.interpolate({
    inputRange: [-1, 1],
    outputRange: [-width * 0.035, width * 0.035],
    extrapolate: "clamp",
  });

  return (
    <View pointerEvents="auto" style={StyleSheet.absoluteFillObject}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX: shakeX }] },
        ]}
      >
        <View style={[StyleSheet.absoluteFillObject, styles.baseBackdrop]} />

        {/* PLACEHOLDER SLOT: replace only this component with the prepared video layer. */}
        <ExplosionEffectPlaceholder
          flashOpacity={flashOpacity}
          coreOpacity={coreOpacity}
          shockwaveOpacity={shockwaveOpacity}
          shockwaveScale={shockwaveScale}
          width={width}
          height={height}
        />

        {/* Glitch bars are native views; no image assets or per-frame JS updates. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { opacity: glitchOpacity, transform: [{ translateX: glitchX }] },
          ]}
        >
          <View
            style={[
              styles.glitchBar,
              { top: height * 0.28, left: -width * 0.08, width: width * 0.72 },
            ]}
          />
          <View
            style={[
              styles.glitchBar,
              styles.glitchBarRed,
              { top: height * 0.44, right: -width * 0.05, width: width * 0.86 },
            ]}
          />
          <View
            style={[
              styles.glitchBar,
              { top: height * 0.62, left: width * 0.15, width: width * 0.92 },
            ]}
          />
          <View
            style={[
              styles.glitchBar,
              styles.glitchBarRed,
              { top: height * 0.76, left: -width * 0.12, width: width * 0.6 },
            ]}
          />
        </Animated.View>

        {/* Full-screen critical-error takeover, matching the supplied reference. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.errorBackdrop,
            { opacity: errorPanelOpacity },
          ]}
        >
          {/* Background code — full screen, behind the dialog. */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { zIndex: 0, elevation: 0 }]}
          >
            <ErrorCodeBackground />
          </View>

          {/* Critical error dialog — above the background code. */}
          <View
            style={[
              styles.errorPanel,
              {
                zIndex: 2,
                elevation: 16,
                width: Math.max(0, width - 36),
                minHeight: Math.max(182, Math.min(height * 0.255, 250)),
                paddingHorizontal: Math.min(24, width * 0.055),
              },
            ]}
          >
            <View pointerEvents="none" style={styles.panelGlitchTop} />
            <View pointerEvents="none" style={styles.panelGlitchBottom} />

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.errorTitle,
                { fontSize: Math.min(52, width * 0.105) },
              ]}
            >
              CRITICAL ERROR
            </Text>

            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.errorSubtitle,
                { fontSize: Math.min(25, width * 0.052) },
              ]}
            >
              ALL PROCESS TERMINATED
            </Text>

            <Text style={styles.errorFooter}>SYSTEM SUSPENDED</Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* The fracture is foreground glass, so it remains above the error interface. */}
      <GlassCrackOverlay
        width={width}
        height={height}
        progress={crackProgress}
      />

      {dismissVisible && (
        <View pointerEvents="box-none" style={styles.dismissDock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss system failure screen"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.dismissButtonPressed,
            ]}
          >
            <Text style={styles.dismissButtonText}>REBOOT SYSTEM</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  baseBackdrop: {
    backgroundColor: "#030303",
  },
  impactFlash: {
    backgroundColor: "#FFF5DF",
  },
  explosionCore: {
    position: "absolute",
    backgroundColor: "#FFB14A",
    shadowColor: "#FFFFFF",
    shadowOpacity: 1,
    shadowRadius: 46,
    elevation: 18,
  },
  shockwaveRing: {
    position: "absolute",
    borderWidth: 5,
    borderColor: "#FFF2D6",
    backgroundColor: "transparent",
  },
  /*   crackLine: {
    position: "absolute",
    borderRadius: 0.5,
    backgroundColor: "rgba(225, 232, 241, 0.94)",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.38,
    shadowRadius: 1.0,
    elevation: 1,
  }, */
  crackUnderlay: {
    position: "absolute",
    borderRadius: 0,
    backgroundColor: "rgba(2, 7, 14, 0.78)",
  },

  crackLine: {
    position: "absolute",
    borderRadius: 0,
    backgroundColor: "rgba(225, 239, 250, 0.78)",
  },
  glitchBar: {
    position: "absolute",
    height: 8,
    backgroundColor: "#D8F3FF",
    opacity: 0.75,
  },
  glitchBarRed: {
    height: 5,
    backgroundColor: "#FF354F",
    opacity: 0.72,
  },
  errorBackdrop: {
    backgroundColor: "#020202",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  backgroundCode: {
    position: "absolute",
    color: "#702124",
    fontFamily: "monospace",
    fontSize: 8,
    lineHeight: 12,
    includeFontPadding: false,
  },
  errorPanel: {
    maxWidth: 900,
    borderWidth: 4,
    borderColor: "#FF3038",
    borderRadius: 3,
    backgroundColor: "rgba(37, 0, 2, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
    shadowColor: "#FF1E2D",
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 16,
  },
  panelGlitchTop: {
    position: "absolute",
    top: 7,
    left: -4,
    right: -4,
    height: 3,
    backgroundColor: "#FF4148",
    opacity: 0.9,
  },
  panelGlitchBottom: {
    position: "absolute",
    bottom: 7,
    left: -4,
    right: -4,
    height: 2,
    backgroundColor: "#FF4148",
    opacity: 0.82,
  },
  errorTitle: {
    color: "#FF5357",
    fontWeight: "900",
    letterSpacing: 0.3,
    textAlign: "center",
    includeFontPadding: false,
  },
  errorSubtitle: {
    color: "#FF565B",
    fontWeight: "300",
    letterSpacing: 0.35,
    textAlign: "center",
    marginTop: 4,
    includeFontPadding: false,
  },
  errorFooter: {
    color: "#B94A4E",
    fontFamily: "monospace",
    fontWeight: "500",
    fontSize: 11,
    letterSpacing: 0.6,
    textAlign: "center",
    marginTop: 13,
  },
  dismissDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 42,
    alignItems: "center",
  },
  dismissButton: {
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 60, 70, 0.88)",
    backgroundColor: "rgba(24, 0, 2, 0.96)",
  },
  dismissButtonPressed: {
    backgroundColor: "rgba(90, 8, 13, 0.98)",
    opacity: 0.82,
  },
  dismissButtonText: {
    color: "#FF6269",
    fontFamily: "monospace",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.7,
  },
});
