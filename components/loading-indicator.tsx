import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Avatar } from "react-native-paper";

export default function LoadingIndicator(){
    return (
        <View style={styles.container}>
            <ActivityIndicator color="#ffffff"animating size={125}/>
        </View>
    )
}

const styles=StyleSheet.create({
    container:{
        position:'absolute',
        backgroundColor:'#0000005b',
        width:'100%',
        height:'100%',
        justifyContent:'center',
        alignItems:'center',
        zIndex:2

    }
})