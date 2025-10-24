import { useDataTest } from "@/hooks/use-data-test";
import { getHabitProgress, getTaskCompletion, getTotalTimeTracked } from "@/utils/analytics-utils";
import { Text, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

export function AnalyticsSection(){
    const {tasks, timerLogs, habits}= useDataTest();
    const taskCompletion= getTaskCompletion(tasks);
    const timeTracked= getTotalTimeTracked(timerLogs, 'week');
    const habitProgres = getHabitProgress(habits);

    const chartData= habitProgres.map((h,i)=>({
        name:h.name,
        progress: h.progress,
        color: `rgb(${Math.random()*256}, ${Math.random() * 255}, ${Math.random() * 255})`,
        legendFontColor: '#7F7F7F',
    }))

    return(
        <View>
            <Text>Task Completion: {taskCompletion.toFixed(0)}</Text>
            <Text>Time Tracked (Week) : {timeTracked} min</Text>
            <Text>Habits Progress</Text>
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