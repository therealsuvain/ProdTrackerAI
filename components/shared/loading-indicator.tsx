import LottieView from "lottie-react-native";
import { Animated, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar } from "react-native-paper";
import { LoadingIndicatorPlanetaryOrbitSkia } from "./loading-indicators/loading-spinners/loading-indicator-planetary-orbit-skia";
import { LoadingIndicatorInfinity } from "./loading-indicators/loading-spinners/loading-indicator-infinity";
import { LoadingIndicatorNC } from "./loading-indicators/loading-spinners/loading-indicator-neural-core";
import { LoadingIndicatorSynth } from "./loading-indicators/loading-spinners/loading-indicator-synth";
import { LoadingIndicatorSonar } from "./loading-indicators/loading-spinners/loading-indicator-sonar";

export default function LoadingIndicator() {
  const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);
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
});
