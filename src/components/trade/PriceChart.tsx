"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import { generateSeries, type Token } from "@/data/tokens";
import type { PricePoint } from "@/lib/priceHistory";
import { formatPrice } from "@/lib/format";

const ranges = [
  { key: "1D", label: "1일", days: 1, mockPoints: 96, vol: 0.004 },
  { key: "1W", label: "1주", days: 7, mockPoints: 84, vol: 0.01 },
  { key: "1M", label: "1달", days: 30, mockPoints: 90, vol: 0.018 },
  { key: "3M", label: "3달", days: 90, mockPoints: 90, vol: 0.03 },
  { key: "1Y", label: "1년", days: 365, mockPoints: 120, vol: 0.045 },
] as const;

type Range = (typeof ranges)[number];

const WIDTH = 800;
const HEIGHT = 320;
const PADDING_Y = 16;

const kst = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour12: false, ...options });
const timeFormat = kst({ hour: "2-digit", minute: "2-digit" });
const dateFormat = kst({ month: "2-digit", day: "2-digit" });
const fullFormat = kst({ year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function PriceChart({ token }: { token: Token }) {
  const theme = useTheme();
  const [range, setRange] = useState<Range>(ranges[0]);
  const [loaded, setLoaded] = useState<{ key: string; points: PricePoint[] } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const requestKey = `${token.id}:${range.days}`;

  useEffect(() => {
    if (!token.id) return;
    const key = `${token.id}:${range.days}`;
    const controller = new AbortController();

    fetch(`/api/chart?id=${encodeURIComponent(token.id)}&days=${range.days}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((points: PricePoint[]) => setLoaded({ key, points }))
      .catch(() => {
        if (!controller.signal.aborted) setFailedKey(key);
      });

    return () => controller.abort();
  }, [token.id, range.days]);

  const isLive = Boolean(token.id) && failedKey !== requestKey;
  const isLoading = isLive && loaded?.key !== requestKey;

  const points: PricePoint[] = useMemo(() => {
    if (isLive && loaded) return loaded.points;
    if (isLive) return [];
    return generateSeries(`${token.symbol}-${range.key}`, range.mockPoints, token.price, range.vol).map(
      (price, i) => [i, price] as PricePoint,
    );
  }, [isLive, loaded, token.symbol, token.price, range]);

  const chart = useMemo(() => {
    if (points.length < 2) return null;
    const prices = points.map(([, p]) => p);
    const lo = Math.min(...prices);
    const hi = Math.max(...prices);
    const span = hi - lo || 1;
    const step = WIDTH / (points.length - 1);
    const coords = prices.map((p, i) => [i * step, HEIGHT - PADDING_Y - ((p - lo) / span) * (HEIGHT - PADDING_Y * 2)]);
    const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    return {
      coords,
      line,
      area: `${line} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`,
      min: lo,
      max: hi,
      isUp: prices[prices.length - 1] >= prices[0],
    };
  }, [points]);

  const stroke = chart?.isUp ? theme.colors.rise : theme.colors.fall;
  const hasTime = isLive && points.length > 0;
  const formatAxis = (t: number) => (range.days === 1 ? timeFormat.format(t) : dateFormat.format(t));

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chart || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  };

  const hover = chart && hoverIndex !== null ? { point: points[hoverIndex], coord: chart.coords[hoverIndex] } : null;

  return (
    <Card>
      <Toolbar>
        <Ranges>
          {ranges.map((r) => (
            <RangeButton key={r.key} $active={r.key === range.key} onClick={() => setRange(r)}>
              {r.label}
            </RangeButton>
          ))}
        </Ranges>
        <SourceLabel>{isLive ? "실제 시세 · CoinGecko" : "예시 데이터"}</SourceLabel>
      </Toolbar>

      <ChartArea
        ref={areaRef}
        $dimmed={isLoading && Boolean(loaded)}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {chart ? (
          <>
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" width="100%" height="100%">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#chart-fill)" />
              <path d={chart.line} fill="none" stroke={stroke} strokeWidth={2} vectorEffect="non-scaling-stroke" />
              {hover && (
                <line
                  x1={hover.coord[0]}
                  x2={hover.coord[0]}
                  y1={0}
                  y2={HEIGHT}
                  stroke={theme.colors.textDisabled}
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {hover && (
              <>
                <Dot
                  style={{
                    left: `${(hover.coord[0] / WIDTH) * 100}%`,
                    top: `${(hover.coord[1] / HEIGHT) * 100}%`,
                    background: stroke,
                  }}
                />
                <Tooltip style={{ left: `clamp(64px, ${(hover.coord[0] / WIDTH) * 100}%, calc(100% - 64px))` }}>
                  <strong>{formatPrice(hover.point[1])}</strong>
                  {hasTime && <span>{fullFormat.format(hover.point[0])}</span>}
                </Tooltip>
              </>
            )}
            <MaxLabel>최고 {formatPrice(chart.max)}</MaxLabel>
            <MinLabel>최저 {formatPrice(chart.min)}</MinLabel>
          </>
        ) : (
          <Placeholder>차트를 불러오는 중…</Placeholder>
        )}
      </ChartArea>

      {hasTime && chart && (
        <Axis>
          <span>{formatAxis(points[0][0])}</span>
          <span>{formatAxis(points[Math.floor(points.length / 2)][0])}</span>
          <span>{formatAxis(points[points.length - 1][0])}</span>
        </Axis>
      )}
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  white-space: nowrap;
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const SourceLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  white-space: nowrap;
`;

const ChartArea = styled.div<{ $dimmed: boolean }>`
  position: relative;
  height: 320px;
  opacity: ${({ $dimmed }) => ($dimmed ? 0.4 : 1)};
  transition: opacity 0.2s;
  cursor: crosshair;
`;

const Placeholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSub};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const PriceLabel = styled.span`
  position: absolute;
  right: 0;
  padding: 2px 6px;
  border-radius: 6px;
  background: ${({ theme }) => theme.colors.bg};
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
  pointer-events: none;
`;

const MaxLabel = styled(PriceLabel)`
  top: 0;
`;

const MinLabel = styled(PriceLabel)`
  bottom: 0;
`;

const Dot = styled.span`
  position: absolute;
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const Tooltip = styled.div`
  position: absolute;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.text};
  color: #fff;
  font-size: 12px;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;

  strong {
    font-size: 13px;
  }

  span {
    color: ${({ theme }) => theme.colors.textDisabled};
  }
`;

const Axis = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;
