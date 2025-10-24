import { AIIntent } from "@/types/ai-intent";
import { Button, Text, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

interface IntentConfirmationModalProps {
    intent: AIIntent | null;
    onConfirm: ()=> void;
    onCancel: ()=> void;
   
}

export function IntentConfirmationModal({intent, onConfirm, onCancel}: IntentConfirmationModalProps){

    if(intent==null)
        return null;
    return (
        <Portal>
            <Modal
            visible={true}
            onDismiss={onCancel}>
                <View style={{padding:3}}>
                    <Text>Intent: {intent.intent}</Text>
                    <Text>Params: {JSON.stringify(intent.params,null,2)}</Text>
                    <Button title="Confirm" onPress={onConfirm}/>
                    <Button title="Cancel" onPress={onCancel}/>
                </View>
            </Modal>
        </Portal>
    )
}
