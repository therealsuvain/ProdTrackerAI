import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import DataProvider from '@/context/DataContext';
import { Provider as PaperProvider } from 'react-native-paper';
import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: 'rgb(0, 122, 255)', // Customize as needed
  },
};


export default function TabLayout() {
  return (
    <DataProvider>
      <PaperProvider theme={theme}>
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#25292e",
        },
        headerShadowVisible: false,
        headerTintColor: "#fff",
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarActiveTintColor: "#c7c7c7ff",
          headerStyle: {
          backgroundColor: "#25292e",
        },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home-sharp" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="task-screen"
        options={{
          title: "Tasks",
          tabBarActiveTintColor:"#673AB7",
          headerStyle: {
          backgroundColor: "#673AB7",
        },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar-screen"
        options={{
          title: "Calendar",
          tabBarActiveTintColor:"#F44336",
          headerStyle: {
          backgroundColor: "#F44336",
        },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="habits-screen"
        options={{
          title: "Habits",
          tabBarActiveTintColor:"#f1b718ff",
          headerStyle: {
          backgroundColor: "#f1b718ff",
        },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="timer-screen"
        options={{
          title: "Timer",
          tabBarActiveTintColor:"#05ce9cff",
          headerStyle: {
          backgroundColor: "#05ce9cff",
        },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "alarm" : "alarm-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
    </PaperProvider>
    </DataProvider>
  );
}
