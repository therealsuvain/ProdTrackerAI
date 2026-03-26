import React, { useRef, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";

const ITEM_HEIGHT   = 48;
const VISIBLE_ROWS  = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const SCROLL_PAD    = ITEM_HEIGHT;

const HOURS        = Array.from({ length: 24 }, (_, i) => i);
const MINUTES      = Array.from({ length: 60 }, (_, i) => i);
const SECONDS_LIST = Array.from({ length: 60 }, (_, i) => i);

const withAlpha = (hex: string, alpha: string): string =>
  `#${hex.replace("#", "").slice(0, 6)}${alpha}`;

interface CountdownPickerModalProps {
  visible:         boolean;
  countdownTarget: number;
  onChange:        (seconds: number) => void;
  onClose:         () => void;
  color:           string;
  darkBg:          string;
}

export default function CountdownPickerModal({
  visible,
  countdownTarget,
  onChange,
  onClose,
  color,
  darkBg,
}: CountdownPickerModalProps) {
  const hVal = useRef(Math.floor(countdownTarget / 3600));
  const mVal = useRef(Math.floor((countdownTarget % 3600) / 60));
  const sVal = useRef(countdownTarget % 60);

  const hRef = useRef<ScrollView | null>(null);
  const mRef = useRef<ScrollView | null>(null);
  const sRef = useRef<ScrollView | null>(null);

  // Sync scroll position each time modal opens
  useEffect(() => {
    if (!visible) return;
    const h = Math.floor(countdownTarget / 3600);
    const m = Math.floor((countdownTarget % 3600) / 60);
    const s = countdownTarget % 60;
    hVal.current = h;
    mVal.current = m;
    sVal.current = s;
    const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
      setTimeout(() => r.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false }), 80);
    go(hRef, h);
    go(mRef, m);
    go(sRef, s);
  }, [visible]);

  const commit = () =>
    onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

  const makeHandler =
    (ref: React.MutableRefObject<number>, list: number[]) =>
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
      ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
      commit();
    };

  const column = (
    list:    number[],
    ref:     React.RefObject<ScrollView | null>,
    handler: (e: NativeSyntheticEvent<NativeScrollEvent>) => void,
    label:   string
  ) => (
    <View style={styles.col}>
      <Text style={[styles.label, { color: withAlpha(color, "88") }]}>
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
            <Text style={[styles.digit, { color }]}>
              {v.toString().padStart(2, "0")}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
//   return (
//     <Modal
//        visible={visible}
//       transparent
//       animationType="fade"
//       onRequestClose={onClose}
//       statusBarTranslucent
//       >
//         <View style={styles.backdrop}>
//             <View
//           style={[
//             styles.card,
//             { backgroundColor: darkBg, borderColor: withAlpha(color, "44") },
//           ]}
//           //onStartShouldSetResponder={() => true}
//         >
//           <Text style={[styles.title, { color }]}>Set Countdown</Text>
//       {/* Selection band */}
//       <View
//         pointerEvents="none"
//         style={[styles.band, { borderColor: withAlpha(color, "55") }]}
//       />
//       <View style={styles.row}>
//         {column(HOURS,        hRef, makeHandler(hVal, HOURS),        "HH")}
//         <Text style={[styles.colon, { color }]}>:</Text>
//         {column(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MM")}
//         <Text style={[styles.colon, { color }]}>:</Text>
//         {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SS")}
//       </View>
//       </View>
//       </View>
//     </Modal>
//   );
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
          style={[
            styles.card,
            { backgroundColor: darkBg, borderColor: withAlpha(color, "44") },
          ]}
          //onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { color }]}>Set Countdown</Text>

          <View style={styles.row}>
            <View
              pointerEvents="none"
              style={[styles.band, { borderColor: withAlpha(color, "55") }]}
            />
            {column(HOURS,        hRef, makeHandler(hVal, HOURS),        "HOURS")}
            <Text style={[styles.colon, { color }]}>:</Text>
            {column(MINUTES,      mRef, makeHandler(mVal, MINUTES),      "MIN"  )}
            <Text style={[styles.colon, { color }]}>:</Text>
            {column(SECONDS_LIST, sRef, makeHandler(sVal, SECONDS_LIST), "SEC"  )}
          </View>

          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: color }]}
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: 320,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 20,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "100%",
  },
  col:   { alignItems: "center", flex: 1 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  item:  { height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" },
  digit: { fontSize: 32, fontWeight: "600" },
  colon: { fontSize: 28, fontWeight: "700", marginTop: 18, marginHorizontal: 2 },
  band: {
    position: "absolute",
    top: 22 + ITEM_HEIGHT,
    left: 0, right: 0,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  doneBtn: {
    marginTop: 24,
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#000",
    fontWeight: "800",
    fontSize: 15,
  },
});
