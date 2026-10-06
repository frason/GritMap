import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Rect, Text as SvgText } from "react-native-svg";
import type { PlanVsActualZone, ZoneStatus } from "../pacing/computePlanVsActual";
import { colors } from "../theme/colors";
import { spacing } from "../theme/spacing";

const ZONE_PIXEL_WIDTH = 36;
const BAR_WIDTH = 24;
const AXIS_LABEL_HEIGHT = 18;
const TOP_LABEL_HEIGHT = 14;

const STATUS_COLORS: Record<ZoneStatus, string> = {
  over: colors.statusWarning,
  under: colors.statusInfo,
  on: colors.statusSuccess,
  nodata: colors.border,
};

/**
 * One column per plan zone: a bar for the power actually ridden (colored by how it compared) with
 * the plan's target drawn across it as a dark tick, so over- and under-shooting read at a glance.
 * Fixed width per zone and horizontally scrollable, like the plan chart, so every zone keeps a
 * legible watt label however many there are.
 */
export function PlanVsActualChart({ zones, height = 170 }: { zones: readonly PlanVsActualZone[]; height?: number }) {
  if (zones.length === 0) return null;
  const width = zones.length * ZONE_PIXEL_WIDTH;
  const plotHeight = height - AXIS_LABEL_HEIGHT - TOP_LABEL_HEIGHT;
  const maxWatts = Math.max(100, ...zones.map((zone) => Math.max(zone.targetPowerWatts, zone.actualPowerWatts ?? 0))) * 1.08;
  const y = (watts: number) => TOP_LABEL_HEIGHT + plotHeight - (watts / maxWatts) * plotHeight;
  const baseline = TOP_LABEL_HEIGHT + plotHeight;
  const gridLines: number[] = [];
  for (let watts = 100; watts < maxWatts; watts += 100) gridLines.push(watts);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={zones.length > 8}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {gridLines.map((watts) => (
            <Line key={watts} x1={0} x2={width} y1={y(watts)} y2={y(watts)} stroke={colors.border} strokeWidth={0.5} />
          ))}
          {zones.map((zone) => {
            const x = zone.index * ZONE_PIXEL_WIDTH;
            const centerX = x + ZONE_PIXEL_WIDTH / 2;
            const actual = zone.actualPowerWatts;
            return (
              <G key={zone.index}>
                {actual !== null && (
                  <>
                    <Rect
                      x={centerX - BAR_WIDTH / 2}
                      y={y(actual)}
                      width={BAR_WIDTH}
                      height={Math.max(0, baseline - y(actual))}
                      fill={STATUS_COLORS[zone.status]}
                      opacity={0.85}
                    />
                    <SvgText
                      x={centerX}
                      y={Math.max(10, y(Math.max(actual, zone.targetPowerWatts)) - 3)}
                      fontSize={9}
                      fontWeight="700"
                      fill={colors.textPrimary}
                      textAnchor="middle"
                    >
                      {Math.round(actual)}
                    </SvgText>
                  </>
                )}
                <Line
                  x1={x + 3}
                  x2={x + ZONE_PIXEL_WIDTH - 3}
                  y1={y(zone.targetPowerWatts)}
                  y2={y(zone.targetPowerWatts)}
                  stroke={colors.textPrimary}
                  strokeWidth={2.5}
                />
                <SvgText x={centerX} y={height - 4} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
                  {zone.index + 1}
                </SvgText>
              </G>
            );
          })}
          <Line x1={0} x2={width} y1={baseline} y2={baseline} stroke={colors.textSecondary} strokeWidth={1} />
        </Svg>
      </ScrollView>
      <View style={styles.legend}>
        <LegendItem color={colors.textPrimary} label="Plan target" tick />
        <LegendItem color={colors.statusWarning} label="Over" />
        <LegendItem color={colors.statusSuccess} label="On target" />
        <LegendItem color={colors.statusInfo} label="Under" />
      </View>
    </View>
  );
}

function LegendItem({ color, label, tick = false }: { color: string; label: string; tick?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[tick ? styles.legendTick : styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.space8 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.space16, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.space4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendTick: { width: 14, height: 3 },
  legendLabel: { fontSize: 12, color: colors.textSecondary },
});
