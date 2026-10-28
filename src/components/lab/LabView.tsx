"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import styled from "styled-components";
import { SAMPLE_SCRIPT } from "@/lib/lab/stores";
import { DATA_SOURCE, isIntervalKey, type IntervalKey } from "@/lib/market/candles";
import ChartWorkspace from "./ChartWorkspace";
import PineLab from "./PineLab";

// 기본 기간·시작 시점을 현재 시각으로 잡으므로 서버 렌더와 어긋나지 않게 브라우저에서만 그린다.
const BacktestLab = dynamic(() => import("./BacktestLab"), { ssr: false });
const ReplayLab = dynamic(() => import("./ReplayLab"), { ssr: false });

export type LabTab = "workspace" | "pine" | "backtest" | "replay";
const TABS: LabTab[] = ["workspace", "pine", "backtest", "replay"];

const STEPS: { tab?: LabTab; label: string; note: string }[] = [
  { tab: "workspace", label: "차트 열기", note: "멀티 차트 · 작도 · 관심목록" },
  { tab: "pine", label: "지표·코드 가져오기", note: "Pine Script 포팅" },
  { tab: "backtest", label: "백테스트", note: "바 돋보기 · 검증 구간" },
  { tab: "replay", label: "리플레이 연습", note: "미래 봉 가리고 가상 매매" },
  { label: "저장", note: "전략·결과·연습 기록" },
  { label: "거래·자동매매", note: "서버 실행 연결 예정" },
];

export default function LabView() {
  const params = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<LabTab>(TABS.includes(initialTab as LabTab) ? (initialTab as LabTab) : "workspace");
  const [symbol, setSymbol] = useState((params.get("symbol") ?? "BTC").toUpperCase());
  const [interval, setLabInterval] = useState<IntervalKey>(() => {
    const value = params.get("interval");
    return isIntervalKey(value) ? value : "1h";
  });
  const [scriptId, setScriptId] = useState(SAMPLE_SCRIPT.id);

  const open = (next: LabTab, nextScriptId?: string) => {
    if (nextScriptId) setScriptId(nextScriptId);
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  return (
    <Wrapper>
      <Head>
        <div>
          <h1>차트·전략 실험실</h1>
          <p>분석 → 검증 → 연습 → 거래를 한 곳에서. 모든 계산은 {DATA_SOURCE} 데이터 하나로만 해요.</p>
        </div>
        <Beta>내부 개발 버전</Beta>
      </Head>

      <Steps>
        {STEPS.map((step, i) => {
          const active = step.tab === tab;
          const content = (
            <>
              <StepNo $active={active}>{i + 1}</StepNo>
              <span>
                <strong>{step.label}</strong>
                <small>{step.note}</small>
              </span>
            </>
          );
          if (step.tab) {
            return (
              <Step key={step.label} as="button" type="button" $active={active} onClick={() => open(step.tab!)}>
                {content}
              </Step>
            );
          }
          if (i === STEPS.length - 1) {
            return (
              <Step key={step.label} as={Link} href={`/trade/${symbol}`} $active={false}>
                {content}
              </Step>
            );
          }
          return (
            <Step key={step.label} as="div" $active={false} $passive>
              {content}
            </Step>
          );
        })}
      </Steps>

      {tab === "workspace" && <ChartWorkspace symbol={symbol} interval={interval} />}
      {tab === "pine" && <PineLab symbol={symbol} interval={interval} onBacktest={(id) => open("backtest", id)} />}
      {tab === "backtest" && (
        <BacktestLab
          symbol={symbol}
          interval={interval}
          scriptId={scriptId}
          onScriptChange={setScriptId}
          onMarketChange={(s, i) => {
            setSymbol(s);
            setLabInterval(i);
          }}
          onReplay={() => open("replay")}
        />
      )}
      {tab === "replay" && <ReplayLab symbol={symbol} interval={interval} scriptId={scriptId} />}
    </Wrapper>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h1 {
    font-size: 24px;
    font-weight: 700;
  }

  p {
    margin-top: 6px;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.textSub};
  }
`;

const Beta = styled.span`
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.primaryWeak};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
  font-weight: 700;
`;

const Steps = styled.nav`
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;

  @container main (max-width: 1000px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @container main (max-width: 560px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Step = styled.button<{ $active: boolean; $passive?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.bg)};
  text-align: left;
  opacity: ${({ $passive }) => ($passive ? 0.7 : 1)};

  span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  strong {
    font-size: 14px;
    font-weight: 700;
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
  }

  small {
    overflow: hidden;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const StepNo = styled.i<{ $active: boolean }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.surface)};
  color: ${({ theme, $active }) => ($active ? "#fff" : theme.colors.textSub)};
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
`;
