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
 * - staged error messages and final crash panel
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
  errorMessageChangeMs: [0, 250, 520, 820] as number[],
  finalErrorSettleMs: 2460,
  dismissButtonRevealMs: 3050,

  // Audio volumes are independently tuneable (0.0–1.0).
  explosionVolume: 0.96,
  glassBreakVolume: 0.88,
  error01Volume: 0.82,
  error02Volume: 0.86,
  error03Volume: 0.78,

  // Visual intensity.
  crackLineOpacity: 0.76, //0.92,
  glitchPeakOpacity: 0.72,
  errorPanelOpacity: 0.94,
  impactShakeDp: 8,

  // ACT 4.2 — Glass fracture appearance.
  crackThicknessScale: 0.62,
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
  revealAt: number;
};

type Player = ReturnType<typeof useAudioPlayer>;

const CRACK_POLYLINES: number[][][] = [
  // Upper-left arm and branches.
  [
    [0.5, 0.46],
    [0.46, 0.39],
    [0.39, 0.36],
    [0.35, 0.29],
    [0.27, 0.25],
    [0.22, 0.17],
  ],
  [
    [0.39, 0.36],
    [0.33, 0.39],
    [0.27, 0.38],
  ],
  [
    [0.35, 0.29],
    [0.38, 0.23],
    [0.36, 0.16],
  ],
  // Upper-right arm and branches.
  [
    [0.5, 0.46],
    [0.56, 0.39],
    [0.64, 0.36],
    [0.7, 0.29],
    [0.79, 0.25],
    [0.86, 0.17],
  ],
  [
    [0.64, 0.36],
    [0.7, 0.4],
    [0.77, 0.39],
  ],
  [
    [0.7, 0.29],
    [0.68, 0.22],
    [0.72, 0.16],
  ],
  // Right side and lower-right arm.
  [
    [0.5, 0.46],
    [0.59, 0.51],
    [0.69, 0.54],
    [0.76, 0.62],
    [0.84, 0.67],
    [0.9, 0.77],
  ],
  [
    [0.69, 0.54],
    [0.75, 0.51],
    [0.83, 0.52],
  ],
  [
    [0.76, 0.62],
    [0.73, 0.7],
    [0.77, 0.77],
  ],
  // Bottom arm and branches.
  [
    [0.5, 0.46],
    [0.47, 0.56],
    [0.43, 0.65],
    [0.46, 0.74],
    [0.52, 0.82],
    [0.56, 0.91],
  ],
  [
    [0.43, 0.65],
    [0.36, 0.69],
    [0.3, 0.67],
  ],
  [
    [0.46, 0.74],
    [0.39, 0.79],
    [0.34, 0.86],
  ],
  // Lower-left arm and branches.
  [
    [0.5, 0.46],
    [0.41, 0.49],
    [0.32, 0.54],
    [0.25, 0.62],
    [0.17, 0.67],
    [0.1, 0.76],
  ],
  [
    [0.32, 0.54],
    [0.28, 0.49],
    [0.21, 0.47],
  ],
  [
    [0.25, 0.62],
    [0.27, 0.7],
    [0.22, 0.77],
  ],
  // Top and bottom short stress fractures.
  [
    [0.5, 0.46],
    [0.49, 0.36],
    [0.52, 0.29],
    [0.5, 0.22],
  ],
  [
    [0.5, 0.46],
    [0.54, 0.58],
    [0.58, 0.67],
    [0.57, 0.75],
  ],
];

