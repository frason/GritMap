import { ActionSheetIOS, Alert, Platform } from "react-native";
import type { MenuAction } from "./headerActions";

/** Shows a short list of actions: the iOS action sheet on iPhone, a plain alert elsewhere. */
export function showActionMenu(title: string, actions: readonly MenuAction[], onSelect: (action: MenuAction) => void): void {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options: [...actions.map((action) => action.label), "Cancel"], cancelButtonIndex: actions.length },
      (index) => {
        const action = actions[index];
        if (action !== undefined) onSelect(action);
      },
    );
    return;
  }
  Alert.alert(title, undefined, [...actions.map((action) => ({ text: action.label, onPress: () => onSelect(action) })), { text: "Cancel", style: "cancel" as const }]);
}
