// Room for the later in-app AI panel (docs/GOALS.md priority 9). There is no chat tab: the AI is an
// icon button at the right end of the bottom tab bar, with Home, Rides and Segments on the left, and
// it opens a docked panel over whichever page the rider is on (decided by Jason, 2026-10-24).
// Nothing is built here and the button is not shown until the feature is ready. This file only fixes
// the numbers the tab bar must leave room for, so adding it later does not re-lay-out the bar.

export const AI_DOCK_ENABLED = false;

/** The button's touch target, the same as the tab bar's other items. */
export const AI_DOCK_BUTTON_SIZE = 44;

/** The tab bar keeps this much clear at its right end for the button: the target plus a gap. */
export const AI_DOCK_TAB_BAR_CLEARANCE = AI_DOCK_BUTTON_SIZE + 8;
