"use client";

import BigNumber from "bignumber.js";
import { useEffect, useState } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { cancelOrder, ExtendedError, getBalance, getMarket, getOrder, getOrdersByExternalId, getStarknetDomain, placeOrder, type Balance, type Market, type StarknetDomain, type UserOrder } from "@/lib/extended/api";
import { EXTENDED_NETWORK } from "@/lib/extended/config";
import { checkBuilderFee, type FeeCheck } from "@/lib/extended/fees";
import { createSignedOrder, validateOrder, worstPrice, type OrderKind, type OrderSide } from "@/lib/extended/order";
import { useWallet } from "@/components/wallet/context";

const FINAL: UserOrder["status"][] = ["FILLED", "CANCELLED", "REJECTED", "EXPIRED"];
const STATUS_LABEL: Record<string, string> = {
  NEW: "미체결 (호가 대기)",
  PARTIALLY_FILLED: "일부 체결",
  FILLED: "체결 완료",
  CANCELLED: "취소됨",
  REJECTED: "거부됨",
  EXPIRED: "만료됨",
  UNTRIGGERED: "조건 대기",
  TRIGGERED: "조건 충족",
};

type Submitted = { body: unknown; endpoint: string; externalId: string; id?: string; order?: UserOrder; phase: "sending" | "unknown" | "accepted" };

const pct = (n: BigNumber) => `${n.times(100).toFormat()}%`;

const stepPrice = (market: Market) => {
  const step = new BigNumber(market.tradingConfig.minPriceChange);
  const mark = new BigNumber(market.marketStats.markPrice);
  if (!step.isFinite() || step.lte(0) || !mark.isFinite()) return market.marketStats.markPrice;
  return mark.div(step).integerValue(BigNumber.ROUND_HALF_UP).times(step).toString(10);
};

