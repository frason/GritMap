import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "../theme/useColors";
import { donutArcs } from "./donutArcs";

const STROKE = 14;

/**
 * Time in zone as a doughnut: one hue that strengthens with the zone number, the same reading as the bar it
 * replaces. Decorative; the legend next to it carries the numbers for VoiceOver.
 */
export function ZoneDonut({ breakdown, size = 96 }: { breakdown: readonly { zone: number; percent: number }[]; size?: number }) {
  const palette = useColors();
  const radius = (size - STROKE) / 2;
  const center = size / 2;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={center} cy={center} r={radius} stroke={palette.disabledBackground} strokeWidth={STROKE} fill="none" />
        {donutArcs(breakdown, radius).map((arc) => (
          <Circle
            key={arc.zone}
            cx={center}
            cy={center}
            r={radius}
            stroke={palette.brandFill}
            strokeOpacity={0.2 + 0.8 * (Math.min(arc.zone, 7) / 7)}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${arc.dashLength} ${arc.gapLength}`}
            strokeDashoffset={arc.dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ))}
      </Svg>
    </View>
  );
}
