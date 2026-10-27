/** The part of a tab route's nested navigation state this needs, so it can be tested without React Navigation. */
export interface NestedStackState {
  key?: string | undefined;
  index?: number | undefined;
}

/**
 * A tab press always lands on the tab's list page. Returns the key of the nested stack to pop to its root,
 * or undefined when there is nothing to pop (the stack was never opened, or is already on its first screen).
 */
export function stackToReset(state: NestedStackState | undefined): string | undefined {
  if (state?.key === undefined || state.index === undefined || state.index <= 0) return undefined;
  return state.key;
}
