"use client";

import { useState } from "react";
import styled from "styled-components";
import { cancelOrder, getOpenOrders, type UserOrder } from "@/lib/extended/api";
import { shortAddress, useWallet } from "./context";
import { Desc, ErrorText, Ghost, Row } from "./ui";

/** 주소를 바꾼 뒤 이전 계정의 미체결 주문을 따로 조회·취소한다. 자동으로 취소하지 않는다. */
export default function PreviousAccountNotice() {
  const { previous, dismissPrevious } = useWallet();
  const [orders, setOrders] = useState<UserOrder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!previous) return null;
  const auth = { apiKey: previous.apiKey };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청이 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const load = () => run(async () => setOrders(await getOpenOrders(auth)));
  const cancel = (id: string) =>
    run(async () => {
      await cancelOrder(auth, id);
      setOrders(await getOpenOrders(auth));
    });

  return (
    <Notice role="status">
      <Row>
        <strong>서명 주소가 바뀌었어요</strong>
        <Ghost type="button" onClick={dismissPrevious}>
          닫기
        </Ghost>
      </Row>
      <Desc>
        이전 주소 {shortAddress(previous.address)}의 서명은 잠겼어요. 그 계정에 걸어 둔 미체결 주문은 자동으로 취소되지 않아요.
      </Desc>
      {orders === null ? (
        <Ghost type="button" disabled={busy} onClick={load}>
          이전 계정 미체결 주문 확인
        </Ghost>
      ) : orders.length === 0 ? (
        <Desc>미체결 주문이 없어요.</Desc>
      ) : (
        <Orders>
          {orders.map((o) => (
            <li key={String(o.id)}>
              <span>
                {o.market} · {o.side === "BUY" ? "매수" : "매도"} {o.qty} @ {o.price ?? "시장가"}
              </span>
              <Ghost type="button" disabled={busy} onClick={() => cancel(String(o.id))}>
                취소
              </Ghost>
            </li>
          ))}
        </Orders>
      )}
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </Notice>
  );
}

const Notice = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fff8e6;
  border: 1px solid #ffe2a8;

  strong {
    font-size: 14px;
  }
`;

const Orders = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
  }
`;
