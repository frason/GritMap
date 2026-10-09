import { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { clampRangeEnd, clampRangeStart, SEGMENT_RANGE_STEP_METERS } from "../segments/clampSegmentRange.ts";
import { AppText } from "../theme/components";
import { MIN_TOUCH_TARGET } from "../theme/layout";
import { radius, spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { formatDistanceMiles, formatElevationFeet } from "./formatRideStats";

export interface DistanceRangeScrubberProps {
  totalDistanceMeters: number;
  startDistanceMeters: number;
  endDistanceMeters: number;
  onChange: (range: { startDistanceMeters: number; endDistanceMeters: number }) => void;
  elevationAtDistance?: (distanceMeters: number) => number | undefined;
}

/** The visible handle; its touch area is a full 44 pt square around it. */
const THUMB_VISUAL_SIZE = 28;
const TRACK_HEIGHT = 6;

/**
 * Distance-driven (not index-driven) two-handle range selector, built on React Native's
 * built-in PanResponder -- no gesture-handler/reanimated added, per
 * docs/PLAN_segment_definition_increment.md's "scrubber-driven selection" decision. Dragging is
 * the main interaction. Each handle is a 44 pt touch target and a VoiceOver "adjustable" element:
 * swipe up or down to move it by one step, and it announces where it is.
 */
export function DistanceRangeScrubber({
  totalDistanceMeters,
  startDistanceMeters,
  endDistanceMeters,
  onChange,
  elevationAtDistance,
}: DistanceRangeScrubberProps) {
  const palette = useColors();
  const [trackWidth, setTrackWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  function distanceToX(distanceMeters: number): number {
    if (trackWidth === 0 || totalDistanceMeters === 0) return 0;
    return (distanceMeters / totalDistanceMeters) * trackWidth;
  }

  function xToDistance(x: number): number {
    if (trackWidth === 0) return 0;
    const clampedX = Math.min(Math.max(x, 0), trackWidth);
    return (clampedX / trackWidth) * totalDistanceMeters;
  }

  function moveStart(nextDistanceMeters: number) {
    onChange({
      startDistanceMeters: clampRangeStart(nextDistanceMeters, endDistanceMeters),
      endDistanceMeters,
    });
  }

  function moveEnd(nextDistanceMeters: number) {
    onChange({
      startDistanceMeters,
      endDistanceMeters: clampRangeEnd(nextDistanceMeters, startDistanceMeters, totalDistanceMeters),
    });
  }

  const startPanResponder = useDragPanResponder(
    () => distanceToX(startDistanceMeters),
    (x) => moveStart(xToDistance(x)),
  );
  const endPanResponder = useDragPanResponder(
    () => distanceToX(endDistanceMeters),
    (x) => moveEnd(xToDistance(x)),
  );

  // A screen-reader step of 10 m would take hundreds of swipes along a long ride; about 1% of the ride is usable.
  const stepMeters = Math.max(SEGMENT_RANGE_STEP_METERS, Math.round(totalDistanceMeters / 100));

  const selectedLeft = distanceToX(startDistanceMeters);
  const selectedWidth = Math.max(0, distanceToX(endDistanceMeters) - selectedLeft);

  return (
    <View style={styles.container}>
      <View style={styles.readout}>
        <ThumbReadout
          label="Start"
          distanceMeters={startDistanceMeters}
          elevationMeters={elevationAtDistance?.(startDistanceMeters)}
        />
        <ThumbReadout
          label="Finish"
          distanceMeters={endDistanceMeters}
          elevationMeters={elevationAtDistance?.(endDistanceMeters)}
        />
      </View>

      <View style={styles.trackArea}>
        <View style={styles.track} onLayout={handleLayout}>
          <View style={[styles.trackLine, { backgroundColor: palette.borderStrong }]} />
          <View style={[styles.selectedRange, { left: selectedLeft, width: selectedWidth, backgroundColor: palette.brandFill }]} />
          <Thumb
            x={selectedLeft}
            label="Segment start"
            panHandlers={startPanResponder}
            onIncrement={() => moveStart(startDistanceMeters + stepMeters)}
            onDecrement={() => moveStart(startDistanceMeters - stepMeters)}
            valueText={describePosition(startDistanceMeters, elevationAtDistance?.(startDistanceMeters))}
          />
          <Thumb
            x={distanceToX(endDistanceMeters)}
            label="Segment finish"
            panHandlers={endPanResponder}
            onIncrement={() => moveEnd(endDistanceMeters + stepMeters)}
            onDecrement={() => moveEnd(endDistanceMeters - stepMeters)}
            valueText={describePosition(endDistanceMeters, elevationAtDistance?.(endDistanceMeters))}
          />
        </View>
      </View>
    </View>
  );
}

/** "3.2 miles into the ride, 1,204 feet up", for VoiceOver. */
function describePosition(distanceMeters: number, elevationMeters: number | undefined): string {
  const miles = formatDistanceMiles(distanceMeters).replace(" mi", " miles");
  const elevation = elevationMeters === undefined ? "" : `, ${formatElevationFeet(elevationMeters).replace(" ft", " feet")} elevation`;
  return `${miles} into the ride${elevation}`;
}

function ThumbReadout({
  label,
  distanceMeters,
  elevationMeters,
}: {
  label: string;
  distanceMeters: number;
  elevationMeters?: number;
}) {
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <AppText variant="footnote" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="subheadline" style={styles.readoutValue}>
        {formatDistanceMiles(distanceMeters)}
        {elevationMeters !== undefined ? ` · ${formatElevationFeet(elevationMeters)}` : ""}
      </AppText>
    </View>
  );
}

function Thumb({
  x,
  label,
  panHandlers,
  onIncrement,
  onDecrement,
  valueText,
}: {
  x: number;
  label: string;
  panHandlers: ReturnType<typeof PanResponder.create>["panHandlers"];
  onIncrement: () => void;
  onDecrement: () => void;
  valueText: string;
}) {
  const palette = useColors();
  return (
    <View
      {...panHandlers}
      style={[styles.thumbTouch, { left: x - MIN_TOUCH_TARGET / 2 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe up or down to move it along the ride, or drag it"
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[
        { name: "increment", label: "Move further along" },
        { name: "decrement", label: "Move back" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onIncrement();
        if (event.nativeEvent.actionName === "decrement") onDecrement();
      }}
    >
      <View style={[styles.thumb, { backgroundColor: palette.brandFill, borderColor: palette.surface }]} />
    </View>
  );
}

function useDragPanResponder(
  getStartX: () => number,
  onDrag: (x: number) => void,
): ReturnType<typeof PanResponder.create>["panHandlers"] {
  // getStartX/onDrag close over live distance state and are fresh every render, but
  // PanResponder.create must be called once and stay stable for the component's lifetime --
  // recreating it mid-drag would drop the in-progress gesture. Refs updated on every render
  // (not gated behind an effect, so they're current even mid-render) let the one stable
  // PanResponder always call the latest logic instead of a frozen first-render closure.
  const getStartXRef = useRef(getStartX);
  getStartXRef.current = getStartX;
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  const dragOriginX = useRef(0);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragOriginX.current = getStartXRef.current();
        },
        onPanResponderMove: (
          _event: GestureResponderEvent,
          gestureState: PanResponderGestureState,
        ) => {
          onDragRef.current(dragOriginX.current + gestureState.dx);
        },
      }),
    [],
  );
  return responder.panHandlers;
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.space8,
  },
  readout: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.space8,
  },
  readoutValue: {
    fontWeight: "600",
  },
  // Room on both sides so a handle at either end of the track keeps its full 44 pt touch area on screen.
  trackArea: {
    paddingHorizontal: MIN_TOUCH_TARGET / 2,
  },
  track: {
    height: MIN_TOUCH_TARGET,
    justifyContent: "center",
  },
  trackLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  selectedRange: {
    position: "absolute",
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
  },
  thumbTouch: {
    position: "absolute",
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_VISUAL_SIZE,
    height: THUMB_VISUAL_SIZE,
    borderRadius: THUMB_VISUAL_SIZE / 2,
    borderWidth: 3,
  },
});
