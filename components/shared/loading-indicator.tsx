import LottieView from "lottie-react-native";
import { Animated, StyleSheet, View, Text } from "react-native";
import { ActivityIndicator, Avatar } from "react-native-paper";
import { LoadingIndicatorPlanetaryOrbitSkia } from "./loading-indicators/loading-spinners/loading-indicator-planetary-orbit-skia";
import { LoadingIndicatorInfinity } from "./loading-indicators/loading-spinners/loading-indicator-infinity";
import { LoadingIndicatorNC } from "./loading-indicators/loading-spinners/loading-indicator-neural-core";
import { LoadingIndicatorSynth } from "./loading-indicators/loading-spinners/loading-indicator-synth";
import { LoadingIndicatorSonar } from "./loading-indicators/loading-spinners/loading-indicator-sonar";
import { useEffect, useRef } from "react";

export default function LoadingIndicator() {
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 200);
    animate(dot3, 400);
  }, []);

  return (
    <View style={styles.container}>
      {/* <ActivityIndicator color="#ffffff"animating size={125}/> */}
      {/*    <AnimatedLottieView
                  source={require("../assets/lottie/loading.json")}
                  autoPlay
                  loop
                  style={{
                    width: 500,
                    height: 500,
                    position: "absolute",
                    marginBottom: 2.2,
                  }}
                /> */}
      {/* <LoadingIndicatorPlanetaryOrbitSkia size={100} /> */}
      {/* <LoadingIndicatorInfinity /> */}
      <LoadingIndicatorNC size={30} />
      {/* <LoadingIndicatorSynth /> */}
      {/* <LoadingIndicatorSonar coreColor={"#6200ff"} coreSize={100} /> */}
      <View
        style={{
          flexDirection: "row",
          marginTop: 100,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 28, marginRight: 30 }}>
          Loading
        </Text>
        {[dot1, dot2, dot3].map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    backgroundColor: "#000000be",
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#888",
    marginHorizontal: 3,
  },
});
