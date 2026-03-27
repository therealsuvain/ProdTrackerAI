import React, { useContext } from "react";
import {
  Text,
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Modal,
  Dimensions
} from "react-native";

import { ThemeContext } from "@/context/ThemeContext";

import { getPickerDimensions } from "./countdown-picker-modal.utils";
import { createStyles } from "./countdown-picker-modal.styles";
import { usePickerModal } from "./countdown-picker-modal.business";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width * 0.1, 48);
export interface CountdownPickerModalProps {
  visible: boolean;
  countdownTarget: number;
  onChange: (seconds: number) => void;
  onClose: () => void;
}

export default function CountdownPickerModal({
  visible,
  countdownTarget,
  onChange,
  onClose,
}: CountdownPickerModalProps) {
  const { theme } = useContext(ThemeContext);
  const {
    ITEM_HEIGHT,
    PICKER_HEIGHT,
    SCROLL_PAD,
    HOURS,
    MINUTES,
    SECONDS_LIST,
  } = getPickerDimensions(SIZE);
  const styles = createStyles(theme, ITEM_HEIGHT);
  const {hRef, mRef, sRef, hVal, mVal, sVal, makeHandler} = usePickerModal({
  visible,
  countdownTarget,
  onChange,
  onClose,
}, ITEM_HEIGHT);

  const column = (
    list: number[],
    ref: React.RefObject<ScrollView | null>,
    handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
    label: string,
  ) => (
    <View style={styles.col}>
      <Text style={styles.label}>
        {label}
      </Text>
      <ScrollView
        ref={ref}
        style={{ height: PICKER_HEIGHT }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handler}
        contentContainerStyle={{ paddingVertical: SCROLL_PAD }}
        scrollEventThrottle={16}
        directionalLockEnabled
      >
        {list.map((v) => (
          <View key={v} style={styles.item}>
            <Text style={styles.digit}>
              {v.toString().padStart(2, "0")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onClose}
      statusBarTranslucent
    >
      {/*
        Pressable backdrop closes on outside tap.
        Card is a plain View — NOT Pressable/TouchableOpacity.
        Any touch-intercepting component wrapping ScrollViews blocks
        scroll events before they reach the ScrollView. Plain View
        with onStartShouldSetResponder stops tap bubbling to the
        backdrop without installing any gesture recognizer that
        would compete with ScrollView scroll events.
      */}
      <View style={styles.backdrop}>
        <View
          style={
           styles.card
            
          }
          //onStartShouldSetResponder={() => true}
        >
          <Text style={styles.title}>Set Countdown</Text>

          <View style={styles.row}>
            <View
              pointerEvents="none"
              style={styles.band}
            />
            {column(HOURS, hRef, makeHandler(hVal, HOURS), "HOURS")}
            <Text style={styles.colon}>:</Text>
            {column(MINUTES, mRef, makeHandler(mVal, MINUTES), "MIN")}
            <Text style={styles.colon}>:</Text>
            {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SEC")}
          </View>

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
