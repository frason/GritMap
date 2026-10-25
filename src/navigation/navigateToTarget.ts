import type { NavTarget } from "./headerActions.ts";

/** The part of the tab navigator's `navigation` object this needs, so it can be tested without React Navigation. */
export interface TabNavigationLike {
  navigate(name: string, params?: { screen: string; initial: false }): void;
}

/**
 * Goes to a tab, or to a screen inside a tab. `initial: false` keeps the tab's own root screen
 * underneath, so Back returns to the list rather than leaving the tab.
 */
export function navigateToTarget(navigation: TabNavigationLike, target: NavTarget): void {
  if (!("screen" in target) || target.screen === undefined) {
    navigation.navigate(target.tab);
    return;
  }
  navigation.navigate(target.tab, { screen: target.screen, initial: false });
}
