import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { spacing } from "../theme/spacing";
import { useColors } from "../theme/useColors";
import type { ResultsPoint } from "./resultsView";

const HEIGHT = 150;
const PAD_X = 20;
const PAD_Y = 18;

/**
 * "Your results": each counted effort as a dot, dates left to right and faster efforts higher, joined by a line.
 * The selected effort is larger and in the accent colour; the best is marked. Tapping a dot selects that effort.
 * The list under it carries the same information for VoiceOver, so the chart itself is hidden from it.
 */
export function ResultsChart({ points, selectedId, onSelect }: { points: readonly ResultsPoint[]; selectedId: string | undefined; onSelect: (attemptId: string) => void }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const toX = (x: number) => PAD_X + x * Math.max(0, width - PAD_X * 2);
  const toY = (y: number) => PAD_Y + y * (HEIGHT - PAD_Y * 2);
  return (
    <View style={styles.box} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} accessible={false} importantForAccessibility="no-hide-descendants">
      {width === 0 ? null : (
        <Svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`}>
          <Line x1={PAD_X} y1={HEIGHT - 4} x2={width - PAD_X} y2={HEIGHT - 4} stroke={colors.border} strokeWidth={1} />
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
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, marginVertical: spacing.space4 },
});
