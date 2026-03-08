import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Surface } from 'react-native-paper';
import { useTheme}  from '@/hooks/use-theme-colors';

interface SettingsGroupProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsGroup = ({ title, children }: SettingsGroupProps) => {
  const {theme} = useTheme();

  return (
    <View style={[styles.container, {backgroundColor:theme.background} ]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {title.toUpperCase()}
      </Text>
      <Surface style={[styles.surface, { backgroundColor: theme.background }]} elevation={4}>
        {children}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  title: {
    marginLeft: 12,
    marginBottom: 8,
    fontWeight: '500',
    letterSpacing: 0.6,
    fontSize : 18
  },
  surface: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});