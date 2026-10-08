/** VoiceOver reads a row as one sentence: "Title, subtitle, value". Empty parts are dropped. */
export function rowAccessibilityLabel(parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => part !== undefined && part.trim().length > 0).join(", ");
}

/**
 * A text field's spoken label: its visible label (a placeholder is not a label), the unit it takes
 * ("FTP, watts"), and the current problem if any, so a rider using VoiceOver hears why it is invalid.
 */
export function fieldAccessibilityLabel(input: { label: string; unit?: string; error?: string }): string {
  return rowAccessibilityLabel([input.unit === undefined ? input.label : `${input.label}, ${input.unit}`, input.error === undefined ? undefined : `Error: ${input.error}`]);
}
