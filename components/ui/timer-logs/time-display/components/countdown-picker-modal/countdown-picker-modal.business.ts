import { useRef, useEffect } from "react";
import {
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from "react-native";
import { CountdownPickerModalProps } from "./countdown-picker-modal";

export const usePickerModal = (props: CountdownPickerModalProps, itemHeight: number) => {
    const hVal = useRef(Math.floor(props.countdownTarget / 3600));
    const mVal = useRef(Math.floor((props.countdownTarget % 3600) / 60));
    const sVal = useRef(props.countdownTarget % 60);

    const hRef = useRef<ScrollView | null>(null);
    const mRef = useRef<ScrollView | null>(null);
    const sRef = useRef<ScrollView | null>(null);

    // Sync scroll position each time modal opens
    useEffect(() => {
        if (!props.visible) return;
        const h = Math.floor(props.countdownTarget / 3600);
        const m = Math.floor((props.countdownTarget % 3600) / 60);
        const s = props.countdownTarget % 60;
        hVal.current = h;
        mVal.current = m;
        sVal.current = s;
        const go = (r: React.RefObject<ScrollView | null>, idx: number) =>
            setTimeout(() => r.current?.scrollTo({ y: idx * itemHeight, animated: false }), 80);
        go(hRef, h);
        go(mRef, m);
        go(sRef, s);
    }, [props.visible]);

    const commit = () =>
        props.onChange(hVal.current * 3600 + mVal.current * 60 + sVal.current);

    const makeHandler =
        (ref: React.MutableRefObject<number>, list: number[]) =>
            (e: NativeSyntheticEvent<NativeScrollEvent>) => {
                const idx = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
                ref.current = list[Math.max(0, Math.min(idx, list.length - 1))];
                commit();
            };

    return {  hRef, mRef, sRef, hVal, mVal, sVal, makeHandler };
};