import * as Notifications from "expo-notifications";

export function setupNotificationHandler() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
    });
}