function buildCrackSegments(width: number, height: number): CrackSegment[] {
  const raw: Omit<CrackSegment, "revealAt">[] = [];
  for (const line of CRACK_POLYLINES) {
    for (let index = 1; index < line.length; index += 1) {
      const [x1, y1] = line[index - 1];
      const [x2, y2] = line[index];
      const startX = x1 * width;
      const startY = y1 * height;
      const endX = x2 * width;
      const endY = y2 * height;
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.max(1, Math.hypot(dx, dy));
      raw.push({
        left: (startX + endX) / 2 - length / 2,
        top: (startY + endY) / 2 - 0.725,
        width: length,
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
  }

  return raw.map((segment, index) => ({
    ...segment,
    revealAt: index / Math.max(1, raw.length),
  }));
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
    () => buildCrackSegments(width, height),
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
                opacity,
                transform: [{ rotate: `${segment.angle}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const ERROR_MESSAGES = [
  "INITIALIZING RECOVERY SEQUENCE...",
  "MEMORY INTEGRITY CHECK FAILED",
  "TASK DATABASE UNRESPONSIVE",
  "NUKE_MY_BACKLOG.EXE HAS STOPPED",
];

export default function NukeMyBacklogAct4({ width, height, onDismiss }: Props) {
  const explosionPlayer = useAudioPlayer(ACT4_AUDIO.explosion);
  const glassBreakPlayer = useAudioPlayer(ACT4_AUDIO.glassBreak);
  const error01Player = useAudioPlayer(ACT4_AUDIO.error01);
  const error02Player = useAudioPlayer(ACT4_AUDIO.error02);
  const error03Player = useAudioPlayer(ACT4_AUDIO.error03);

  const audioReadyPromiseRef = useRef<Promise<void> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [errorMessageIndex, setErrorMessageIndex] = useState(0);
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

    // ACT 4.4 — Error screen takeover and rapidly changing diagnostics.
    schedule(NUKE_MY_BACKLOG_ACT4_TUNING.errorScreenStartMs, () => {
      Animated.timing(errorPanelOpacity, {
        toValue: NUKE_MY_BACKLOG_ACT4_TUNING.errorPanelOpacity,
        duration: 230,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();

      NUKE_MY_BACKLOG_ACT4_TUNING.errorMessageChangeMs.forEach(
        (offset, index) => {
          schedule(offset, () =>
            setErrorMessageIndex(Math.min(index, ERROR_MESSAGES.length - 1)),
          );
        },
      );
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

      [
        explosionPlayer,
        glassBreakPlayer,
        error01Player,
        error02Player,
        error03Player,
      ].forEach((player) => {
        player.pause();
        void player.seekTo(0).catch(() => undefined);
      });
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
  const errorMessage = ERROR_MESSAGES[errorMessageIndex] ?? ERROR_MESSAGES[0];

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

        {/* Final error UI. It fades in over the impact visuals and then settles. */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            styles.errorBackdrop,
            { opacity: errorPanelOpacity },
          ]}
        >
          <View
            style={[styles.errorPanel, { width: Math.min(width - 36, 520) }]}
          >
            <View style={styles.errorHeaderRow}>
              <View style={styles.errorIndicator} />
              <Text style={styles.errorEyebrow}>CRITICAL SYSTEM EXCEPTION</Text>
              <Text style={styles.errorCode}>0xNMB-04</Text>
            </View>

            <Text style={styles.errorTitle}>SYSTEM FAILURE</Text>
            <Text style={styles.errorSubtitle}>NUKE_MY_BACKLOG.EXE</Text>
            <View style={styles.errorDivider} />

            <Text style={styles.errorMessage}>{errorMessage}</Text>
            <View style={styles.diagnosticBlock}>
              <Text style={styles.diagnosticLine}>PROCESS: BACKLOG_PURGE</Text>
              <Text style={styles.diagnosticLine}>STATUS: TERMINATED</Text>
              <Text style={styles.diagnosticLine}>RECOVERY: UNAVAILABLE</Text>
              <Text style={styles.diagnosticLine}>TRACE: 0x0000DEAD</Text>
            </View>
            <View style={styles.errorFooterRow}>
              <Text style={styles.errorFooter}>SYSTEM HALTED</Text>
              <Text style={styles.errorFooter}>PLEASE STAND BY</Text>
            </View>
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
    backgroundColor: "#080B12",
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
  crackLine: {
    position: "absolute",
    height: 1.45,
    borderRadius: 1,
    backgroundColor: "#F4F7FF",
    shadowColor: "#08111F",
    shadowOpacity: 0.95,
    shadowRadius: 2,
    elevation: 2,
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
    backgroundColor: "rgba(3, 6, 12, 0.91)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  errorPanel: {
    maxWidth: 520,
    borderWidth: 1,
    borderColor: "rgba(255, 72, 92, 0.62)",
    backgroundColor: "rgba(8, 12, 21, 0.96)",
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 12,
    shadowColor: "#FF243F",
    shadowOpacity: 0.24,
    shadowRadius: 22,
    elevation: 12,
  },
  errorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 24,
  },
  errorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF4259",
  },
  errorEyebrow: {
    color: "#FF6478",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: "monospace",
    flex: 1,
  },
  errorCode: {
    color: "#8F9BAE",
    fontFamily: "monospace",
    fontSize: 9,
  },
  errorTitle: {
    color: "#F8FAFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1.2,
    fontFamily: "monospace",
  },
  errorSubtitle: {
    color: "#FF5268",
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 1.1,
    marginTop: 7,
  },
  errorDivider: {
    height: 1,
    backgroundColor: "rgba(255, 75, 94, 0.42)",
    marginVertical: 20,
  },
  errorMessage: {
    color: "#F4F6FB",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 20,
    minHeight: 40,
  },
  diagnosticBlock: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderLeftWidth: 2,
    borderLeftColor: "#FF4057",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 7,
  },
  diagnosticLine: {
    color: "#A8B5C8",
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 0.6,
  },
  errorFooterRow: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  errorFooter: {
    color: "#FF6478",
    fontFamily: "monospace",
    fontWeight: "700",
    fontSize: 9,
    letterSpacing: 1.1,
  },
  dismissDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 48,
    alignItems: "center",
  },
  dismissButton: {
    minWidth: 190,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 86, 106, 0.75)",
    backgroundColor: "rgba(30, 10, 18, 0.92)",
  },
  dismissButtonPressed: {
    backgroundColor: "rgba(90, 18, 31, 0.95)",
    opacity: 0.82,
  },
  dismissButtonText: {
    color: "#FF8291",
    fontFamily: "monospace",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.7,
  },
});