export default function TradeOrder({ token }: { token: Token }) {
  const wallet = useWallet();
  const marketName = `${token.symbol}-USD`;
  const apiKey = wallet.account?.apiKey;

  const [market, setMarket] = useState<Market | null>(null);
  const [marketState, setMarketState] = useState<"loading" | "ready" | "missing">("loading");
  const [domain, setDomain] = useState<StarknetDomain | null>(null);
  const [balance, setBalance] = useState<Balance | null | undefined>(undefined);
  const [fee, setFee] = useState<FeeCheck | null>(null);

  const [side, setSide] = useState<OrderSide>("BUY");
  const [kind, setKind] = useState<OrderKind>("LIMIT");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [postOnly, setPostOnly] = useState(false);

  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getMarket(marketName), getStarknetDomain()])
      .then(([found, nextDomain]) => {
        if (!alive) return;
        setDomain(nextDomain);
        setMarket(found);
        setMarketState(found ? "ready" : "missing");
      })
      .catch((e) => {
        if (!alive) return;
        setMarket(null);
        setMarketState("missing");
        if (!(e instanceof ExtendedError && e.status === 404)) setError(e instanceof Error ? e.message : "Extended 마켓을 불러오지 못했어요.");
      });
    return () => {
      alive = false;
    };
  }, [marketName]);

  useEffect(() => {
    if (!apiKey) return;
    let alive = true;
    getBalance({ apiKey })
      .then((next) => alive && setBalance(next))
      .catch(() => alive && setBalance(null));
    return () => {
      alive = false;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey || !market) return;
    let alive = true;
    checkBuilderFee(apiKey, market.name)
      .then((result) => alive && setFee(result))
      .catch((e) => alive && setFee({ ok: false, market: market.name, reason: e instanceof Error ? e.message : "수수료를 확인하지 못했어요." }));
    return () => {
      alive = false;
    };
  }, [apiKey, market]);

  const feeForMarket = fee && market && fee.market === market.name ? fee : null;
  const effectivePrice = market && kind === "MARKET" ? worstPrice(market, side) : price;
  const input = market ? { market, side, kind, qty, price: effectivePrice, postOnly: kind === "LIMIT" && postOnly } : null;
  const invalid = !market ? (marketState === "loading" ? "마켓 정보를 불러오는 중이에요." : "Extended에 이 코인의 USD 마켓이 없어요.") : validateOrder(input!);
  const notional = new BigNumber(qty || 0).times(effectivePrice || 0);
  const pending = submitted && submitted.phase !== "accepted";
  const needsAccount = !wallet.address || !wallet.unlocked;
  const auth = apiKey ? { apiKey } : null;

  const send = async (target: Submitted) => {
    if (!auth) return;
    setSubmitted({ ...target, phase: "sending" });
    try {
      const placed = await placeOrder(auth, target.endpoint, target.body);
      setSubmitted({ ...target, id: String(placed.id), phase: "accepted" });
    } catch (e) {
      const unknown = !(e instanceof ExtendedError) || e.status >= 500;
      if (unknown) {
        const found = await getOrdersByExternalId(auth, target.externalId).catch(() => []);
        if (found.length) return setSubmitted({ ...target, id: String(found[0].id), order: found[0], phase: "accepted" });
        setSubmitted({ ...target, phase: "unknown" });
      } else {
        setSubmitted(null);
      }
      setError(e instanceof Error ? e.message : "주문을 보내지 못했어요.");
    }
  };

  const submit = async () => {
    if (needsAccount) {
      wallet.openPanel();
      return;
    }
    if (!input || invalid || !feeForMarket?.ok || !domain || !wallet.account || pending) return;
    const privateKey = wallet.signingKey();
    if (!privateKey) return setError("서명 키가 잠겨 있어요. 지갑 창에서 다시 잠금 해제해 주세요.");
    setError(null);
    setBusy(true);
    try {
      const signed = await createSignedOrder(input, feeForMarket, { privateKey, vault: wallet.account.vault, domain });
      await send({ ...signed, phase: "sending" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "주문을 만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const orderId = submitted?.phase === "accepted" ? submitted.id : undefined;
  const orderStatus = submitted?.order?.status;
  const [pollRound, setPollRound] = useState(0);
  useEffect(() => {
    if (!apiKey || !orderId || (orderStatus && FINAL.includes(orderStatus))) return;
    let polls = 0;
    const timer = setInterval(async () => {
      if (++polls > 20) return clearInterval(timer);
      try {
        const order = await getOrder({ apiKey }, orderId);
        setSubmitted((current) => (current && current.id === orderId ? { ...current, order } : current));
        if (FINAL.includes(order.status)) clearInterval(timer);
      } catch {}
    }, 1500);
    return () => clearInterval(timer);
  }, [apiKey, orderId, orderStatus, pollRound]);

  const cancel = async () => {
    if (!auth || !orderId) return;
    try {
      await cancelOrder(auth, orderId);
      setPollRound((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "취소하지 못했어요.");
    }
  };

  const actionLabel = side === "BUY" ? "구매하기" : "판매하기";
  const buttonLabel = !wallet.address ? `지갑 연결 후 ${actionLabel}` : wallet.setup.status === "running" ? "지갑 서명 확인 중…" : !wallet.unlocked ? `지갑 서명 후 ${actionLabel}` : busy ? "주문 서명 중…" : actionLabel;

  return (
    <Panel>
      <SideTabs>
        <SideTab type="button" $active={side === "BUY"} $side="buy" onClick={() => setSide("BUY")}>
          구매
        </SideTab>
        <SideTab type="button" $active={side === "SELL"} $side="sell" onClick={() => setSide("SELL")}>
          판매
        </SideTab>
      </SideTabs>

      <KindTabs>
        <KindTab type="button" $active={kind === "LIMIT"} onClick={() => setKind("LIMIT")}>
          지정가
        </KindTab>
        <KindTab type="button" $active={kind === "MARKET"} onClick={() => setKind("MARKET")}>
          시장가
        </KindTab>
      </KindTabs>

      <Field>
        <FieldLabel>
          <span>수량{market ? ` · ${market.assetName}` : ""}</span>
          <span>{balance ? `거래 가능 ${new BigNumber(balance.availableForTrade).toFormat(2)} ${balance.collateralName}` : apiKey ? "잔액 0 · 입금이 필요해요" : "잔액은 계정 연결 후 보여요"}</span>
        </FieldLabel>
        <InputRow>
          <input inputMode="decimal" placeholder={market?.tradingConfig.minOrderSize ?? "0"} value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} />
          <Unit>{token.symbol}</Unit>
        </InputRow>
      </Field>

      <Field>
        <FieldLabel>
          <span>{kind === "LIMIT" ? "지정 가격" : "최악 허용 가격"}</span>
          <span>{kind === "LIMIT" ? `${market?.tradingConfig.minPriceChange ?? ""} 단위` : "마크 가격 ±0.75%"}</span>
        </FieldLabel>
        <InputRow>
          {kind === "LIMIT" ? (
            <input inputMode="decimal" placeholder={market ? stepPrice(market) : "0"} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
          ) : (
            <ReadOnly>{effectivePrice || "—"}</ReadOnly>
          )}
          <Unit>USD</Unit>
        </InputRow>
      </Field>

      {kind === "LIMIT" && market && !market.isRfq && (
        <Check>
          <input type="checkbox" checked={postOnly} onChange={(e) => setPostOnly(e.target.checked)} />
          Post-only · 메이커로만 체결
        </Check>
      )}
      {market?.isRfq && <Hint>RFQ 마켓이라 전용 주문 경로로 보내고, Post-only 없이 테이커 규칙을 따라요.</Hint>}

      <Summary>
        <SummaryRow>
          <span>마켓</span>
          <span>
            {marketName}
            {EXTENDED_NETWORK === "testnet" ? " · 테스트넷" : ""}
          </span>
        </SummaryRow>
        <SummaryRow>
          <span>주문 금액</span>
          <span>{notional.isFinite() && notional.gt(0) ? notional.toFormat(2) : "—"}</span>
        </SummaryRow>
        {feeForMarket?.ok ? (
          <>
            <SummaryRow>
              <span>기본 수수료</span>
              <span>{pct(feeForMarket.baseFeeRate)}</span>
            </SummaryRow>
            <SummaryRow>
              <span>빌더 수수료 / 상한</span>
              <span>
                {pct(feeForMarket.builderFee)} / {pct(feeForMarket.cap)}
              </span>
            </SummaryRow>
            <SummaryRow>
              <span>최대 수수료</span>
              <span>{notional.isFinite() ? notional.times(feeForMarket.baseFeeRate.plus(feeForMarket.builderFee)).toFormat(4) : "—"}</span>
            </SummaryRow>
          </>
        ) : (
          <SummaryRow>
            <span>수수료</span>
            <span>{!wallet.unlocked ? "계정 연결 후 확인" : feeForMarket ? feeForMarket.reason : "상한 확인 중"}</span>
          </SummaryRow>
        )}
      </Summary>

      {marketState === "missing" && <ErrorText role="alert">Extended에 {marketName} 마켓이 없어 이 화면에서는 주문할 수 없어요.</ErrorText>}
      {feeForMarket && !feeForMarket.ok && <ErrorText role="alert">주문할 수 없어요: {feeForMarket.reason}</ErrorText>}
      {error && <ErrorText role="alert">{error}</ErrorText>}
      {wallet.unlocked && invalid && qty && <ErrorText role="alert">{invalid}</ErrorText>}

      {submitted?.phase === "unknown" ? (
        <SubmitButton type="button" $side={side === "BUY" ? "buy" : "sell"} onClick={() => send(submitted)}>
          같은 주문 다시 보내기
        </SubmitButton>
      ) : (
        <SubmitButton type="button" $side={side === "BUY" ? "buy" : "sell"} disabled={!needsAccount && (Boolean(invalid) || !feeForMarket?.ok || !domain || busy || Boolean(pending))} onClick={submit}>
          {buttonLabel}
        </SubmitButton>
      )}

      {submitted?.phase === "accepted" && (
        <Result>
          <ResultRow>
            <span>
              주문 #{submitted.id} · <strong>{submitted.order ? (STATUS_LABEL[submitted.order.status] ?? submitted.order.status) : "접수됨, 상태 확인 중…"}</strong>
              {submitted.order?.filledQty && Number(submitted.order.filledQty) > 0 ? ` · 체결 ${submitted.order.filledQty}` : ""}
            </span>
            {(!submitted.order || ["NEW", "PARTIALLY_FILLED", "UNTRIGGERED"].includes(submitted.order.status)) && (
              <CancelButton type="button" onClick={cancel}>
                취소
              </CancelButton>
            )}
          </ResultRow>
          {submitted.order?.statusReason && <Hint>사유: {submitted.order.statusReason}</Hint>}
          <Hint>주문 ID를 받았다고 체결된 것은 아니에요. 위 상태가 체결 완료가 될 때까지 확인해요.</Hint>
        </Result>
      )}
    </Panel>
  );
}

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const SideTabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.surface};
`;

const SideTab = styled.button<{ $active: boolean; $side: "buy" | "sell" }>`
  flex: 1;
  height: 38px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme, $active, $side }) => (!$active ? theme.colors.textWeak : $side === "buy" ? theme.colors.rise : theme.colors.fall)};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : "transparent")};
  box-shadow: ${({ $active }) => ($active ? "0 1px 3px rgba(0,0,0,0.08)" : "none")};
