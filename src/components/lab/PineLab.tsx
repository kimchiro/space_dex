"use client";

import { useMemo, useRef, useState } from "react";
import styled from "styled-components";
import TradingChart from "@/components/chart/TradingChart";
import { runBacktest } from "@/lib/backtest/engine";
import { newId, scriptsStore, type RightsBasis, type SavedScript } from "@/lib/lab/stores";
import { INTERVALS, intervalSeconds, type Candle, type IntervalKey } from "@/lib/market/candles";
import { useCandles } from "@/lib/market/useCandles";
import { analyzePine, type InputSpec, type InputValue, type PineAnalysis } from "@/lib/pine/analyze";
import type { Severity } from "@/lib/pine/ast";
import { PineRunner, type PlotOutput } from "@/lib/pine/runtime";
import { PINE_SAMPLES } from "@/lib/pine/samples";
import CodeEditor, { type CodeEditorHandle } from "./CodeEditor";
import { compareWithCsv } from "./compareCsv";
import SymbolSelect from "./SymbolSelect";
import { Badge, Button, Card, CardHeader, Field, FormGrid, Input, Muted, Notice, Row, Select, SubTitle, Table, TableScroll, TextArea, Title, type BadgeTone } from "./ui";
import { settingsFromScript, useScriptOverlay } from "./useScriptOverlay";

const STEPS = ["코드 붙여넣기·가져오기", "버전·함수 확인", "v5 변환", "오류 줄 표시", "차트 미리보기", "내 지표·전략 저장"];

const SUPPORT_LABEL = { supported: ["지원", "ok"], partial: ["부분 지원", "warn"], unsupported: ["미지원", "error"] } as const;
const SEVERITY_LABEL: Record<Severity, [string, BadgeTone]> = { error: ["오류", "error"], warning: ["주의", "warn"], info: ["참고", "info"] };

const RIGHTS: { value: RightsBasis; label: string }[] = [
  { value: "own", label: "직접 작성한 코드" },
  { value: "open-source", label: "오픈소스(라이선스 확인)" },
  { value: "permission", label: "제작자에게 소스·허락 받음" },
];

