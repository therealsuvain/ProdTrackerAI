import { View, StyleSheet, FlatList, Alert } from "react-native";
import { useState } from "react";
import { useDataTest } from "@/hooks/use-data-test";
import { Habit } from "@/types/habits";
import { Button, FAB, Modal, Portal, Provider, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { LineChart } from 'react-native-chart-kit'
import HabitItem from "@/components/ui/habit-item";

export default function HabitsScreen() {
  const {habits, setHabits}= useDataTest();
  const [visible, setVisible ] = useState(false);
  const [editingHabit, setEditingHabit]= useState<Habit| null>(null);
  const [name, setName]= useState('');
  const [frequency, setFrequency]= useState('daily');
  const [goal, setGoal] = useState('');

  const showModal = (habit? : Habit) => {
    setEditingHabit(habit || null);
    setName(habit?.name || ' ');
    setFrequency(habit?.frequency|| 'daily');
    setGoal(habit?.goal?.toString() || '');
    setVisible(true)
  }

  const hideModal = () => setVisible(false);

  const handleSave = () => {
    if(!name)
      return Alert.alert('Error', 'Name is required');
    const newHabit : Habit = {
      id : editingHabit? editingHabit.id : Date.now().toString(),
      name,
      frequency,
      streak: editingHabit? editingHabit.streak : 0,
      lastCompleted: editingHabit? editingHabit.lastCompleted: undefined,
      goal: goal? parseInt(goal): undefined,
    }
    if (editingHabit){
      setHabits(habits.map( h => editingHabit.id === h.id? newHabit : h))
    } else {
      setHabits([...habits, newHabit]);
    }
    hideModal();
  }

  const handleUpdate = (updated: Habit) => {
    setHabits(habits.map(h=>h.id === updated.id? updated: h))
  }

  const handleDelete = ( id : string) => {
    Alert.alert('Delete Habit', 'Are you sure', [
      { text: 'Cancel'},
      { text: 'Delete', onPress : () => setHabits(habits.filter(h => h.id !== id))},
    ]);
  };

  const chartData={
    labels: ['Mon', 'Tue','Wed','Thu', 'Fri'],
    datasets: [{data: [1,2,3,4,5]}],
  }

  return (
    <Provider>
      <View style={styles.container}>
        <FlatList
        data={habits}
        keyExtractor={item => item.id}
        renderItem={({item})=>(
          <HabitItem habit={item} onUpdate={handleUpdate} onDelete={handleDelete}/>
        )}
        ListEmptyComponent={<Text>No habits yet-add one</Text>}
        />
        <LineChart
        data={chartData}
        width={300}
        height={200}
        chartConfig={{
          backgroundColor: '#fff',
          color: () => 'blue',
        }}
        />
        <FAB style={styles.fab} icon="plus" onPress={()=>showModal()}/>
      </View>
      <Portal>
        <Modal
        visible={visible}
        onDismiss={hideModal}
        contentContainerStyle={styles.modal}
        >
          <TextInput label="Habit Name" value={name} onChangeText={setName}/>
          <SegmentedButtons
          value={frequency}
          onValueChange={(val)=> setFrequency( val as 'daily'|'weekly')}
          buttons={[
            {value: 'daily', label : 'Daily'},
            {value: 'weekly', label:'Weekly'},
          ]}
          />
          <TextInput label="Goal" value={goal} onChangeText={setGoal} keyboardType="numeric"/>
          <Button onPress={handleSave}>Save</Button>
          <Button onPress={hideModal}>Cancel</Button>
        </Modal>
      </Portal>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0 },
  modal: { backgroundColor: 'white', padding: 20, margin: 20 },
});