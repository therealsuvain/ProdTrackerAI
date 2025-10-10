import { Text, StyleSheet } from "react-native";

interface TimerDisplayProps {
    time : number;
}

export default function TimerDisplay({time}:TimerDisplayProps){
    const hours = Math.floor(time/3600);
    const minutes = Math.floor(time%3600);
    const seconds = time % 60;
    return (
        <Text style={styles.time}>
            {
            `${hours.toString().padStart(2,'0')}
            :${minutes.toString().padStart(2,'0')}:
            ${seconds.toString().padStart(2,'0')}`
            }

        </Text>
    )
}

const styles= StyleSheet.create({
    time : {
        color:'white',
        fontSize:48,
        fontWeight: 'bold',
        textAlign: 'center',
    }
})
