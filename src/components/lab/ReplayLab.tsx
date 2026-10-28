"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import TradingChart, { type ChartHandle, type ChartMarker, type IndicatorConfig, type PriceLineSpec } from "@/components/chart/TradingChart";
import { newId, replayStore, useScripts, type ReplaySession } from "@/lib/lab/stores";
import { EMPTY_BOOK, REPLAY_FEE_PCT, REPLAY_START_BALANCE, advance, closePosition, equityOf, fill, type ReplayBook } from "@/lib/lab/replaySim";
import { DATA_SOURCE, INTERVALS, MAX_CANDLES, intervalLabel, intervalSeconds, marketPair, type Candle, type IntervalKey } from "@/lib/market/candles";
import { fetchCandles } from "@/lib/market/useCandles";
import { theme } from "@/styles/theme";
import SymbolSelect from "./SymbolSelect";
import { Badge, Button, Card, CardHeader, Field, FormGrid, Input, Muted, Notice, Row, Select, Stat, StatGrid, SubTitle, Table, TableScroll, TextArea, Title } from "./ui";
import { useScriptOverlay } from "./useScriptOverlay";

const BARS_BEFORE = 200;
const BARS_AFTER = 1000;
const SPEEDS = [1, 2, 5, 10] as const;

const toInput = (sec: number) => new Date((sec + 9 * 3600) * 1000).toISOString().slice(0, 16);
const fromInput = (value: string) => Math.floor(Date.parse(`${value}:00+09:00`) / 1000);
const fmtTime = (t: number) =>
  new Date(t * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const fmtNum = (v: number, digits = 2) => v.toLocaleString("en-US", { maximumFractionDigits: v !== 0 && Math.abs(v) < 1 ? 6 : digits });

type Sim = { cursor: number; book: ReplayBook; events: string[] };
type Loaded = { symbol: string; interval: IntervalKey; startTime: number; candles: Candle[] };

export default function ReplayLab({ symbol: initialSymbol, interval: initialInterval, scriptId: initialScriptId }: { symbol: string; interval: IntervalKey; scriptId: string }) {
  const scripts = useScripts();
  const [symbol, setSymbol] = useState(initialSymbol);
  const [interval, setReplayInterval] = useState(initialInterval);
  const [startInput, setStartInput] = useState(() => toInput(Math.floor(Date.now() / 1000) - intervalSeconds(initialInterval) * 600));
  const [scriptId, setScriptId] = useState<string | null>(initialScriptId);
  const [listing, setListing] = useState<{ symbol: string; time: number | null } | null>(null);

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sim, setSim] = useState<Sim>({ cursor: 0, book: EMPTY_BOOK, events: [] });
  const [notes, setNotes] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const [indicators, setIndicators] = useState<IndicatorConfig>({ volume: true, ma: true, bb: false, rsi: false });
  const [compare, setCompare] = useState<{ symbol: string; interval: IntervalKey } | null>(null);

  const chartRef = useRef<ChartHandle>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchCandles({ symbol, interval: "1d", start: 0, limit: 1 }, controller.signal)
      .then((r) => setListing({ symbol, time: r.supported && r.candles[0] ? r.candles[0].time : null }))
      .catch(() => {});
    return () => controller.abort();
  }, [symbol]);

  const load = async (opts: { symbol: string; interval: IntervalKey; startTime: number; session?: ReplaySession }) => {
    setLoading(true);
    setError(null);
    setPlaying(false);
    try {
      const sec = intervalSeconds(opts.interval);
      const after = opts.session ? Math.min(MAX_CANDLES, Math.ceil((opts.session.cursorTime - opts.startTime) / sec) + BARS_AFTER) : BARS_AFTER;
      const [before, rest] = await Promise.all([
        fetchCandles({ symbol: opts.symbol, interval: opts.interval, end: opts.startTime * 1000 - 1, limit: BARS_BEFORE }),
        fetchCandles({ symbol: opts.symbol, interval: opts.interval, start: opts.startTime * 1000, limit: after }),
      ]);
      if (!before.supported || !rest.supported) throw new Error(`${marketPair(opts.symbol)} 마켓이 ${DATA_SOURCE}에 없어요.`);
      if (before.error || rest.error) throw new Error(before.error ?? rest.error);
      if (before.candles.length === 0) throw new Error("시작 시점 이전 데이터가 없어요. 상장일 이후로 시작 시점을 바꿔 주세요.");
      if (rest.candles.length === 0) throw new Error("시작 시점 이후 데이터가 없어요. 더 과거 시점을 골라 주세요.");
      const candles = [...before.candles, ...rest.candles];
      const s = opts.session;
      const cursor = s ? Math.max(before.candles.length - 1, candles.findLastIndex((c) => c.time <= s.cursorTime)) : before.candles.length - 1;
      setLoaded({ symbol: opts.symbol, interval: opts.interval, startTime: opts.startTime, candles });
      setSim({ cursor, book: s ? { balance: s.balance, position: s.position, orders: s.orders, trades: s.trades } : EMPTY_BOOK, events: [] });
      setNotes(s?.notes ?? "");
      setSessionId(s?.id ?? null);
      setSavedAt(s?.savedAt ?? null);
      if (s) {
        setCompare(s.compare);
        setScriptId(s.scriptId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!loaded) return;
    setLoading(true);
    try {
      const last = loaded.candles[loaded.candles.length - 1];
      const more = await fetchCandles({ symbol: loaded.symbol, interval: loaded.interval, start: (last.time + 1) * 1000, limit: BARS_AFTER });
      if (more.supported && more.candles.length > 0) setLoaded({ ...loaded, candles: [...loaded.candles, ...more.candles] });
      else setError("더 불러올 데이터가 없어요. 최신 봉까지 재생했어요.");
    } finally {
      setLoading(false);
    }
  };

  const candles = useMemo(() => loaded?.candles ?? [], [loaded]);
  const revealed = useMemo(() => candles.slice(0, sim.cursor + 1), [candles, sim.cursor]);
  const current = revealed[revealed.length - 1];
  const atEnd = sim.cursor >= candles.length - 1;
  const intervalSec = loaded ? intervalSeconds(loaded.interval) : 0;
  const nowTime = current ? current.time + intervalSec : 0;

  const step = () =>
    setSim((s) => {
      if (s.cursor >= candles.length - 1) return s;
      const bar = candles[s.cursor + 1];
      let k = 0;
      const r = advance(s.book, bar, () => `${bar.time}-${k++}`);
      return { cursor: s.cursor + 1, book: r.book, events: r.events.length ? r.events : s.events };
    });

  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const running = playing && !atEnd;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => stepRef.current(), 1000 / speed);
    return () => window.clearInterval(id);
  }, [running, speed]);

  const script = scripts.find((s) => s.id === scriptId) ?? null;
  const overlay = useScriptOverlay(script, revealed, loaded?.symbol ?? symbol, loaded?.interval ?? interval);

  const markers = useMemo<ChartMarker[]>(() => {
    const own = sim.book.trades.flatMap((t) => [
      { time: t.entryTime, position: t.side === 1 ? "belowBar" : "aboveBar", color: "#191f28", shape: t.side === 1 ? "arrowUp" : "arrowDown", text: `연습 ${t.side === 1 ? "매수" : "매도"}` },
      { time: t.exitTime, position: t.side === 1 ? "aboveBar" : "belowBar", color: t.pnl >= 0 ? "#00a36c" : "#8b95a1", shape: "square", text: `${t.reason} ${t.pnl >= 0 ? "+" : ""}${fmtNum(t.pnl)}` },
    ]) satisfies ChartMarker[];
    const p = sim.book.position;
    const open: ChartMarker[] = p ? [{ time: p.entryTime, position: p.side === 1 ? "belowBar" : "aboveBar", color: "#191f28", shape: p.side === 1 ? "arrowUp" : "arrowDown", text: "연습 진입" }] : [];
    return [...overlay.markers, ...own, ...open].sort((a, b) => a.time - b.time);
  }, [overlay.markers, sim.book]);

  const priceLines = useMemo<PriceLineSpec[]>(() => {
    const p = sim.book.position;
    const lines: PriceLineSpec[] = [...overlay.priceLines];
    if (p) {
      lines.push({ price: p.entryPrice, color: "#191f28", title: `평단 ${p.side === 1 ? "롱" : "숏"}` });
      if (p.stop) lines.push({ price: p.stop, color: theme.colors.fall, title: "손절", dashed: true });
      if (p.take) lines.push({ price: p.take, color: theme.colors.rise, title: "익절", dashed: true });
    }
    for (const o of sim.book.orders) lines.push({ price: o.price, color: "#ff9500", title: `지정가 ${o.side === 1 ? "매수" : "매도"}`, dashed: true });
    return lines;
  }, [overlay.priceLines, sim.book]);

  const sessionPayload = (): ReplaySession | null =>
    loaded && current
      ? {
          id: sessionId ?? newId(),
          name: `${marketPair(loaded.symbol)} ${intervalLabel(loaded.interval)} · ${fmtTime(loaded.startTime)}`,
          symbol: loaded.symbol,
          interval: loaded.interval,
          startTime: loaded.startTime,
          cursorTime: current.time,
          compare,
          scriptId,
          ...sim.book,
          notes,
          savedAt: Date.now(),
        }
      : null;

  const save = () => {
    const session = sessionPayload();
    if (!session) return;
    replayStore.write((prev) => [session, ...prev.filter((p) => p.id !== session.id)].slice(0, 20));
    setSessionId(session.id);
    setSavedAt(session.savedAt);
  };

  const saveImage = () => {
    const url = chartRef.current?.screenshot();
    if (!url || !loaded || !current) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `replay-${loaded.symbol}-${loaded.interval}-${current.time}.png`;
    a.click();
  };

  return (
    <Wrapper>
      <PracticeBanner>
        <div>
          <Badge $tone="warn">연습 모드</Badge>
          <span>리플레이의 주문·잔고는 가상이에요. 실제 주문·자산과 완전히 분리돼 있어요.</span>
        </div>
        <Link href={`/trade/${loaded?.symbol ?? symbol}`}>실시간 차트로 돌아가기 →</Link>
      </PracticeBanner>

      <Card>
        <CardHeader>
          <Title>리플레이 시작</Title>
          <Muted>
            {DATA_SOURCE} {marketPair(symbol)} 데이터 범위: {listing?.symbol === symbol ? (listing.time ? `${fmtTime(listing.time)} ~ 현재` : "확인 불가") : "확인 중…"} · 최소 단위 1분봉 (초 단위
            데이터가 없어 초 단위 리플레이는 지원하지 않아요)
          </Muted>
        </CardHeader>
        <FormGrid>
          <Field>
            종목
            <SymbolSelect value={symbol} onChange={setSymbol} />
          </Field>
          <Field>
            시간봉
            <Select value={interval} onChange={(e) => setReplayInterval(e.target.value as IntervalKey)}>
              {INTERVALS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            시작 시점 (한국 시간)
            <Input type="datetime-local" value={startInput} onChange={(e) => setStartInput(e.target.value)} />
            <small>이전 {BARS_BEFORE}봉을 보여주고 이후 봉은 가린 채 시작해요.</small>
          </Field>
          <Field>
            지표·전략 신호
            <Select value={scriptId ?? ""} onChange={(e) => setScriptId(e.target.value || null)}>
              <option value="">표시 안 함</option>
              {scripts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.kind === "strategy" ? "전략" : "지표"} · {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
        <Row style={{ justifyContent: "flex-end" }}>
          <Button type="button" $variant="primary" disabled={loading || !startInput} onClick={() => load({ symbol, interval, startTime: fromInput(startInput) })}>
            {loading ? "불러오는 중…" : loaded ? "새로 시작" : "리플레이 시작"}
          </Button>
        </Row>
        {error && <Notice $tone="error">{error}</Notice>}
      </Card>

      {loaded && current && (
        <>
          <Card>
            <Controls>
              <Row $gap={6}>
                <Button type="button" $variant="primary" onClick={() => setPlaying(!running)} disabled={atEnd}>
                  {running ? "일시정지" : "재생"}
                </Button>
                <Button type="button" onClick={step} disabled={running || atEnd}>
                  한 봉 앞으로
                </Button>
                <Speeds>
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                      {s}x
                    </button>
                  ))}
                </Speeds>
                <Muted>초당 {speed}봉</Muted>
              </Row>
              <Row $gap={6}>
                <Clock>
                  {marketPair(loaded.symbol)} {intervalLabel(loaded.interval)} · <strong>{fmtTime(nowTime)}</strong> 기준
                </Clock>
                <Muted>
                  {sim.cursor + 1}/{candles.length}봉
                </Muted>
                {atEnd && (
                  <Button type="button" $size="sm" onClick={loadMore} disabled={loading}>
                    다음 {BARS_AFTER}봉 불러오기
                  </Button>
                )}
              </Row>
            </Controls>
            <Row $gap={6} $wrap>
              {(["volume", "ma", "bb", "rsi"] as const).map((key) => (
                <Toggle key={key} type="button" aria-pressed={indicators[key]} onClick={() => setIndicators((i) => ({ ...i, [key]: !i[key] }))}>
                  {{ volume: "거래량", ma: "이동평균 20·60", bb: "볼린저밴드", rsi: "RSI 14" }[key]}
                </Toggle>
              ))}
              {overlay.error && <Badge $tone="error">{overlay.error}</Badge>}
              <Muted>지표와 신호는 현재 시점까지 공개된 봉만으로 계산해요.</Muted>
            </Row>
            <TradingChart
              ref={chartRef}
              candles={revealed}
              indicators={indicators}
              overlays={overlay.overlays}
              markers={markers}
              priceLines={priceLines}
              viewKey={`${loaded.symbol}:${loaded.interval}:${loaded.startTime}`}
              height={460}
            />
            {sim.events.length > 0 && (
              <Events>
                {sim.events.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </Events>
            )}
          </Card>

          <CompareCard compare={compare} onCompare={setCompare} baseSymbol={loaded.symbol} from={candles[0].time} to={candles[candles.length - 1].time} nowTime={nowTime} />

          <TwoCol>
            <OrderPanel
              book={sim.book}
              price={current.close}
              time={current.time}
              onBook={(book, events) => setSim((s) => ({ ...s, book, events }))}
            />
            <Card>
              <CardHeader>
                <SubTitle>세션</SubTitle>
                <Muted>{savedAt ? `${new Date(savedAt).toLocaleString("ko-KR")} 저장됨` : "저장 전"}</Muted>
              </CardHeader>
              <Field>
                연습 메모 (전체 판단 근거·복기)
                <TextArea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="예: 4시간봉 추세 위에서만 롱. 손절을 너무 타이트하게 잡아 두 번 털림." />
              </Field>
              <Row>
                <Button type="button" $variant="primary" onClick={save}>
                  세션 저장 (이어하기 가능)
                </Button>
                <Button type="button" onClick={saveImage}>
                  차트 이미지 저장
                </Button>
              </Row>
            </Card>
          </TwoCol>

          <Card>
            <SubTitle>연습 거래 ({sim.book.trades.length})</SubTitle>
            {sim.book.trades.length === 0 ? (
              <Muted>아직 정리한 거래가 없어요.</Muted>
            ) : (
              <TableScroll>
                <Table>
                  <thead>
                    <tr>
                      <th>방향</th>
                      <th>진입</th>
                      <th>청산</th>
                      <th>손익 (수수료 포함)</th>
                      <th>사유</th>
                      <th>진입 이유·실수 메모</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sim.book.trades.map((t) => (
                      <tr key={t.id}>
                        <td>{t.side === 1 ? "롱" : "숏"}</td>
                        <td>
                          {fmtTime(t.entryTime)} · {fmtNum(t.entryPrice)}
                        </td>
                        <td>
                          {fmtTime(t.exitTime)} · {fmtNum(t.exitPrice)}
                        </td>
                        <td style={{ color: t.pnl >= 0 ? theme.colors.rise : theme.colors.fall }}>
                          {t.pnl >= 0 ? "+" : ""}
                          {fmtNum(t.pnl)} USDT
                        </td>
                        <td>{t.reason}</td>
                        <td>
                          <Input
                            value={t.memo}
                            placeholder="메모"
                            onChange={(e) =>
                              setSim((s) => ({ ...s, book: { ...s.book, trades: s.book.trades.map((x) => (x.id === t.id ? { ...x, memo: e.target.value } : x)) } }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            )}
          </Card>
        </>
      )}

      <SavedSessions onResume={(s) => load({ symbol: s.symbol, interval: s.interval, startTime: s.startTime, session: s }).then(() => {
        setSymbol(s.symbol);
        setReplayInterval(s.interval);
        setStartInput(toInput(s.startTime));
      })} />
    </Wrapper>
  );
}

function OrderPanel({ book, price, time, onBook }: { book: ReplayBook; price: number; time: number; onBook: (book: ReplayBook, events: string[]) => void }) {
  const [side, setSide] = useState<1 | -1>(1);
  const [type, setType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [amount, setAmount] = useState("1000");
  const [stop, setStop] = useState("");
  const [take, setTake] = useState("");

  const p = book.position;
  const equity = equityOf(book, price);
  const unrealized = p ? p.side * (price - p.entryPrice) * p.qty : 0;
  const optional = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : undefined);

  const submit = () => {
    const amt = Number(amount);
    if (!(amt > 0)) return onBook(book, ["주문 금액을 입력해 주세요."]);
    const order = { side, amount: amt, stop: optional(stop), take: optional(take) };
    if (type === "market") {
      const r = fill(book, order, price, time, `${time}-m${book.trades.length}`, "시장가");
      return onBook(r.book, r.events);
    }
    const lp = Number(limitPrice);
    if (!(lp > 0)) return onBook(book, ["지정가를 입력해 주세요."]);
    onBook({ ...book, orders: [...book.orders, { ...order, id: `${time}-o${book.orders.length}-${lp}`, type: "limit", price: lp }] }, [
      `지정가 ${side === 1 ? "매수" : "매도"} ${fmtNum(lp)} 접수 — 다음 봉부터 체결을 확인해요.`,
    ]);
  };

  return (
    <Card>
      <CardHeader>
        <SubTitle>가상 주문</SubTitle>
        <Muted>
          시작 잔고 {REPLAY_START_BALANCE.toLocaleString()} USDT · 수수료 {REPLAY_FEE_PCT}% · 레버리지 1배
        </Muted>
      </CardHeader>
      <StatGrid>
        <Stat>
          <dt>총자산</dt>
          <dd>{fmtNum(equity)} USDT</dd>
        </Stat>
        <Stat>
          <dt>누적 손익</dt>
          <dd style={{ color: equity >= REPLAY_START_BALANCE ? theme.colors.rise : theme.colors.fall }}>
            {equity >= REPLAY_START_BALANCE ? "+" : ""}
            {fmtNum(equity - REPLAY_START_BALANCE)}
          </dd>
        </Stat>
        <Stat>
          <dt>주문 가능</dt>
          <dd>{fmtNum(book.balance)} USDT</dd>
        </Stat>
        <Stat>
          <dt>평가 손익</dt>
          <dd style={{ color: unrealized >= 0 ? theme.colors.rise : theme.colors.fall }}>{p ? fmtNum(unrealized) : "-"}</dd>
        </Stat>
      </StatGrid>

      {p && (
        <Notice $tone="info">
          {p.side === 1 ? "롱" : "숏"} {fmtNum(p.qty, 6)}개 · 평단 {fmtNum(p.entryPrice)}
          {p.stop ? ` · 손절 ${fmtNum(p.stop)}` : ""}
          {p.take ? ` · 익절 ${fmtNum(p.take)}` : ""}{" "}
          <Button
            type="button"
            $size="sm"
            onClick={() => {
              const r = closePosition(book, price, time, "수동 정리", `${time}-c${book.trades.length}`);
              onBook(r.book, r.events);
            }}
          >
            현재가 정리
          </Button>
        </Notice>
      )}

      <Row $gap={6}>
        <SideButton type="button" $side={1} aria-pressed={side === 1} onClick={() => setSide(1)}>
          매수 (롱)
        </SideButton>
        <SideButton type="button" $side={-1} aria-pressed={side === -1} onClick={() => setSide(-1)}>
          매도 (숏)
        </SideButton>
      </Row>
      <FormGrid>
        <Field>
          주문 유형
          <Select value={type} onChange={(e) => setType(e.target.value as "market" | "limit")}>
            <option value="market">시장가 (현재 {fmtNum(price)})</option>
            <option value="limit">지정가</option>
          </Select>
        </Field>
        {type === "limit" && (
          <Field>
            지정가
            <Input type="number" value={limitPrice} placeholder={String(price)} onChange={(e) => setLimitPrice(e.target.value)} />
          </Field>
        )}
        <Field>
          주문 금액 (USDT)
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field>
          손절가 (선택)
          <Input type="number" value={stop} onChange={(e) => setStop(e.target.value)} />
        </Field>
        <Field>
          익절가 (선택)
          <Input type="number" value={take} onChange={(e) => setTake(e.target.value)} />
        </Field>
      </FormGrid>
      <Button type="button" $variant={side === 1 ? "danger" : "primary"} onClick={submit}>
        가상 {side === 1 ? "매수" : "매도"} 주문
      </Button>
      <Muted>반대 방향 주문은 보유 포지션을 전량 정리해요. 한 봉에서 손절·익절이 모두 닿으면 시가에서 가까운 쪽을 먼저 처리해요.</Muted>

      {book.orders.length > 0 && (
        <Table>
          <tbody>
            {book.orders.map((o) => (
              <tr key={o.id}>
                <td>지정가 {o.side === 1 ? "매수" : "매도"}</td>
                <td>{fmtNum(o.price)}</td>
                <td>{fmtNum(o.amount)} USDT</td>
                <td>
                  <Button type="button" $size="sm" $variant="ghost" onClick={() => onBook({ ...book, orders: book.orders.filter((x) => x.id !== o.id) }, ["지정가 주문을 취소했어요."])}>
                    취소
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function CompareCard({
  compare,
  onCompare,
  baseSymbol,
  from,
  to,
  nowTime,
}: {
  compare: { symbol: string; interval: IntervalKey } | null;
  onCompare: (c: { symbol: string; interval: IntervalKey } | null) => void;
  baseSymbol: string;
  from: number;
  to: number;
  nowTime: number;
}) {
  const [data, setData] = useState<{ key: string; candles: Candle[]; error: string | null } | null>(null);
  const key = compare ? `${compare.symbol}:${compare.interval}:${from}:${to}` : null;

  useEffect(() => {
    if (!compare || !key) return;
    const controller = new AbortController();
    fetchCandles({ symbol: compare.symbol, interval: compare.interval, start: from * 1000, end: (to + 86_400) * 1000, limit: MAX_CANDLES }, controller.signal)
      .then((r) => setData({ key, candles: r.supported ? r.candles : [], error: r.supported ? (r.error ?? null) : `${marketPair(compare.symbol)} 마켓이 없어요.` }))
      .catch(() => {});
    return () => controller.abort();
  }, [compare, key, from, to]);

  const visible = useMemo(() => {
    if (!compare || !data || data.key !== key) return [];
    const sec = intervalSeconds(compare.interval);
    return data.candles.filter((c) => c.time + sec <= nowTime);
  }, [compare, data, key, nowTime]);

  return (
    <Card>
      <CardHeader>
        <SubTitle>동기화 비교 차트</SubTitle>
        <Row $gap={6}>
          {compare ? (
            <>
              <SymbolSelect value={compare.symbol} onChange={(s) => onCompare({ ...compare, symbol: s })} ariaLabel="비교 종목" />
              <Select aria-label="비교 시간봉" value={compare.interval} onChange={(e) => onCompare({ ...compare, interval: e.target.value as IntervalKey })}>
                {INTERVALS.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.label}
                  </option>
                ))}
              </Select>
              <Button type="button" $size="sm" $variant="ghost" onClick={() => onCompare(null)}>
                닫기
              </Button>
            </>
          ) : (
            <>
              <Button type="button" $size="sm" onClick={() => onCompare({ symbol: baseSymbol, interval: "4h" })}>
                같은 종목 다른 시간봉
              </Button>
              <Button type="button" $size="sm" onClick={() => onCompare({ symbol: baseSymbol === "BTC" ? "ETH" : "BTC", interval: "1h" })}>
                다른 종목
              </Button>
            </>
          )}
        </Row>
      </CardHeader>
      {compare && (
        <>
          <Muted>
            {fmtTime(nowTime)} 기준으로 이미 마감된 봉만 보여줘요. 진행 중인 봉은 가려져 있어요.
          </Muted>
          {data?.error && <Notice $tone="error">{data.error}</Notice>}
          {visible.length > 0 ? (
            <TradingChart candles={visible} indicators={{ volume: true, ma: true, bb: false, rsi: false }} viewKey={key ?? undefined} height={300} />
          ) : (
            <Muted>표시할 마감 봉이 아직 없어요.</Muted>
          )}
        </>
      )}
    </Card>
  );
}

function SavedSessions({ onResume }: { onResume: (s: ReplaySession) => void }) {
  const sessions = replayStore.useValue();
  if (sessions.length === 0) return null;
  return (
    <Card>
      <SubTitle>저장한 연습 세션 ({sessions.length})</SubTitle>
      <TableScroll style={{ maxHeight: 260 }}>
        <Table>
          <thead>
            <tr>
              <th>세션</th>
              <th>멈춘 시점</th>
              <th>거래</th>
              <th>잔고</th>
              <th>저장</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{fmtTime(s.cursorTime)}</td>
                <td>{s.trades.length}</td>
                <td>{fmtNum(s.balance)} USDT</td>
                <td>{new Date(s.savedAt).toLocaleString("ko-KR")}</td>
                <td>
                  <Row $gap={4} style={{ justifyContent: "flex-end" }}>
                    <Button type="button" $size="sm" onClick={() => onResume(s)}>
                      이어하기
                    </Button>
                    <Button type="button" $size="sm" $variant="danger" onClick={() => replayStore.write((prev) => prev.filter((p) => p.id !== s.id))}>
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

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const PracticeBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff8e6;
  border: 1px solid #ffe2a8;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};

  div {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  a {
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const Clock = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textSub};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Speeds = styled.div`
  display: inline-flex;
  padding: 3px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.surface};

  button {
    height: 30px;
    min-width: 36px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  button[aria-pressed="true"] {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    box-shadow: ${({ theme }) => theme.shadow.card};
  }
`;

const Toggle = styled.button`
  height: 30px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) => theme.colors.surface};

  &[aria-pressed="true"] {
    color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryWeak};
  }
`;

const SideButton = styled.button<{ $side: 1 | -1 }>`
  flex: 1;
  height: 40px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 14px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textWeak};
  background: ${({ theme }) => theme.colors.surface};

  &[aria-pressed="true"] {
    color: #fff;
    background: ${({ theme, $side }) => ($side === 1 ? theme.colors.rise : theme.colors.fall)};
  }
`;

const Events = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bgSub};
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSub};
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
