import { SegmentedButtons } from "react-native-paper";

interface ViewSwitcherProps{
    currentView: 'month' | 'day';
    onChange:(view: 'month' | 'day') => void;
}

export default function ViewSwitcher({currentView, onChange}: ViewSwitcherProps){
    return (
        <SegmentedButtons
        value={currentView}
        onValueChange={(value)=> onChange(value as 'month'| 'day')}
        buttons={[
            { value: 'month', label: 'Month'},
            { value: 'day', label: 'Day'}
        ]}
        /> 
    )
}