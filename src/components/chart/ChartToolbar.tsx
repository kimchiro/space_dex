"use client";

import type { ReactNode } from "react";
import styled from "styled-components";
import { INTERVALS, type IntervalKey } from "@/lib/market/candles";
import type { DrawingTool } from "./drawingLayer";
import type { IndicatorConfig } from "./TradingChart";

const INDICATOR_OPTIONS: { key: keyof IndicatorConfig; label: string }[] = [
  { key: "volume", label: "거래량" },
  { key: "ma", label: "MA 20·60" },
  { key: "bb", label: "볼린저" },
  { key: "rsi", label: "RSI" },
];

const TOOL_OPTIONS: { key: Exclude<DrawingTool, "none">; label: string; hint: string }[] = [
  { key: "trend", label: "추세선", hint: "두 지점을 차례로 클릭" },
  { key: "hline", label: "수평선", hint: "가격 위치를 클릭" },
  { key: "fib", label: "피보나치", hint: "고점·저점을 차례로 클릭" },
];

type Props = {
  interval: IntervalKey;
  onInterval: (interval: IntervalKey) => void;
  indicators: IndicatorConfig;
  onIndicators: (indicators: IndicatorConfig) => void;
  tool?: DrawingTool;
  onTool?: (tool: DrawingTool) => void;
  onClearDrawings?: () => void;
  drawingCount?: number;
  intervals?: readonly IntervalKey[];
  trailing?: ReactNode;
};

export default function ChartToolbar({
  interval,
  onInterval,
  indicators,
  onIndicators,
  tool,
  onTool,
  onClearDrawings,
  drawingCount = 0,
  intervals = INTERVALS.map((i) => i.key),
  trailing,
}: Props) {
  const activeTool = TOOL_OPTIONS.find((t) => t.key === tool);

  return (
    <Bar>
      <Group role="group" aria-label="시간봉">
        {INTERVALS.filter((i) => intervals.includes(i.key)).map((i) => (
          <Chip key={i.key} type="button" $active={i.key === interval} onClick={() => onInterval(i.key)}>
            {i.label}
          </Chip>
        ))}
      </Group>
      <Divider />
      <Group role="group" aria-label="지표">
        {INDICATOR_OPTIONS.map((o) => (
          <Toggle
            key={o.key}
            type="button"
            aria-pressed={indicators[o.key]}
            $active={indicators[o.key]}
            onClick={() => onIndicators({ ...indicators, [o.key]: !indicators[o.key] })}
          >
            {o.label}
          </Toggle>
        ))}
      </Group>
      {onTool && (
        <>
          <Divider />
          <Group role="group" aria-label="작도 도구">
            {TOOL_OPTIONS.map((t) => (
              <Toggle
                key={t.key}
                type="button"
                title={t.hint}
                aria-pressed={tool === t.key}
                $active={tool === t.key}
                onClick={() => onTool(tool === t.key ? "none" : t.key)}
              >
                {t.label}
              </Toggle>
            ))}
            {drawingCount > 0 && (
              <Clear type="button" onClick={onClearDrawings}>
                작도 지우기 ({drawingCount})
              </Clear>
            )}
          </Group>
        </>
      )}
      {trailing && <Trailing>{trailing}</Trailing>}
      {activeTool && <Hint>{activeTool.label}: {activeTool.hint}</Hint>}
    </Bar>
  );
}

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
`;

const Group = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const Divider = styled.span`
  width: 1px;
  height: 18px;
  background: ${({ theme }) => theme.colors.border};
`;

const Chip = styled.button<{ $active: boolean }>`
  height: 30px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.surface : "transparent")};
  white-space: nowrap;

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }
`;

const Toggle = styled(Chip)`
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textWeak)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : "transparent")};
`;

const Clear = styled.button`
  height: 30px;
  padding: 0 10px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.rise};
  white-space: nowrap;
`;

const Trailing = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
`;

const Hint = styled.p`
  flex-basis: 100%;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.primary};
`;
