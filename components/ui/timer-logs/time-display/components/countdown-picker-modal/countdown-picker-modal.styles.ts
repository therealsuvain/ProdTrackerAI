import { StyleSheet } from "react-native";
import { withAlpha } from "@/utils/common-utils";

export const createStyles = (theme: any, item_height: number) => {
    const styles = StyleSheet.create({
        base: theme.timerBase,
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
            backgroundColor: theme.timerDarkPrimary,
            borderColor: withAlpha(theme.timerBase, "44"),
        },
        title: {
            fontSize: 16,
            fontWeight: "700",
            letterSpacing: 1,
            marginBottom: 20,
            textTransform: "uppercase",
            color: theme.timerBase
        },
        row: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            width: "100%",
        },
        col: { alignItems: "center", flex: 1 },
        label: {
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 1,
            marginBottom: 4,
            color: withAlpha(theme.timerBase, "88")
        },
        item: {
            height: item_height,
            justifyContent: "center",
            alignItems: "center"
        },
        digit: { fontSize: 32, fontWeight: "600", color: theme.timerBase },
        colon: {
            fontSize: 28,
            fontWeight: "700",
            marginTop: 18,
            marginHorizontal: 2,
            color:theme.timerBase
        },
        band: {
            position: "absolute",
            top: 22 + item_height,
            left: 0, right: 0,
            height: item_height,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: withAlpha(theme.timerBase, "55")
        },
        doneBtn: {
            marginTop: 24,
            width: "100%",
            paddingVertical: 13,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: theme.timerBase,
        },
        doneBtnText: {
            color: "#000",
            fontWeight: "800",
            fontSize: 15,
        },
    });

    return styles
};