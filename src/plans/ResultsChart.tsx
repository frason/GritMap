import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { AppText } from "../theme/components";
import { formatDurationMinutesSeconds } from "../screens/formatRideStats";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import { axisTicks, type ResultsPoint } from "./resultsView";

const HEIGHT = 150;
const PAD_X = 20;
const LABEL_WIDTH = 48;
const PAD_Y = 18;

/**
 * "Your results": each counted effort as a dot, dates left to right and faster efforts higher, joined by a line.
 * The selected effort is larger and in the accent colour; the best is marked. Tapping a dot selects that effort.
 * The list under it carries the same information for VoiceOver, so the chart itself is hidden from it.
 */
export function ResultsChart({ points, selectedId, onSelect }: { points: readonly ResultsPoint[]; selectedId: string | undefined; onSelect: (attemptId: string) => void }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const ticks = axisTicks(points);
  const plotWidth = Math.max(0, width - LABEL_WIDTH);
  const toX = (x: number) => PAD_X + x * Math.max(0, plotWidth - PAD_X * 2);
  const toY = (y: number) => PAD_Y + y * (HEIGHT - PAD_Y * 2);
  return (
    <View style={styles.box} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.labels}>
        {ticks.map((tick) => (
          <AppText key={tick.y} variant="caption1" color="textSecondary" style={[styles.label, { top: toY(tick.y) - 8 }]}>
            {formatDurationMinutesSeconds(tick.durationMs)}
          </AppText>
        ))}
      </View>
      <View style={styles.plot} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width + LABEL_WIDTH)}>
        {width === 0 ? null : (
          <Svg width={plotWidth} height={HEIGHT} viewBox={`0 0 ${plotWidth} ${HEIGHT}`}>
            {ticks.map((tick) => (
              <Line key={tick.y} x1={0} y1={toY(tick.y)} x2={plotWidth} y2={toY(tick.y)} stroke={colors.border} strokeWidth={1} strokeDasharray="4 4" />
            ))}
            {points.length < 2 ? null : <Polyline points={points.map((p) => `${toX(p.x)},${toY(p.y)}`).join(" ")} fill="none" stroke={colors.borderStrong} strokeWidth={2} strokeLinejoin="round" />}
            {points.map((p) => {
              const selected = p.attemptId === selectedId;
              return (
                <Circle
                  key={p.attemptId}
                  cx={toX(p.x)}
                  cy={toY(p.y)}
                  r={selected ? 9 : 6}
                  fill={selected ? colors.ctaText : p.isBest ? colors.intensityHold : colors.surface}
                  stroke={selected ? colors.ctaText : p.isBest ? colors.intensityHold : colors.textTertiary}
                  strokeWidth={2}
                  onPress={() => onSelect(p.attemptId)}
                />
              );
            })}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, marginVertical: spacing.space4, flexDirection: "row" },
  labels: { width: LABEL_WIDTH },
  label: { position: "absolute", left: 0 },
  plot: { flex: 1 },
});
