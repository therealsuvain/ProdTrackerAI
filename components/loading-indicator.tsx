import LottieView from "lottie-react-native";
import { Animated, StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar } from "react-native-paper";

export default function LoadingIndicator(){
    const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);
    return (
        <View style={styles.container}>
            {/* <ActivityIndicator color="#ffffff"animating size={125}/> */}
            <AnimatedLottieView
                  source={require("../assets/lottie/loading.json")}
                  autoPlay
                  loop
                  style={{
                    width: 500,
                    height: 500,
                    position: "absolute",
                    marginBottom: 2.2,
                  }}
                />

        </View>
    )
}

const styles=StyleSheet.create({
    container:{
        position:'absolute',
        backgroundColor:'#00000080',
        width:'100%',
        height:'100%',
        justifyContent:'center',
        alignItems:'center',
        zIndex:2

    }
})