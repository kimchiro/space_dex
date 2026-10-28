"use client";

import { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import TradingChart, { type ChartHandle } from "@/components/chart/TradingChart";
import { checkRepaint, runBacktest, type BacktestResult, type BacktestSettings, type Metrics, type Trade } from "@/lib/backtest/engine";
import { MAX_MAGNIFIED_BARS, runWithMagnifier, type MagnifierReport } from "@/lib/backtest/magnifier";
import { newId, runsStore, useScripts, type SavedRun } from "@/lib/lab/stores";
import { DATA_SOURCE, INTERVALS, MAX_CANDLES, intervalLabel, intervalSeconds, lowerIntervalFor, marketPair, type Candle, type IntervalKey } from "@/lib/market/candles";
import { fetchCandles } from "@/lib/market/useCandles";
import { analyzePine, type InputValue, type PineAnalysis } from "@/lib/pine/analyze";
import { chartDataFromOutputs, tradeMarkers } from "./chartData";
import { EquityChart, PERIOD_LABEL, PeriodPnlChart, PnlDistribution, periodUnit } from "./ResultCharts";
import SymbolSelect from "./SymbolSelect";
import { Badge, Button, Card, CardHeader, Field, FormGrid, Input, Muted, Notice, Row, Select, Stat, StatGrid, SubTitle, Table, TableScroll, Title } from "./ui";
import { settingsFromScript, useAnalysis } from "./useScriptOverlay";

const DEFAULT_DAYS: Record<IntervalKey, number> = { "1m": 3, "5m": 14, "15m": 45, "1h": 120, "4h": 540, "1d": 1460, "1w": 3650 };

const toDateInput = (time: number) => new Date(time + 9 * 3600_000).toISOString().slice(0, 10);
const nowMs = () => Date.now();
const fromDateInput = (value: string, endOfDay = false) => Date.parse(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}+09:00`);

const fmtTime = (t: number) =>
  new Date(t * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtMoney = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const fmtPrice = (v: number) => (v >= 1 ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : v.toPrecision(5));

type RunOutput = {
  analysis: PineAnalysis;
  scriptId: string;
  inputs: Record<string, InputValue>;
  symbol: string;
  interval: IntervalKey;
  candles: Candle[];
  settings: BacktestSettings;
  normal: BacktestResult;
  magnified: { result: BacktestResult; report: MagnifierReport } | null;
  repaint: ReturnType<typeof checkRepaint>;
  truncated: boolean;
};

type Props = {
  symbol: string;
  interval: IntervalKey;
  scriptId: string;
  onScriptChange: (id: string) => void;
  onMarketChange: (symbol: string, interval: IntervalKey) => void;
  onReplay: () => void;
};

export default function BacktestLab({ symbol, interval, scriptId, onScriptChange, onMarketChange, onReplay }: Props) {
  const scripts = useScripts().filter((s) => s.kind === "strategy");
  const script = scripts.find((s) => s.id === scriptId) ?? scripts[0];
  const analysis = useAnalysis(script?.code);

  const [settings, setSettings] = useState<BacktestSettings>(() => settingsFromScript(analysis));
  const [from, setFrom] = useState(() => toDateInput(Date.now() - DEFAULT_DAYS[interval] * 86_400_000));
  const [to, setTo] = useState(() => toDateInput(Date.now()));
  const [magnifier, setMagnifier] = useState(true);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<RunOutput | null>(null);

  const estimatedBars = Math.max(0, Math.floor((fromDateInput(to, true) - fromDateInput(from)) / 1000 / intervalSeconds(interval)));
  const lower = lowerIntervalFor(interval);

  const set = <K extends keyof BacktestSettings>(key: K, value: number) => setSettings((s) => ({ ...s, [key]: value }));

  const run = async () => {
    if (!script || !analysis?.program) return;
    setError(null);
    setProgress(`${marketPair(symbol)} ${intervalLabel(interval)} 데이터를 불러오는 중…`);
    try {
      const start = fromDateInput(from);
      const end = Math.min(fromDateInput(to, true), nowMs());
      const data = await fetchCandles({ symbol, interval, start, end, limit: MAX_CANDLES });
      if (!data.supported) throw new Error(`${marketPair(symbol)} 마켓이 ${DATA_SOURCE}에 없어요.`);
      if (data.error) throw new Error(data.error);
      if (data.candles.length < 50) throw new Error("데이터가 50봉보다 적어요. 기간을 늘려 주세요.");
      const candles = data.candles;

      setProgress("전략을 실행하는 중…");
      await new Promise((r) => setTimeout(r, 0));
      const input = { analysis, candles, inputs: script.inputs, settings, intervalSeconds: intervalSeconds(interval), symbol, interval };
      const normal = runBacktest(input);
      const repaint = checkRepaint(input, normal);

      let magnified: RunOutput["magnified"] = null;
      if (magnifier && lower) {
        setProgress(`바 돋보기: ${lower} 하위 봉을 확인하는 중…`);
        magnified = await runWithMagnifier(input, (done, total) => setProgress(`바 돋보기: 하위 봉 ${done}/${total}개 확인`));
      }
      setOutput({ analysis, scriptId: script.id, inputs: script.inputs, symbol, interval, candles, settings, normal, magnified, repaint, truncated: candles.length >= MAX_CANDLES });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Wrapper>
      <Card>
        <CardHeader>
          <Title>백테스트 설정</Title>
          <Badge $tone="info">{DATA_SOURCE} · 같은 데이터로 계산</Badge>
        </CardHeader>
        <FormGrid>
          <Field>
            전략
            <Select
              value={script?.id}
              onChange={(e) => {
                onScriptChange(e.target.value);
                const next = scripts.find((s) => s.id === e.target.value);
                if (next) setSettings((s) => settingsFromScriptCode(next.code, s));
              }}
            >
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (r{s.revision})
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            종목
            <SymbolSelect value={symbol} onChange={(s) => onMarketChange(s, interval)} />
          </Field>
          <Field>
            시간봉
            <Select
              value={interval}
              onChange={(e) => {
                const next = e.target.value as IntervalKey;
                onMarketChange(symbol, next);
                setFrom(toDateInput(fromDateInput(to, true) - DEFAULT_DAYS[next] * 86_400_000));
              }}
            >
              {INTERVALS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            시작일
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field>
            종료일
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            <small>
              약 {estimatedBars.toLocaleString()}봉{estimatedBars > MAX_CANDLES && ` · 최대 ${MAX_CANDLES.toLocaleString()}봉까지만 계산`}
            </small>
          </Field>
          <Field>
            시작 자금 (USDT)
            <Input type="number" value={settings.initialCapital} min={1} onChange={(e) => set("initialCapital", Number(e.target.value))} />
          </Field>
          <Field>
            주문 수량 (자산 대비 %)
            <Input type="number" value={settings.qtyPercent} min={1} max={100} onChange={(e) => set("qtyPercent", Number(e.target.value))} />
          </Field>
          <Field>
            레버리지 (배)
            <Input type="number" value={settings.leverage} min={1} max={125} onChange={(e) => set("leverage", Number(e.target.value))} />
          </Field>
          <Field>
            수수료 (편도 %)
            <Input type="number" value={settings.feePct} step={0.01} min={0} onChange={(e) => set("feePct", Number(e.target.value))} />
          </Field>
          <Field>
            슬리피지 (%)
            <Input type="number" value={settings.slippagePct} step={0.01} min={0} onChange={(e) => set("slippagePct", Number(e.target.value))} />
            <small>시장가·손절 체결에 불리하게 적용</small>
          </Field>
          <Field>
            펀딩 비용 (8시간당 %)
            <Input type="number" value={settings.fundingPct8h} step={0.001} onChange={(e) => set("fundingPct8h", Number(e.target.value))} />
            <small>가정값 · 실제 펀딩 기록 미연동</small>
          </Field>
          <Field>
            검증 구간 (뒤쪽 %)
            <Input type="number" value={settings.validationPct} min={0} max={80} onChange={(e) => set("validationPct", Number(e.target.value))} />
          </Field>
        </FormGrid>
        <Row style={{ justifyContent: "space-between" }}>
          <ModeSwitch>
            <button type="button" aria-pressed={!magnifier} onClick={() => setMagnifier(false)}>
              일반 모드
            </button>
            <button type="button" aria-pressed={magnifier} onClick={() => setMagnifier(true)} disabled={!lower}>
              바 돋보기 {lower ? `(${lower} 하위 봉)` : "(1분봉은 하위 봉 없음)"}
            </button>
          </ModeSwitch>
          <Row>
            {progress && <Muted>{progress}</Muted>}
            <Button type="button" $variant="primary" onClick={run} disabled={!!progress || !analysis?.program}>
              백테스트 실행
            </Button>
          </Row>
        </Row>
        {analysis && !analysis.program && <Notice $tone="error">선택한 전략에 오류가 있어요. Pine 포팅 단계에서 고친 뒤 다시 저장해 주세요.</Notice>}
        {error && <Notice $tone="error">{error}</Notice>}
      </Card>

      {output && <Results output={output} onReplay={onReplay} scriptName={script?.name ?? ""} scriptRevision={script?.revision ?? 0} />}

      <SavedRuns />
    </Wrapper>
  );
}

function settingsFromScriptCode(code: string, base: BacktestSettings) {
  return settingsFromScript(analyzePine(code), base);
}

function Results({ output, onReplay, scriptName, scriptRevision }: { output: RunOutput; onReplay: () => void; scriptName: string; scriptRevision: number }) {
  const chartRef = useRef<ChartHandle>(null);
  const chartSectionRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"normal" | "magnified">(output.magnified ? "magnified" : "normal");
  const [selected, setSelected] = useState<number | undefined>(undefined);
  const [rerun, setRerun] = useState<{ same: boolean; fingerprint: string } | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const result = view === "magnified" && output.magnified ? output.magnified.result : output.normal;
  const { candles, analysis } = output;
  const from = candles[0].time;
  const to = candles[candles.length - 1].time;
  const unit = periodUnit(from, to);

  const chartData = useMemo(() => chartDataFromOutputs(result.outputs, analysis.overlay, candles.length), [result, analysis.overlay, candles.length]);
  const markers = useMemo(() => [...chartData.markers, ...tradeMarkers(result.trades, selected)], [chartData.markers, result.trades, selected]);

  const assumptions = [
    `시세: ${DATA_SOURCE} ${marketPair(output.symbol)} ${intervalLabel(output.interval)} (${candles.length.toLocaleString()}봉)`,
    "신호는 봉 종가 확정 후 계산하고, 주문은 다음 봉 시가에 체결",
    `수수료 편도 ${output.settings.feePct}% · 슬리피지 ${output.settings.slippagePct}% (시장가·손절에만 불리하게 적용, 익절 지정가는 그대로)`,
    `펀딩 비용 8시간당 ${output.settings.fundingPct8h}% — 가정값 (롱·숏 모두 비용으로 부과)`,
    "봉 내부 순서 기본 규칙: 시가에서 가까운 극값(고가 또는 저가)을 먼저 지난다고 가정",
    ...(analysis.diagnostics.some((d) => d.message.includes("0.01")) ? ["profit·loss 틱은 최소 호가 0.01로 가정"] : []),
  ];

  const selectTrade = (t: Trade) => {
    setSelected(t.no);
    const pad = intervalSeconds(output.interval) * 30;
    chartRef.current?.focusRange(t.entryTime - pad, t.exitTime + pad);
    chartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const verifyRerun = () => {
    const again = runBacktest({
      analysis,
      candles,
      inputs: output.inputs,
      settings: output.settings,
      intervalSeconds: intervalSeconds(output.interval),
      symbol: output.symbol,
      interval: output.interval,
    });
    setRerun({ same: again.fingerprint === output.normal.fingerprint, fingerprint: again.fingerprint });
  };

  const buildRun = (): SavedRun => ({
    id: newId(),
    createdAt: Date.now(),
    script: { id: output.scriptId, name: scriptName, hash: analysis.hash, revision: scriptRevision, inputs: output.inputs },
    symbol: output.symbol,
    interval: output.interval,
    data: { source: `${DATA_SOURCE} ${marketPair(output.symbol)}`, from, to, bars: candles.length },
    settings: output.settings,
    magnifier: { enabled: view === "magnified", report: output.magnified?.report },
    assumptions,
    metrics: result.metrics,
    fingerprint: result.fingerprint,
    trades: result.trades,
  });

  const save = () => {
    const run = buildRun();
    runsStore.write((prev) => [run, ...prev].slice(0, 20));
    setSavedId(run.id);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <Title>
              {scriptName} · {marketPair(output.symbol)} {intervalLabel(output.interval)}
            </Title>
            <Muted>
              {fmtTime(from)} ~ {fmtTime(to)} · {candles.length.toLocaleString()}봉 · 전략 버전 {analysis.hash} · 결과 지문 {result.fingerprint}
            </Muted>
          </div>
          <Row>
            {output.magnified && (
              <ModeSwitch>
                <button type="button" aria-pressed={view === "normal"} onClick={() => setView("normal")}>
                  일반 결과
                </button>
                <button type="button" aria-pressed={view === "magnified"} onClick={() => setView("magnified")}>
                  바 돋보기 결과
                </button>
              </ModeSwitch>
            )}
            <Button type="button" $size="sm" onClick={save}>
              {savedId ? "저장됨" : "결과 저장"}
            </Button>
            <Button type="button" $size="sm" onClick={() => download(`${output.symbol}-${output.interval}-${result.fingerprint}.json`, JSON.stringify(buildRun(), null, 2), "application/json")}>
              JSON
            </Button>
            <Button type="button" $size="sm" onClick={() => download(`${output.symbol}-${output.interval}-trades.csv`, tradesCsv(result.trades), "text/csv")}>
              거래 CSV
            </Button>
          </Row>
        </CardHeader>
        {output.truncated && <Notice $tone="warn">최대 {MAX_CANDLES.toLocaleString()}봉까지만 계산했어요. 종료 시각이 {fmtTime(to)}로 앞당겨졌어요.</Notice>}
        {result.warnings.map((w) => (
          <Notice key={w} $tone="error">
            {w}
          </Notice>
        ))}
        <StatGrid>
          <MetricStats m={result.metrics.all} />
        </StatGrid>
      </Card>

      <TwoCol>
        <Card>
          <SubTitle>학습 구간 vs 검증 구간</SubTitle>
          <Muted>
            검증 구간은 {fmtTime(result.boundaryTime)} 이후({output.settings.validationPct}%)예요. 입력값은 학습 구간에서만 맞추고, 검증 구간 성과로 과최적화를 확인하세요.
          </Muted>
          <Table>
            <thead>
              <tr>
                <th />
                <th>전체</th>
                <th>학습</th>
                <th>검증</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map(([label, get]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{get(result.metrics.all)}</td>
                  <td>{get(result.metrics.train)}</td>
                  <td>{get(result.metrics.test)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <SubTitle>바 돋보기</SubTitle>
          {output.magnified ? (
            <>
              <Table>
                <thead>
                  <tr>
                    <th />
                    <th>일반</th>
                    <th>바 돋보기</th>
                  </tr>
                </thead>
                <tbody>
                  {METRIC_ROWS.slice(0, 5).map(([label, get]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{get(output.normal.metrics.all)}</td>
                      <td>
                        <strong>{get(output.magnified!.result.metrics.all)}</strong>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>결과 지문</td>
                    <td>{output.normal.fingerprint}</td>
                    <td>{output.magnified.result.fingerprint}</td>
                  </tr>
                </tbody>
              </Table>
              <MagnifierInfo report={output.magnified.report} normal={output.normal} magnified={output.magnified.result} />
            </>
          ) : (
            <Muted>일반 모드로 실행했어요. 손절·익절이 한 봉 안에서 모두 닿은 봉 {output.normal.ambiguousBars.length}개는 기본 규칙(시가에서 가까운 쪽 먼저)으로 처리했어요.</Muted>
          )}
        </Card>
      </TwoCol>

      <Card ref={chartSectionRef}>
        <CardHeader>
          <SubTitle>진입·청산 위치</SubTitle>
          <Muted>아래 거래 목록을 누르면 해당 위치로 이동해요.</Muted>
        </CardHeader>
        <TradingChart
          ref={chartRef}
          candles={candles}
          indicators={{ volume: true, ma: false, bb: false, rsi: false }}
          overlays={chartData.overlays}
          markers={markers}
          priceLines={chartData.priceLines}
          viewKey={`${output.symbol}:${output.interval}:${result.fingerprint}`}
          height={420}
        />
      </Card>

      <TwoCol>
        <Card>
          <SubTitle>자산 변화 (비용 차감 후)</SubTitle>
          <EquityChart equity={result.equity} buyHold={result.buyHold} boundaryTime={result.boundaryTime} />
          <Muted>파란 선: 전략 자산 · 회색 점선: 같은 기간 보유만 했을 때</Muted>
        </Card>
        <Card>
          <SubTitle>{PERIOD_LABEL[unit]} 손익</SubTitle>
          <PeriodPnlChart trades={result.trades} unit={unit} />
          <SubTitle>거래별 손익 분포 (증거금 대비 %)</SubTitle>
          <PnlDistribution trades={result.trades} />
        </Card>
      </TwoCol>

      <Card>
        <CardHeader>
          <SubTitle>거래 목록 ({result.trades.length})</SubTitle>
          <Button type="button" $size="sm" onClick={onReplay}>
            이 구간을 리플레이로 연습 →
          </Button>
        </CardHeader>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>방향</th>
                <th>진입 시각</th>
                <th>진입가</th>
                <th>청산 시각</th>
                <th>청산가</th>
                <th>수량</th>
                <th>비용</th>
                <th>손익</th>
                <th>수익률</th>
                <th>청산 사유</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.map((t) => (
                <TradeRow key={t.no} $selected={t.no === selected} onClick={() => selectTrade(t)}>
                  <td>{t.no}</td>
                  <td>{t.direction === 1 ? "롱" : "숏"}</td>
                  <td>{fmtTime(t.entryTime)}</td>
                  <td>{fmtPrice(t.entryPrice)}</td>
                  <td>{fmtTime(t.exitTime)}</td>
                  <td>{fmtPrice(t.exitPrice)}</td>
                  <td>{t.qty.toPrecision(4)}</td>
                  <td title={`수수료 ${fmtMoney(t.fees)} · 펀딩 ${fmtMoney(t.funding)}`}>{fmtMoney(t.fees + t.funding)}</td>
                  <td style={{ color: t.pnl >= 0 ? "#f04452" : "#3182f6" }}>{fmtMoney(t.pnl)}</td>
                  <td style={{ color: t.pnl >= 0 ? "#f04452" : "#3182f6" }}>{fmtPct(t.pnlPct)}</td>
                  <td>
                    {t.exitReason}
                    {t.intrabar === "magnified" && <Badge $tone="info"> 하위 봉</Badge>}
                    {t.intrabar === "assumed" && <Badge $tone="warn"> 기본 규칙</Badge>}
                  </td>
                </TradeRow>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </Card>

      <TwoCol>
        <Card>
          <SubTitle>검증 점검</SubTitle>
          <CheckList>
            <li>
              <Badge $tone="ok">통과</Badge>
              <span>
                <strong>미래 정보 사용 없음</strong> — 각 봉의 종가가 확정된 뒤에만 계산하고, 주문은 다음 봉 시가에 체결해요. 다른 시간봉 참조(request.security)는 막혀 있어요.
              </span>
            </li>
            <li>
              <Badge $tone={output.repaint.ok ? "ok" : "error"}>{output.repaint.ok ? "통과" : "주의"}</Badge>
              <span>
                <strong>리페인트 점검</strong> — 앞 70% 데이터만으로 다시 실행해 같은 구간 거래 {output.repaint.compared}건을 비교했어요.{" "}
                {output.repaint.ok ? "모두 같아요." : `${output.repaint.mismatches}건이 달라요.`}
              </span>
            </li>
            <li>
              <Badge $tone={result.metrics.test.trades === 0 ? "warn" : result.metrics.test.returnPct < result.metrics.train.returnPct / 2 ? "warn" : "ok"}>
                {result.metrics.test.trades === 0 ? "확인 필요" : result.metrics.test.returnPct < result.metrics.train.returnPct / 2 ? "주의" : "통과"}
              </Badge>
              <span>
                <strong>학습·검증 구간 분리</strong> — 학습 {fmtPct(result.metrics.train.returnPct)} / 검증 {fmtPct(result.metrics.test.returnPct)}.
                {result.metrics.test.trades === 0 ? " 검증 구간에 거래가 없어요." : ""}
              </span>
            </li>
            <li>
              <Badge $tone={rerun ? (rerun.same ? "ok" : "error") : "neutral"}>{rerun ? (rerun.same ? "통과" : "불일치") : "미확인"}</Badge>
              <span>
                <strong>재현성</strong> — 같은 데이터·설정으로 다시 실행하면 결과 지문이 같아야 해요.{" "}
                {rerun ? `다시 실행 지문 ${rerun.fingerprint}` : ""}
              </span>
              <Button type="button" $size="sm" onClick={verifyRerun}>
                다시 실행
              </Button>
            </li>
          </CheckList>
        </Card>
        <Card>
          <SubTitle>체결·비용 가정</SubTitle>
          <AssumptionList>
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </AssumptionList>
          <Notice $tone="warn">백테스트는 과거 데이터로 한 모의 계산이에요. 실제 체결·수익을 보장하지 않아요.</Notice>
        </Card>
      </TwoCol>
    </>
  );
}

function MagnifierInfo({ report, normal, magnified }: { report: MagnifierReport; normal: BacktestResult; magnified: BacktestResult }) {
  return (
    <AssumptionList>
      <li>
        사용한 하위 시간봉: <strong>{report.lowerInterval}</strong> ({DATA_SOURCE})
      </li>
      <li>
        일반 모드에서 손절·익절 순서가 불명확한 봉 {normal.ambiguousBars.length}개 → 하위 봉으로 순서를 정한 봉 <strong>{report.resolved.length}개</strong>
      </li>
      <li>
        하위 봉이 없어 기본 규칙을 쓴 봉 <strong>{report.missing.length}개</strong>
        {report.capped && ` (한 번에 최대 ${MAX_MAGNIFIED_BARS}개까지만 확인)`}
      </li>
      {report.coverage && (
        <li>
          확보한 하위 봉 구간: {fmtTime(report.coverage.from)} ~ {fmtTime(report.coverage.to)} (필요한 봉만 받아왔어요)
        </li>
      )}
      <li>
        하위 봉 하나 안에서도 손절·익절이 모두 닿은 경우 {magnified.assumedInSub}회는 같은 기본 규칙(시가에서 가까운 쪽 먼저)으로 처리했어요. 모든 실제 체결을 재현하지는 않아요.
      </li>
    </AssumptionList>
  );
}

const METRIC_ROWS: [string, (m: Metrics) => string][] = [
  ["순손익", (m) => fmtMoney(m.netProfit)],
  ["수익률", (m) => fmtPct(m.returnPct)],
  ["최대 낙폭", (m) => `${m.maxDrawdownPct.toFixed(2)}%`],
  ["승률", (m) => `${m.winRate.toFixed(1)}%`],
  ["거래 횟수", (m) => `${m.trades}회`],
  ["평균 거래 손익", (m) => fmtMoney(m.avgTrade)],
  ["손익비", (m) => (Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞")],
];

function MetricStats({ m }: { m: Metrics }) {
  return (
    <>
      <Stat>
        <dt>순손익 (비용 차감)</dt>
        <dd style={{ color: m.netProfit >= 0 ? "#f04452" : "#3182f6" }}>{fmtMoney(m.netProfit)}</dd>
      </Stat>
      <Stat>
        <dt>수익률</dt>
        <dd style={{ color: m.returnPct >= 0 ? "#f04452" : "#3182f6" }}>{fmtPct(m.returnPct)}</dd>
      </Stat>
      <Stat>
        <dt>최대 낙폭</dt>
        <dd>
          {m.maxDrawdownPct.toFixed(2)}% <small>({fmtMoney(m.maxDrawdown)})</small>
        </dd>
      </Stat>
      <Stat>
        <dt>승률</dt>
        <dd>{m.winRate.toFixed(1)}%</dd>
      </Stat>
      <Stat>
        <dt>거래 횟수</dt>
        <dd>{m.trades}회</dd>
      </Stat>
      <Stat>
        <dt>평균 거래 손익</dt>
        <dd>{fmtMoney(m.avgTrade)}</dd>
      </Stat>
      <Stat>
        <dt>수수료 합계</dt>
        <dd>{fmtMoney(m.fees)}</dd>
      </Stat>
      <Stat>
        <dt>펀딩 합계 (가정)</dt>
        <dd>{fmtMoney(m.funding)}</dd>
      </Stat>
    </>
  );
}

function SavedRuns() {
  const runs = runsStore.useValue();
  if (runs.length === 0) return null;
  return (
    <Card>
      <SubTitle>저장한 백테스트 ({runs.length})</SubTitle>
      <TableScroll style={{ maxHeight: 260 }}>
        <Table>
          <thead>
            <tr>
              <th>저장 시각</th>
              <th>전략</th>
              <th>시장</th>
              <th>모드</th>
              <th>수익률</th>
              <th>최대 낙폭</th>
              <th>거래</th>
              <th>지문</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString("ko-KR")}</td>
                <td>
                  {r.script.name} r{r.script.revision}
                </td>
                <td>
                  {marketPair(r.symbol)} {r.interval}
                </td>
                <td>{r.magnifier.enabled ? "바 돋보기" : "일반"}</td>
                <td>{fmtPct(r.metrics.all.returnPct)}</td>
                <td>{r.metrics.all.maxDrawdownPct.toFixed(2)}%</td>
                <td>{r.metrics.all.trades}</td>
                <td>{r.fingerprint}</td>
                <td>
                  <Row $gap={4} style={{ justifyContent: "flex-end" }}>
                    <Button type="button" $size="sm" onClick={() => download(`run-${r.fingerprint}.json`, JSON.stringify(r, null, 2), "application/json")}>
                      내보내기
                    </Button>
                    <Button type="button" $size="sm" $variant="danger" onClick={() => runsStore.write((prev) => prev.filter((p) => p.id !== r.id))}>
                      삭제
                    </Button>
                  </Row>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
    </Card>
  );
}

function tradesCsv(trades: Trade[]) {
  const header = "no,direction,entry_time,entry_price,exit_time,exit_price,qty,fees,funding,pnl,pnl_pct,exit_reason,intrabar";
  const rows = trades.map((t) =>
    [t.no, t.direction === 1 ? "long" : "short", new Date(t.entryTime * 1000).toISOString(), t.entryPrice, new Date(t.exitTime * 1000).toISOString(), t.exitPrice, t.qty, t.fees, t.funding, t.pnl, t.pnlPct, t.exitReason, t.intrabar ?? ""].join(","),
  );
  return [header, ...rows].join("\n");
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;

  @container main (max-width: 980px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const ModeSwitch = styled.div`
  display: inline-flex;
  padding: 3px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};

  button {
    height: 32px;
    padding: 0 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
  }

  button[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    box-shadow: ${({ theme }) => theme.shadow.card};
  }

  button:disabled {
    opacity: 0.5;
  }
`;

const TradeRow = styled.tr<{ $selected: boolean }>`
  cursor: pointer;
  background: ${({ theme, $selected }) => ($selected ? theme.colors.primaryWeak : "transparent")};

  &:hover {
    background: ${({ theme }) => theme.colors.bgSub};
  }
`;

const CheckList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 12px;

  li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    line-height: 1.55;
    color: ${({ theme }) => theme.colors.textSub};
  }

  li > span {
    flex: 1;
  }

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const AssumptionList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-left: 16px;
  list-style: disc;
  font-size: 13px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textSub};
`;
