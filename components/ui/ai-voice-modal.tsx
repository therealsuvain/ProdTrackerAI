import { useIntentProcessor } from "@/hooks/use-intent-processor";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { Button, Text, TextInput, View } from "react-native";
import { Modal, Portal } from "react-native-paper";

interface AIVoiceModalProps {
    visible: boolean;
    onDismiss: () => void;
}

export function AIVoiceModal({visible, onDismiss}:AIVoiceModalProps) {
    const {isRecording, startRecording, stopRecording, transcript, error, setTranscript} = useVoiceInput();
    const {processCommand} = useIntentProcessor();

    const handleSubmit = ()=>{
        processCommand(transcript);
        onDismiss();
    };

    return (
        <Portal>
            <Modal
            visible={visible}
            onDismiss={onDismiss}
            >
             <View style={{padding:20}}>
                <Text>{isRecording? 'Recording...': 'Speak or type command'}</Text>
                <Button title={isRecording?"Stop":"Start"} onPress={isRecording?stopRecording:startRecording}/>
                <TextInput placeholder="Or type here" value={transcript} onChangeText={setTranscript}/>
                {error && <Text>Error : {error}</Text>}
                <Button title="Submit" onPress={handleSubmit}/>
             </View>
            </Modal>
        </Portal>
    )
}