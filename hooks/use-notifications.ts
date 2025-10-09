import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { CalendarEvent } from "@/types/calendar";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowList: true,
    }),
});

export const useNotifications = ()=> {
    const notificationListener = useRef<any>(undefined);

    const requestPermissions = async () =>{
        const {status} = await Notifications.requestPermissionsAsync();
        if(status !== 'granted'){
            alert('Notification permission not granted')
        }
    }

    useEffect(()=>{
        requestPermissions();
        notificationListener.current = Notifications.addNotificationReceivedListener(notification =>{
            console.log('Notification Received:', notification);
        });
        return ()=>{
            if(notificationListener.current){
                notificationListener.current.remove();
            }
        };

    },[])
}

export const scheduleReminder = async (event : CalendarEvent):Promise<string> => {
    const trigger= new Date(event.startTime.getTime() - 10 * 60 * 1000);
    const id = await Notifications.scheduleNotificationAsync({
        content:{
            title:'Upcoming event',
            body: `${event.title} starts soon`
        },
        trigger:{
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
        }
    });
    return id;
}

export const cancelReminder = async (id:string) =>{
    await Notifications.cancelScheduledNotificationAsync(id);
}




