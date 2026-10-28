/** The segment page's three-dot menu, in order. Send to Karoo is always there: its own screen explains a missing plan. */
export const SEGMENT_MENU_ACTIONS = [
  { key: "send", label: "Send to Karoo", destructive: false },
  { key: "delete", label: "Delete segment", destructive: true },
] as const;

export type SegmentMenuKey = (typeof SEGMENT_MENU_ACTIONS)[number]["key"];

/** Labels for the iOS action sheet: the actions, then Cancel last. */
export function segmentMenuOptions(): string[] {
  return [...SEGMENT_MENU_ACTIONS.map((action) => action.label), "Cancel"];
}

/** Which action a tapped action-sheet index means; undefined for Cancel. */
export function segmentMenuKeyAt(index: number): SegmentMenuKey | undefined {
  return SEGMENT_MENU_ACTIONS[index]?.key;
}