export default function PineLab({ symbol: initialSymbol, interval: initialInterval, onBacktest }: { symbol: string; interval: IntervalKey; onBacktest: (scriptId: string) => void }) {
  const editorRef = useRef<CodeEditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState(PINE_SAMPLES[0].code);
  const [analysis, setAnalysis] = useState<PineAnalysis | null>(() => analyzePine(PINE_SAMPLES[0].code));
  const [analyzedSource, setAnalyzedSource] = useState(PINE_SAMPLES[0].code);
  const [inputs, setInputs] = useState<Record<string, InputValue>>({});
  const [showConverted, setShowConverted] = useState(false);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [interval, setPreviewInterval] = useState<IntervalKey>(initialInterval);

  const stale = analysis !== null && analyzedSource !== source;
  const errors = analysis?.diagnostics.filter((d) => d.severity === "error") ?? [];
  const runnable = !!analysis?.program && !stale;

  const analyze = (code = source) => {
    setAnalysis(analyzePine(code));
    setAnalyzedSource(code);
    setInputs({});
  };

  const loadCode = (code: string) => {
    setSource(code);
    analyze(code);
  };

  const marks = useMemo(() => {
    const map = new Map<number, Severity>();
    if (stale) return map;
    for (const d of analysis?.diagnostics ?? []) {
      if (d.severity === "info") continue;
      if (map.get(d.line) !== "error") map.set(d.line, d.severity);
    }
    return map;
  }, [analysis, stale]);

  const previewScript = useMemo<SavedScript | null>(
    () =>
      runnable && analysis?.kind
        ? { id: "preview", name: analysis.title, kind: analysis.kind, source, code: analysis.code, hash: analysis.hash, revision: 0, inputs, rights: { basis: "own", note: "" }, savedAt: 0 }
        : null,
    [runnable, analysis, source, inputs],
  );

  const { status, candles } = useCandles(symbol, interval, { limit: 1000 });
  const overlay = useScriptOverlay(previewScript, candles, symbol, interval);

  const preview = useMemo(() => {
    if (!previewScript || !analysis?.program || candles.length === 0) return null;
    try {
      if (analysis.kind === "strategy") {
        const r = runBacktest({ analysis, candles, inputs, settings: settingsFromScript(analysis), intervalSeconds: intervalSeconds(interval), symbol, interval });
        return { kind: "strategy" as const, trades: r.trades.length, returnPct: r.metrics.all.returnPct, winRate: r.metrics.all.winRate, plots: r.outputs.plots };
      }
      const out = new PineRunner(analysis, candles, { inputs, symbol, interval }).runAll();
      return { kind: "indicator" as const, markers: out.markers.length, plots: out.plots };
    } catch {
      return null;
    }
  }, [previewScript, analysis, candles, inputs, interval, symbol]);

  const step = !analysis || stale ? 0 : errors.length ? 3 : 4;

  return (
    <Wrapper>
      <StepRow>
        {STEPS.map((label, i) => (
          <StepChip key={label} $state={i < step ? "done" : i === step ? "now" : "todo"}>
            {"①②③④⑤⑥"[i]} {label}
          </StepChip>
        ))}
      </StepRow>

      <Columns>
        <Card>
          <CardHeader>
            <Title>Pine Script 코드</Title>
            <Row>
              <Select aria-label="예시 코드" defaultValue="" onChange={(e) => e.target.value && loadCode(PINE_SAMPLES.find((s) => s.id === e.target.value)!.code)}>
                <option value="" disabled>
                  예시 불러오기
                </option>
                {PINE_SAMPLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Button type="button" $size="sm" onClick={() => fileRef.current?.click()}>
                파일 가져오기
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pine,.txt,text/plain"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) loadCode(await file.text());
                  e.target.value = "";
                }}
              />
            </Row>
          </CardHeader>
          <CodeEditor ref={editorRef} value={source} onChange={setSource} marks={marks} height={460} />
          <Row style={{ justifyContent: "space-between" }}>
            <Muted>{stale ? "코드가 바뀌었어요. 다시 분석해 주세요." : "TradingView 편집기의 코드를 그대로 붙여 넣으세요. 4칸 들여쓰기를 지켜 주세요."}</Muted>
            <Button type="button" $variant="primary" onClick={() => analyze()}>
              분석·변환
            </Button>
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <Title>분석 결과</Title>
            {analysis && !stale && (
              <Badge $tone={errors.length ? "error" : "ok"}>{errors.length ? `오류 ${errors.length}건 · 수정 필요` : "변환 완료 · 실행 가능"}</Badge>
            )}
          </CardHeader>
          {!analysis ? (
            <Muted>분석·변환을 누르면 결과가 여기에 표시돼요.</Muted>
          ) : (
            <>
              <Summary>
                <div>
                  <dt>버전</dt>
                  <dd>
                    {analysis.version ? `v${analysis.version}` : "없음"}
                    {analysis.changes.length > 0 && " → v5 변환"}
                  </dd>
                </div>
                <div>
                  <dt>종류</dt>
                  <dd>{analysis.kind === "strategy" ? "전략 (진입·청산 실행)" : analysis.kind === "indicator" ? "지표 (선·신호 표시)" : "-"}</dd>
                </div>
                <div>
                  <dt>이름</dt>
                  <dd title={analysis.title}>{analysis.title}</dd>
                </div>
                <div>
                  <dt>버전 해시</dt>
                  <dd>{analysis.hash}</dd>
                </div>
              </Summary>

              {analysis.diagnostics.length > 0 && (
                <section>
                  <SubTitle>오류·주의 ({analysis.diagnostics.length})</SubTitle>
                  <DiagList>
                    {analysis.diagnostics.map((d, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => editorRef.current?.goToLine(d.line)}>
                          <Badge $tone={SEVERITY_LABEL[d.severity][1]}>{SEVERITY_LABEL[d.severity][0]}</Badge>
                          <span className="line">{d.line}줄</span>
                          <span>{d.message}</span>
                        </button>
                      </li>
                    ))}
                  </DiagList>
                </section>
              )}

              <section>
                <SubTitle>사용한 함수 ({analysis.functions.length})</SubTitle>
                <TableScroll style={{ maxHeight: 220 }}>
                  <Table>
                    <thead>
                      <tr>
                        <th>함수</th>
                        <th>상태</th>
                        <th>줄</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.functions.map((f) => (
                        <tr key={f.name} title={f.note}>
                          <td>
                            <code>{f.name}</code>
                          </td>
                          <td>
                            <Badge $tone={SUPPORT_LABEL[f.support][1]}>{SUPPORT_LABEL[f.support][0]}</Badge>
                          </td>
                          <td>{f.lines.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableScroll>
                <Muted>부분 지원·미지원 항목에 마우스를 올리면 처리 방식이 보여요.</Muted>
              </section>

              {analysis.changes.length > 0 && (
                <section>
                  <Row style={{ justifyContent: "space-between" }}>
                    <SubTitle>변환한 부분 ({analysis.changes.length})</SubTitle>
                    <Button type="button" $size="sm" $variant="ghost" onClick={() => setShowConverted((v) => !v)}>
                      {showConverted ? "변환 코드 닫기" : "변환 코드 보기"}
                    </Button>
                  </Row>
                  <ChangeList>
                    {analysis.changes.map((c, i) => (
                      <li key={i}>
                        <span className="line">{c.line}줄</span>
                        <code>{c.from}</code> → <code>{c.to}</code>
                        <small>{c.note}</small>
                      </li>
                    ))}
                  </ChangeList>
                  {showConverted && <CodeEditor value={analysis.code} readOnly height={260} />}
                </section>
              )}
            </>
          )}
        </Card>
      </Columns>

      {analysis && !stale && analysis.inputs.length > 0 && (
        <Card>
          <CardHeader>
            <Title>사용자 입력값</Title>
            <Button type="button" $size="sm" $variant="ghost" onClick={() => setInputs({})}>
              기본값으로
            </Button>
          </CardHeader>
          <FormGrid>
            {analysis.inputs.map((spec) => (
              <InputField key={spec.key} spec={spec} value={inputs[spec.key]} onChange={(v) => setInputs((prev) => ({ ...prev, [spec.key]: v }))} />
            ))}
          </FormGrid>
        </Card>
      )}

      <Card>
        <CardHeader>
          <Title>차트 미리보기</Title>
          <Row>
            <div style={{ width: 170 }}>
              <SymbolSelect value={symbol} onChange={setSymbol} />
            </div>
            <Select aria-label="시간봉" value={interval} onChange={(e) => setPreviewInterval(e.target.value as IntervalKey)}>
              {INTERVALS.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </Select>
          </Row>
        </CardHeader>
        {!runnable ? (
          <Notice $tone={stale ? "info" : "error"}>
            {stale ? "분석·변환을 먼저 실행해 주세요." : <><strong>오류를 고쳐야 미리볼 수 있어요.</strong> 위 목록에서 줄을 눌러 해당 위치로 이동할 수 있어요.</>}
          </Notice>
        ) : (
          <>
            {preview && (
              <Row>
                {preview.kind === "strategy" ? (
                  <>
                    <Badge $tone="info">최근 {candles.length}봉 기본 설정</Badge>
                    <Badge>거래 {preview.trades}회</Badge>
                    <Badge $tone={preview.returnPct >= 0 ? "error" : "info"}>수익률 {preview.returnPct.toFixed(2)}%</Badge>
                    <Badge>승률 {preview.winRate.toFixed(1)}%</Badge>
                  </>
                ) : (
                  <>
                    <Badge>선 {preview.plots.length}개</Badge>
                    <Badge>신호 {preview.markers}개</Badge>
                  </>
                )}
              </Row>
            )}
            {overlay.error && <Notice $tone="error">{overlay.error}</Notice>}
            <TradingChart
              candles={candles}
              indicators={{ volume: true, ma: false, bb: false, rsi: false }}
              overlays={overlay.overlays}
              markers={overlay.markers}
              priceLines={overlay.priceLines}
              viewKey={`${symbol}:${interval}:${analysis?.hash}`}
              height={420}
            />
            {status === "unsupported" && <Muted>이 종목은 바이낸스 USDT 마켓이 없어 미리볼 수 없어요.</Muted>}
          </>
        )}
      </Card>

      {runnable && preview && <CompareCard plots={preview.plots} candlesLabel={`${symbol} ${interval}`} candles={candles} />}

      <SaveCard analysis={runnable ? analysis : null} source={source} inputs={inputs} onBacktest={onBacktest} />
    </Wrapper>
  );
}

function InputField({ spec, value, onChange }: { spec: InputSpec; value: InputValue | undefined; onChange: (v: InputValue) => void }) {
  const current = value ?? spec.defval;
  const hint = [spec.minval !== undefined && `최소 ${spec.minval}`, spec.maxval !== undefined && `최대 ${spec.maxval}`].filter(Boolean).join(" · ");
  return (
    <Field>
      <span>
        {spec.title} <small>{spec.line}줄</small>
      </span>
      {spec.type === "bool" ? (
        <Select value={String(current)} onChange={(e) => onChange(e.target.value === "true")}>
          <option value="true">켜기</option>
          <option value="false">끄기</option>
        </Select>
      ) : spec.type === "source" ? (
        <Select value={String(current)} onChange={(e) => onChange(e.target.value)}>
          {["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      ) : spec.type === "string" ? (
        <Input value={String(current)} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          type="number"
          value={String(current)}
          min={spec.minval}
          max={spec.maxval}
          step={spec.step ?? (spec.type === "int" ? 1 : 0.1)}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(spec.type === "int" ? Math.round(n) : n);
          }}
        />
      )}
      {hint && <small>{hint}</small>}
    </Field>
  );
}

function CompareCard({ plots, candles, candlesLabel }: { plots: PlotOutput[]; candles: Candle[]; candlesLabel: string }) {
  const [csv, setCsv] = useState("");
  const result = useMemo(() => (csv.trim() ? compareWithCsv(csv, candles, plots) : null), [csv, candles, plots]);

  return (
    <Card>
      <CardHeader>
        <Title>원본과 변환본 비교</Title>
        <Badge>{candlesLabel} 기준</Badge>
      </CardHeader>
      <Muted>
        TradingView에서 같은 종목(바이낸스 현물)·시간봉으로 원본 지표를 켜고 &lsquo;차트 데이터 내보내기&rsquo;한 CSV를 붙여 넣으세요. 열 이름이 plot 제목({plots.map((p) => p.title).join(", ") || "없음"})과 같은 값을 봉 시각별로 비교해요. 오차 0.01% 이내면 일치로 봐요.
      </Muted>
      <TextArea rows={4} placeholder={"time,open,high,low,close,빠른 EMA\n1793167200,80900.57,81018.17,80858.08,80867.61,80912.3"} value={csv} onChange={(e) => setCsv(e.target.value)} />
      {result?.error && <Notice $tone="warn">{result.error}</Notice>}
      {result && !result.error && (
        <Table>
          <thead>
            <tr>
              <th>CSV 열</th>
              <th>대응 plot</th>
              <th>비교한 봉</th>
              <th>최대 오차</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {result.columns.map((c) => (
              <tr key={c.column}>
                <td>{c.column}</td>
                <td>{c.plot ?? "-"}</td>
                <td>{c.matched}</td>
                <td>{c.matched ? `${c.maxRelDiffPct.toFixed(4)}%` : "-"}</td>
                <td>{!c.plot ? <Badge>짝 없음</Badge> : c.ok ? <Badge $tone="ok">일치</Badge> : <Badge $tone="error">차이 있음</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function SaveCard({ analysis, source, inputs, onBacktest }: { analysis: PineAnalysis | null; source: string; inputs: Record<string, InputValue>; onBacktest: (id: string) => void }) {
  const saved = scriptsStore.useValue();
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<RightsBasis>("own");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [lastSaved, setLastSaved] = useState<SavedScript | null>(null);

  const finalName = name.trim() || analysis?.title || "";
  const needsNote = basis !== "own";
  const canSave = !!analysis?.program && !!analysis.kind && confirmed && (!needsNote || note.trim().length > 0);

  const save = () => {
    if (!analysis?.kind || !canSave) return;
    const existing = saved.find((s) => s.name === finalName);
    const script: SavedScript = {
      id: existing?.id ?? newId(),
      name: finalName,
      kind: analysis.kind,
      source,
      code: analysis.code,
      hash: analysis.hash,
      revision: existing ? (existing.hash === analysis.hash ? existing.revision : existing.revision + 1) : 1,
      inputs,
      rights: { basis, note: note.trim() },
      savedAt: Date.now(),
    };
    scriptsStore.write((prev) => [script, ...prev.filter((s) => s.id !== script.id)]);
    setLastSaved(script);
  };

  return (
    <Card>
      <CardHeader>
        <Title>내 지표·전략으로 저장</Title>
        {lastSaved && <Badge $tone="ok">{lastSaved.name} r{lastSaved.revision} 저장됨</Badge>}
      </CardHeader>
      <FormGrid>
        <Field>
          이름
          <Input value={name} placeholder={analysis?.title ?? "오류를 먼저 고쳐 주세요"} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field>
          사용·수정 권한 근거
          <Select value={basis} onChange={(e) => setBasis(e.target.value as RightsBasis)}>
            {RIGHTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          {needsNote ? "라이선스·허락 내용 (필수)" : "메모"}
          <Input value={note} placeholder={needsNote ? "예: MPL-2.0 / 제작자 OOO 허락(2026.10.28)" : "선택"} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormGrid>
      <Notice $tone="warn">
        <strong>공개 여부와 사용 권한은 별개예요.</strong> TradingView에 공개된 스크립트라도 라이선스를 확인해야 하고, 비공개(보호·초대 전용) 지표는 제작자에게 소스와 허락을 받아야 옮길 수 있어요.
      </Notice>
      <Row style={{ justifyContent: "space-between" }}>
        <CheckLabel>
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />이 코드를 SPACEDEX에서 사용·수정할 권한을 확인했어요.
        </CheckLabel>
        <Row>
          <Button type="button" $variant="primary" disabled={!canSave} onClick={save}>
            저장
          </Button>
          <Button type="button" disabled={!lastSaved || lastSaved.kind !== "strategy"} onClick={() => lastSaved && onBacktest(lastSaved.id)}>
            백테스트로 보내기 →
          </Button>
        </Row>
      </Row>

      {saved.length > 0 && (
        <TableScroll style={{ maxHeight: 240 }}>
          <Table>
            <thead>
              <tr>
                <th>저장한 지표·전략</th>
                <th>종류</th>
                <th>버전</th>
                <th>권한 근거</th>
                <th>저장 시각</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {saved.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.kind === "strategy" ? "전략" : "지표"}</td>
                  <td>
                    r{s.revision} · {s.hash}
                  </td>
                  <td>{RIGHTS.find((r) => r.value === s.rights.basis)?.label}</td>
                  <td>{new Date(s.savedAt).toLocaleString("ko-KR")}</td>
                  <td>
                    <Row $gap={4} style={{ justifyContent: "flex-end" }}>
                      {s.kind === "strategy" && (
                        <Button type="button" $size="sm" onClick={() => onBacktest(s.id)}>
                          백테스트
                        </Button>
                      )}
                      <Button type="button" $size="sm" $variant="danger" onClick={() => scriptsStore.write((prev) => prev.filter((p) => p.id !== s.id))}>
                        삭제
                      </Button>
                    </Row>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
    </Card>
  );
}

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const StepRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const StepChip = styled.span<{ $state: "done" | "now" | "todo" }>`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ theme, $state }) => ($state === "now" ? theme.colors.primary : $state === "done" ? theme.colors.primaryWeak : theme.colors.surface)};
  color: ${({ theme, $state }) => ($state === "now" ? "#fff" : $state === "done" ? theme.colors.primary : theme.colors.textWeak)};
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;

  @container main (max-width: 980px) {
    grid-template-columns: minmax(0, 1fr);
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
`;

const Summary = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSub};

  dt {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  dd {
    overflow: hidden;
    margin-top: 2px;
    font-size: 14px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const DiagList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow: auto;

  button {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 8px;
    border-radius: ${({ theme }) => theme.radius.sm};
    font-size: 13px;
    line-height: 1.5;
    text-align: left;

    &:hover {
      background: ${({ theme }) => theme.colors.surface};
    }
  }

  .line {
    flex-shrink: 0;
    width: 36px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textSub};
  }
`;

const ChangeList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;

  li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
  }

  .line {
    width: 36px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.textSub};
  }

  code {
    padding: 1px 6px;
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.surface};
  }

  small {
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
`;
