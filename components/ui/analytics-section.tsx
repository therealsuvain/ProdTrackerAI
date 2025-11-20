import { ThemeContext } from "@/context/ThemeContext";
import { useData } from "@/hooks/use-data";
import { getHabitProgress, getTaskCompletion, getTotalTimeTracked } from "@/utils/analytics-utils";
import { useContext } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

export function AnalyticsSection(){
    const {tasks, timerLogs, habits}= useData();
    const {theme} = useContext(ThemeContext)
    const taskCompletion= getTaskCompletion(tasks);
    const timeTracked= getTotalTimeTracked(timerLogs, 'week');
    const habitProgres = getHabitProgress(habits);

    const chartData= habitProgres.map((h,i)=>({
        name:h.title,
        progress: h.progress,
        color: `rgb(${Math.random()*256}, ${Math.random() * 255}, ${Math.random() * 255})`,
        legendFontColor: theme.greyBasePrimary,
    }))

    return(
        <View style={{justifyContent:"center", alignItems:"center"}}>
            <Text style={{color:theme.whiteBase}}>Task Completion: {taskCompletion.toFixed(0)}%</Text>
            <Text style={{color:theme.whiteBase}}>Time Tracked (Week) : {timeTracked} min</Text>
            <Text style={{color:theme.whiteBase}}>Habits Progress</Text>
            <PieChart
            data={chartData}
            width={300}
            height={200}
            chartConfig={{color: ()=> 'blue'}}
            accessor="progress"
            backgroundColor="transparent"
            paddingLeft="15"
            />
        </View>
    )
}

const styles = StyleSheet.create({
})