`;

const KindTabs = styled.div`
  display: flex;
  gap: 8px;
`;

const KindTab = styled.button<{ $active: boolean }>`
  height: 28px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.surface)};
`;

const Field = styled.div`
  padding: 14px 16px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgSub};
  border: 1px solid ${({ theme }) => theme.colors.border};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const FieldLabel = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;

  input {
    flex: 1;
    min-width: 0;
    font-size: 22px;
    font-weight: 700;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textDisabled};
    }
  }
`;

const ReadOnly = styled.span`
  flex: 1;
  font-size: 22px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textSub};
`;

const Unit = styled.span`
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  background: ${({ theme }) => theme.colors.surface};
  font-size: 13px;
  font-weight: 700;
`;

const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSub};
`;

const Summary = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};

  span:last-child {
    color: ${({ theme }) => theme.colors.textSub};
    text-align: right;
  }
`;

const Hint = styled.p`
  font-size: 12px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.textWeak};
  word-break: keep-all;
`;

const ErrorText = styled.p`
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.rise};
  word-break: keep-all;
`;

const SubmitButton = styled.button<{ $side: "buy" | "sell" }>`
  height: 52px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $side }) => ($side === "buy" ? theme.colors.rise : theme.colors.fall)};
  color: #fff;
  font-size: 16px;
  font-weight: 700;

  &:disabled {
    opacity: 0.45;
  }
`;

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.primaryWeak};
  font-size: 13px;
`;

const ResultRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const CancelButton = styled.button`
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bg};
  font-size: 13px;
  font-weight: 700;
`;
