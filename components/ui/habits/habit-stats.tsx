import React, { useRef, useContext, useEffect } from "react";
import { View, Text, StyleSheet, Animated, Pressable } from "react-native";
import LottieView from "lottie-react-native";
import { ThemeContext } from "@/context/ThemeContext";
import { useAudioPlayer } from "expo-audio";
import { Habit } from "@/types/habits";
import {freezeHabit} from "@/utils/habit-utils";

interface HabitStatsProps {
  habit: Habit;
  onUpdate: (updated: Habit) => void;
}

const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

export default function HabitStats({ habit, onUpdate }: HabitStatsProps) {
  const { theme } = useContext(ThemeContext);
  const playedSoundRef = useRef(false);
  const freezeAnimRef = useRef<LottieView>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;
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
    //playedSoundRef.current = false;
    if(habit.streakFreezes === 0){
      //PLAY DENIED SOUND
      return;
    }
    let oldStreakFreezes = habit.streakFreezes
    const updatedHabit = freezeHabit(habit);
    onUpdate(updatedHabit);
    console.log("NEW FREEZE", updatedHabit.streakFreezes)
 
    if(oldStreakFreezes > updatedHabit.streakFreezes) 
    {freezeAnimRef.current?.play();
    await playStartCue();}
  };

  const isFrozen = () => {
    if(habit.freezeHistory?.length === 0) return false;
    const lastFreeze = habit.freezeHistory?.[habit.freezeHistory.length - 1];
    if(!lastFreeze) return false;
    const lastFreezeDate = new Date(lastFreeze)
     const getToday = () => new Date(new Date().toISOString().split('T')[0]);
     const diff = (getToday().getTime() - lastFreezeDate.getTime()) / (1000 * 3600 * 24);
     return diff < 1; // Consider frozen if last freeze was within the last dayd
  }
  useEffect(() => {
    if (habit.streak >= 3) {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        //tension: 0.001, // Controls speed/bounciness (higher = faster/snappier)
        //friction: 40, // Controls slowdown (lower = more wobble)
        useNativeDriver: true,
      }).start();
    } else {
      // Reset immediately if streak is lost
      scaleAnim.setValue(0);
    }
  }, [habit.streak]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{habit.streak}</Text>
      <View style={styles.animationContainer}>
        <AnimatedLottieView
          source={require("../../../assets/lottie/Fire.json")}
          autoPlay
          loop
          style={[
            styles.fireAnim,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        />
      </View>
      <Pressable onPress={handleFreeze}>
        <Text
          style={{
            color: playedSoundRef.current
              ? theme.whiteBase
              : theme.greyBasePrimary,
          }}
        >
          {habit.streakFreezes}
        </Text>
        {isFrozen()?<LottieView
          source={require("../../../assets/lottie/Freeze.json")}
          autoPlay={true}
          loop={false}
          style={styles.freezeAnim}
        />:<LottieView
          ref={freezeAnimRef}
          source={require("../../../assets/lottie/Freeze.json")}
          loop={false}
          style={styles.freezeAnim}
        />}

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
    color: "black",
    zIndex: 1,
    fontWeight: "bold",
    marginHorizontal: 10,
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
    width: 120,
    height: 120,
    position: "absolute",
    top: -30,
    left: -70,
  },
});
