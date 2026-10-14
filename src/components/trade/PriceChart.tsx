"use client";

import { useMemo, useState } from "react";
import styled, { useTheme } from "styled-components";
import { generateSeries, type Token } from "@/data/tokens";
import { formatPrice } from "@/lib/format";

const ranges = [
  { key: "1D", label: "1일", points: 96, vol: 0.004 },
  { key: "1W", label: "1주", points: 84, vol: 0.01 },
  { key: "1M", label: "1달", points: 90, vol: 0.018 },
  { key: "3M", label: "3달", points: 90, vol: 0.03 },
  { key: "1Y", label: "1년", points: 120, vol: 0.045 },
] as const;

const WIDTH = 800;
const HEIGHT = 320;

export default function PriceChart({ token }: { token: Token }) {
  const theme = useTheme();
  const [rangeKey, setRangeKey] = useState<(typeof ranges)[number]["key"]>("1D");
  const range = ranges.find((r) => r.key === rangeKey)!;

  const { line, area, min, max, isUp } = useMemo(() => {
    const data = generateSeries(`${token.symbol}-${range.key}`, range.points, token.price, range.vol);
    const lo = Math.min(...data);
    const hi = Math.max(...data);
    const span = hi - lo || 1;
    const step = WIDTH / (data.length - 1);
    const pts = data.map((v, i) => [i * step, HEIGHT - 16 - ((v - lo) / span) * (HEIGHT - 32)]);
    const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return {
      line: path,
      area: `${path} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`,
      min: lo,
      max: hi,
      isUp: data[data.length - 1] >= data[0],
    };
  }, [token, range]);

  const stroke = isUp ? theme.colors.rise : theme.colors.fall;

  return (
    <Card>
      <Toolbar>
        <Ranges>
          {ranges.map((r) => (
            <RangeButton key={r.key} $active={r.key === rangeKey} onClick={() => setRangeKey(r.key)}>
              {r.label}
            </RangeButton>
          ))}
        </Ranges>
        <ChartTypes>
          <span>라인</span>
          <span>캔들</span>
        </ChartTypes>
      </Toolbar>

      <ChartArea>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" width="100%" height="100%">
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#chart-fill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        <MaxLabel>최고 {formatPrice(max)}</MaxLabel>
        <MinLabel>최저 {formatPrice(min)}</MinLabel>
      </ChartArea>
    </Card>
  );
}

const Card = styled.div`
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const Ranges = styled.div`
  display: flex;
  gap: 4px;
`;

const RangeButton = styled.button<{ $active: boolean }>`
  height: 32px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const ChartTypes = styled.div`
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const ChartArea = styled.div`
  position: relative;
  height: 320px;
`;

const PriceLabel = styled.span`
  position: absolute;
  right: 0;
  padding: 2px 6px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bg};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const MaxLabel = styled(PriceLabel)`
  top: 0;
`;

const MinLabel = styled(PriceLabel)`
  bottom: 0;
`;
