import React, { useRef, useContext, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import LottieView from "lottie-react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { Habit } from "@/types/habits";
import { usePlaySound } from "@/hooks/use-play-sound";
import { useHabitStore } from "@/stores/use-habit-store";

interface HabitStatsProps {
  habitId: string;
  onFreeze: () => Promise<
    | "success"
    | "already_frozen"
    | "no_freezes_left"
    | "not_a_target_day"
    | "already_checked_in"
    | "habit_not_found"
    | undefined
  >;
  onDenied: () => void;
  isFrozen: boolean;
}

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

export const HabitStats = ({
  habitId,
  onFreeze,
  onDenied,
  isFrozen,
}: HabitStatsProps) => {
  const { theme } = useContext(ThemeContext);
  const playedSoundRef = useRef(false);
  const freezeAnimRef = useRef<LottieView>(null);
  const scaleFireAnime = useRef(new Animated.Value(0)).current;
  const audioSource = require("@/assets/audio/freeze.mp3");
  const player = usePlaySound(audioSource);
  const streak =
    useHabitStore((state) => state.habitsById[habitId]?.streak) || 0;
  const streakFreezes =
    useHabitStore((state) => state.habitsById[habitId]?.goal) || 0;
  const playFreezingAudio = async () => {
    if (playedSoundRef.current) return;
    playedSoundRef.current = true;
    try {
      player.seekTo(0);
      //player.playbackRate = 2.5;
      player.play();
    } catch (err) {}
  };

  const handleFreeze = async () => {
    const result = await onFreeze();

    if (
      result === "already_checked_in" ||
      result === "already_frozen" ||
      result === "no_freezes_left" ||
      result === "not_a_target_day"
    ) {
      onDenied();
      return;
    }

    playedSoundRef.current = false;
    freezeAnimRef.current?.play();
    await playFreezingAudio();
  };

  useEffect(() => {
    if (streak >= 2) {
      Animated.timing(scaleFireAnime, {
        toValue: 1,
        duration: 500,
        //tension: 0.001, // Controls speed/bounciness (higher = faster/snappier)
        //friction: 40, // Controls slowdown (lower = more wobble)
        useNativeDriver: true,
      }).start();
    } else {
      // Reset immediately if streak is lost
      scaleFireAnime.setValue(0);
    }
  }, [streak]);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.habitBase }]}>{streak}</Text>
      {/* <Svg>
        <SvgText stroke="black" strokeWidth={2} fill={theme.habitBase}fontSize="20" fontWeight="bold">
          {streak}
        </SvgText>
      </Svg> */}
      <View style={styles.animationContainer}>
        <AnimatedLottieView
          source={require("../../../assets/lottie/Fire.json")}
          autoPlay
          loop
          style={[
            styles.fireAnim,
            {
              transform: [{ scale: scaleFireAnime }],
            },
          ]}
        />
      </View>
      <Pressable onPress={handleFreeze}>
        <Text style={[styles.text, { color: theme.habitBase }]}>
          {streakFreezes}
        </Text>
        {isFrozen ? (
          <LottieView
            source={require("../../../assets/lottie/Freeze.json")}
            autoPlay={true}
            loop={false}
            style={styles.freezeAnim}
          />
        ) : (
          <LottieView
            ref={freezeAnimRef}
            source={require("../../../assets/lottie/Freeze.json")}
            loop={false}
            style={styles.freezeAnim}
          />
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginTop: 8,
  },

  text: {
    zIndex: 1,
    fontWeight: "bold",
    fontSize: 16,
    marginHorizontal: 10,
    textShadowColor: "black",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  animationContainer: {
    //flexDirection: "row",
    alignItems: "center",
    //marginVertical: -10,
    //marginLeft: -5,
  },
  fireAnim: {
    width: 75,
    height: 75,
    position: "absolute",
    top: -45,
    left: -55,
  },
  freezeAnim: {
    width: 175,
    height: 175,
    position: "absolute",
    top: -33,
    left: -93,
  },
});
