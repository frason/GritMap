import { spacing } from "./spacing.ts";

/** Apple HIG: every tappable control is at least 44 x 44 pt. */
export const MIN_TOUCH_TARGET = 44;

/** Horizontal padding for a full-width screen's content. */
export const SCREEN_PADDING = spacing.space20;

/** Primary actions are taller than the minimum so they are easy to hit one-handed. */
export const PRIMARY_BUTTON_HEIGHT = 50;
