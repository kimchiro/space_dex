"use client";

import { useTheme } from "styled-components";

type Props = {
  data: number[];
  width?: number;
  height?: number;
};

export default function Sparkline({ data, width = 96, height = 32 }: Props) {
  const theme = useTheme();
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
    .join(" ");

  const isUp = data[data.length - 1] >= data[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? theme.colors.rise : theme.colors.fall}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
