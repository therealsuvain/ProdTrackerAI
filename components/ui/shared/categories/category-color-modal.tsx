import { ThemeContext } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useContext } from "react";
import { Modal, Pressable, View, StyleSheet, Text } from "react-native";
import ColorPicker, {
  ColorFormatsObject,
  HueSlider,
  OpacitySlider,
  Panel1,
  Preview,
} from "reanimated-color-picker";

interface CategoryColorPickerProps {
  visible: boolean;
  selectedColor: string;
  fullPalette: string[];
  onClose: () => void;
  updateColor: (color: string) => void;
  handleColorPicked: (color: ColorFormatsObject) => Promise<void>;
  handleColorSaved: () => Promise<void>;
}
export const CategoryColorPicker = ({
  visible,
  selectedColor,
  fullPalette,
  updateColor,
  handleColorPicked,
  handleColorSaved,
  onClose,
}: CategoryColorPickerProps) => {
  const { theme } = useContext(ThemeContext);
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onDismiss={onClose}
    >
      <View style={styles.colorPickerOverlay}>
        <View
          style={[styles.colorPicker, { backgroundColor: theme.background }]}
        >
          <View style={[styles.modalHeader, { marginBottom: 5 }]}>
            <Text style={[styles.modalTitle, { color: theme.whiteBase }]}>
              Select Custom Color
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.greyBasePrimary} />
            </Pressable>
          </View>
          <ColorPicker
            style={{ gap: 8 }}
            value={selectedColor}
            thumbShape="circle"
            //onChangeJS={handleCustomColorChanged}
            onCompleteJS={handleColorPicked}
          >
            <Preview />
            <Panel1 />
            <HueSlider thumbColor={theme.whiteBase} thumbShape="pill" />
            <OpacitySlider thumbColor={theme.whiteBase} thumbShape="circle" />
          </ColorPicker>
          <View style={styles.colorPalette}>
            {fullPalette.map((color, index) =>
              color ? (
                <Pressable
                  key={color}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      borderColor: theme.greyBasePrimary,
                      borderWidth: 1,
                    },
                    selectedColor === color && {
                      borderWidth: 2,
                      borderColor: theme.whiteBase,
                    },
                  ]}
                  onPress={() => updateColor(color)}
                />
              ) : (
                <View
                  key={`placeholder-${index}`}
                  style={[
                    styles.colorSwatch,
                    {
                      borderColor: theme.whiteBase,
                      backgroundColor: "transparent",
                      borderStyle: "dashed",
                    },
                  ]}
                />
              ),
            )}
          </View>
          <Pressable
            onPress={handleColorSaved}
            style={{
              borderRadius: 16,
              justifyContent: "center",
              backgroundColor: selectedColor,
              padding: 12,
            }}
          >
            <Text
              style={{
                color: theme.whiteBase,
                textAlign: "center",
                fontWeight: "bold",
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  colorPickerOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  colorPicker: {
    flexDirection: "column",
    gap: 16,
    padding: 20,
    zIndex: 1,
    borderRadius: 16,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  colorPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 4,
    margin: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
});
