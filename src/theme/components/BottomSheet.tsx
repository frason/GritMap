import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { radius, spacing } from "../spacing";
import { useColors } from "../useColors";
import { SHEET_STOPS, settleStop, sheetHeights, stepStop, type SheetStop } from "./sheetSnap";

type Props = {
  children: ReactNode;
  /** Where it opens. */
  initialStop?: SheetStop;
  /** Said by VoiceOver for the drag handle. */
  label: string;
};

/**
 * A sheet that rides over the content behind it (a full-width map) and rests at three heights: a strip, half the
 * screen, and nearly all of it. Drag the handle, or use VoiceOver's increment and decrement. Its content scrolls
 * only at the tallest stop, so a swipe on a shorter sheet moves the sheet, not the content.
 */
export function BottomSheet({ children, initialStop = "half", label }: Props) {
  const colors = useColors();
  const [containerHeight, setContainerHeight] = useState(0);
  const [stop, setStop] = useState<SheetStop>(initialStop);
  const heights = useMemo(() => sheetHeights(containerHeight), [containerHeight]);
  const height = useRef(new Animated.Value(0)).current;
  const startHeight = useRef(0);
  const current = useRef(0);
  const heightsRef = useRef(heights);
  heightsRef.current = heights;

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      current.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  useEffect(() => {
    if (containerHeight === 0) return;
    Animated.spring(height, { toValue: heights[stop], useNativeDriver: false, bounciness: 0 }).start();
  }, [stop, heights, containerHeight, height]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          height.stopAnimation();
          startHeight.current = current.current;
        },
        onPanResponderMove: (_event, gesture) => {
          const all = heightsRef.current;
          height.setValue(Math.min(all.full, Math.max(all.peek, startHeight.current - gesture.dy)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const next = settleStop(current.current, -gesture.vy, heightsRef.current);
          setStop(next);
          Animated.spring(height, { toValue: heightsRef.current[next], useNativeDriver: false, bounciness: 0 }).start();
        },
      }),
    [height],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={(event: LayoutChangeEvent) => setContainerHeight(event.nativeEvent.layout.height)}>
      <Animated.View style={[styles.sheet, { height, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: stop === "full" ? "Fully open" : stop === "half" ? "Half open" : "Closed" }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => setStop((s) => stepStop(s, event.nativeEvent.actionName === "increment" ? "up" : "down"))}
          style={styles.handleArea}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
        </View>
        <ScrollView scrollEnabled={stop === SHEET_STOPS[2]} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  handleArea: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 40, height: 5, borderRadius: 3 },
  content: { paddingHorizontal: spacing.space16, paddingBottom: spacing.space32, gap: spacing.space16 },
});
