"use client";

import { useState } from "react";
import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { formatAmount, formatPrice } from "@/lib/format";

type Side = "buy" | "sell";

const slippageOptions = ["0.1", "0.5", "1.0"];
const QUOTE = "USDC";

export default function SwapPanel({ token }: { token: Token }) {
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");

  const value = Number(amount) || 0;
  const received = side === "buy" ? value / token.price : value * token.price;
  const payUnit = side === "buy" ? QUOTE : token.symbol;
  const receiveUnit = side === "buy" ? token.symbol : QUOTE;
  const minReceived = received * (1 - Number(slippage) / 100);

  return (
    <Panel>
      <SideTabs>
        <SideTab $active={side === "buy"} $side="buy" onClick={() => setSide("buy")}>
          구매
        </SideTab>
        <SideTab $active={side === "sell"} $side="sell" onClick={() => setSide("sell")}>
          판매
        </SideTab>
      </SideTabs>

      <Field>
        <FieldLabel>
          <span>지불</span>
          <span>잔액 0 {payUnit}</span>
        </FieldLabel>
        <InputRow>
          <input
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <Unit>{payUnit}</Unit>
        </InputRow>
      </Field>

      <SwapArrow aria-hidden>↓</SwapArrow>

      <Field>
        <FieldLabel>
          <span>받기 (예상)</span>
        </FieldLabel>
        <InputRow>
          <ReadOnly>{received ? formatAmount(received) : "0"}</ReadOnly>
          <Unit>{receiveUnit}</Unit>
        </InputRow>
      </Field>

      <Slippage>
        <span>슬리피지 허용</span>
        <SlippageOptions>
          {slippageOptions.map((s) => (
            <SlippageButton key={s} $active={s === slippage} onClick={() => setSlippage(s)}>
              {s}%
            </SlippageButton>
          ))}
        </SlippageOptions>
      </Slippage>

      <Summary>
        <SummaryRow>
          <span>환율</span>
          <span>
            1 {token.symbol} = {formatPrice(token.price)}
          </span>
        </SummaryRow>
        <SummaryRow>
          <span>최소 수령량</span>
          <span>
            {formatAmount(minReceived)} {receiveUnit}
          </span>
        </SummaryRow>
        <SummaryRow>
          <span>예상 가스비</span>
          <span>~$1.24</span>
        </SummaryRow>
        <SummaryRow>
          <span>경로</span>
          <span>
            {payUnit} → {receiveUnit}
          </span>
        </SummaryRow>
      </Summary>

      <SubmitButton $side={side}>지갑 연결 후 {side === "buy" ? "구매" : "판매"}하기</SubmitButton>
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

const SideTab = styled.button<{ $active: boolean; $side: Side }>`
  flex: 1;
  height: 38px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme, $active, $side }) =>
    !$active ? theme.colors.textWeak : $side === "buy" ? theme.colors.rise : theme.colors.fall};
  background: ${({ theme, $active }) => ($active ? theme.colors.bg : "transparent")};
  box-shadow: ${({ $active }) => ($active ? "0 1px 3px rgba(0,0,0,0.08)" : "none")};
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

const SwapArrow = styled.div`
  align-self: center;
  margin: -6px 0;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Slippage = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;
`;

const SlippageOptions = styled.div`
  display: flex;
  gap: 4px;
`;

const SlippageButton = styled.button<{ $active: boolean }>`
  height: 28px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSub)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryWeak : theme.colors.surface)};
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
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};

  span:last-child {
    color: ${({ theme }) => theme.colors.textSub};
  }
`;

const SubmitButton = styled.button<{ $side: Side }>`
  height: 52px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme, $side }) => ($side === "buy" ? theme.colors.rise : theme.colors.fall)};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.9;
  }
`;
