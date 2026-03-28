import { View, Text, StyleSheet } from 'react-native';
import { getDayLabel } from '@/utils/chat-utils';

export function DaySeparator({ date }: { date: string }) {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.label}>{getDayLabel(new Date(date))}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#C0C0C0',
  },
  label: {
    marginHorizontal: 8,
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
});