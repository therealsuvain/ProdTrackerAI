import React, { useRef, useContext, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import { Svg, Text as SvgText } from "react-native-svg";
import LottieView from "lottie-react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { useAudioPlayer } from "expo-audio";
import { Habit } from "@/types/habits";
import { freezeHabit, isFrozen } from "@/utils/habit-utils";

interface HabitStatsProps {
  habit: Habit;
  onUpdate: (updated: Habit) => void;
  onDenied: () => void;
}

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

export const HabitStats = ({ habit, onUpdate, onDenied }: HabitStatsProps) => {
  const { theme } = useContext(ThemeContext);
  const playedSoundRef = useRef(false);
  const freezeAnimRef = useRef<LottieView>(null);
  const scaleFireAnime = useRef(new Animated.Value(0)).current;
  const audioSource = require("../../../assets/audio/freeze.mp3");
  const player = useAudioPlayer(audioSource);

  const playStartCue = async () => {
    if (playedSoundRef.current) return;
    playedSoundRef.current = true;
    try {
      player.seekTo(0);
      //player.playbackRate = 2.5;
      player.play();
    } catch (err) {}
  };

  const handleFreeze = async () => {
    let oldStreakFreezes = habit.streakFreezes;
    const result = freezeHabit(habit);

    if (result.status === "denied") {
      onDenied();
      return;
    }

    onUpdate(result.habit);
    console.log("NEW FREEZE", result.habit.streakFreezes);

    if (oldStreakFreezes > result.habit.streakFreezes) {
       playedSoundRef.current = false
      freezeAnimRef.current?.play();
      await playStartCue();
    }
  };

  useEffect(() => {
    if (habit.streak >= 2) {
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
  }, [habit.streak]);

  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: theme.habitBase }]}>
        {habit.streak}
      </Text>
      {/* <Svg>
        <SvgText stroke="black" strokeWidth={2} fill={theme.habitBase}fontSize="20" fontWeight="bold">
          {habit.streak}
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
          {habit.streakFreezes}
        </Text>
        {isFrozen(habit) ? (
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
}

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
