import { useMemo, useRef, useState } from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { clampRangeEnd, clampRangeStart, SEGMENT_RANGE_STEP_METERS } from "../segments/clampSegmentRange.ts";
import { colors } from "../theme/colors";
import { radius, spacing } from "../theme/spacing";
import { formatDistanceMiles, formatElevationFeet } from "./formatRideStats";

export interface DistanceRangeScrubberProps {
  totalDistanceMeters: number;
  startDistanceMeters: number;
  endDistanceMeters: number;
  onChange: (range: { startDistanceMeters: number; endDistanceMeters: number }) => void;
  elevationAtDistance?: (distanceMeters: number) => number | undefined;
}

const THUMB_SIZE = 28;

/**
 * Distance-driven (not index-driven) two-thumb range selector, built on React Native's
 * built-in PanResponder -- no gesture-handler/reanimated added, per
 * docs/PLAN_segment_definition_increment.md's "scrubber-driven selection" decision. Drag is
 * the primary interaction; each thumb also exposes explicit +/- controls so the same
 * interaction is available without a drag gesture.
 */
export function DistanceRangeScrubber({
  totalDistanceMeters,
  startDistanceMeters,
  endDistanceMeters,
  onChange,
  elevationAtDistance,
}: DistanceRangeScrubberProps) {
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
          label="End"
          distanceMeters={endDistanceMeters}
          elevationMeters={elevationAtDistance?.(endDistanceMeters)}
        />
      </View>

      <View style={styles.track} onLayout={handleLayout}>
        <View style={styles.trackLine} />
        <View style={[styles.selectedRange, { left: selectedLeft, width: selectedWidth }]} />
        <Thumb
          x={selectedLeft}
          label="Start"
          panHandlers={startPanResponder}
          onIncrement={() => moveStart(startDistanceMeters + SEGMENT_RANGE_STEP_METERS)}
          onDecrement={() => moveStart(startDistanceMeters - SEGMENT_RANGE_STEP_METERS)}
          valueText={formatDistanceMiles(startDistanceMeters)}
        />
        <Thumb
          x={distanceToX(endDistanceMeters)}
          label="End"
          panHandlers={endPanResponder}
          onIncrement={() => moveEnd(endDistanceMeters + SEGMENT_RANGE_STEP_METERS)}
          onDecrement={() => moveEnd(endDistanceMeters - SEGMENT_RANGE_STEP_METERS)}
          valueText={formatDistanceMiles(endDistanceMeters)}
        />
      </View>
    </View>
  );
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
    <View>
      <Text style={styles.readoutLabel}>{label}</Text>
      <Text style={styles.readoutValue}>
        {formatDistanceMiles(distanceMeters)}
        {elevationMeters !== undefined ? ` · ${formatElevationFeet(elevationMeters)}` : ""}
      </Text>
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
  return (
    <View
      {...panHandlers}
      style={[styles.thumb, { left: x - THUMB_SIZE / 2 }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} of segment range`}
      accessibilityValue={{ text: valueText }}
      accessibilityActions={[
        { name: "increment", label: "Move further" },
        { name: "decrement", label: "Move back" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onIncrement();
        if (event.nativeEvent.actionName === "decrement") onDecrement();
      }}
    />
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
    gap: spacing.space12,
  },
  readout: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  readoutLabel: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  readoutValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  track: {
    height: THUMB_SIZE,
    justifyContent: "center",
  },
  trackLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  selectedRange: {
    position: "absolute",
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  thumb: {
    position: "absolute",
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.brand,
    borderWidth: 3,
    borderColor: colors.surface,
  },
});
