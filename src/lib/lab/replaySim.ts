import type { Candle } from "@/lib/market/candles";
import type { ReplayOrder, ReplayPosition, ReplayTrade } from "./stores";

export const REPLAY_START_BALANCE = 10_000;
export const REPLAY_FEE_PCT = 0.1;

export type ReplayBook = {
  balance: number;
  position: ReplayPosition | null;
  orders: ReplayOrder[];
  trades: ReplayTrade[];
};

export const EMPTY_BOOK: ReplayBook = { balance: REPLAY_START_BALANCE, position: null, orders: [], trades: [] };

type Result = { book: ReplayBook; events: string[] };

const fee = (notional: number) => (notional * REPLAY_FEE_PCT) / 100;
const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 1 ? 2 : 6 });

export function closePosition(book: ReplayBook, price: number, time: number, reason: string, id: string): Result {
  const p = book.position;
  if (!p) return { book, events: [] };
  const gross = p.side * (price - p.entryPrice) * p.qty;
  const pnl = gross - fee(p.qty * p.entryPrice) - fee(p.qty * price);
  const trade: ReplayTrade = {
    id,
    side: p.side,
    entryTime: p.entryTime,
    entryPrice: p.entryPrice,
    exitTime: time,
    exitPrice: price,
    qty: p.qty,
    pnl,
    reason,
    memo: "",
  };
  return {
    book: { ...book, balance: book.balance + p.qty * p.entryPrice + gross - fee(p.qty * price), position: null, trades: [...book.trades, trade] },
    events: [`${reason}: ${fmt(price)}에 ${p.side === 1 ? "롱" : "숏"} 정리 (${pnl >= 0 ? "+" : ""}${fmt(pnl)} USDT)`],
  };
}

/** 반대 방향 주문은 보유 포지션을 전량 정리하고, 같은 방향은 평균 단가로 추가한다. 레버리지 1배. */
export function fill(
  book: ReplayBook,
  order: { side: 1 | -1; amount: number; stop?: number; take?: number },
  price: number,
  time: number,
  id: string,
  label: string,
): Result {
  const p = book.position;
  if (p && p.side !== order.side) return closePosition(book, price, time, `${label} 반대 주문`, id);
  const cost = order.amount + fee(order.amount);
  if (cost > book.balance + 1e-9) return { book, events: [`${label} 거절: 잔고 부족 (필요 ${fmt(cost)} USDT)`] };
  const qty = order.amount / price;
  const position: ReplayPosition = p
    ? {
        ...p,
        qty: p.qty + qty,
        entryPrice: (p.entryPrice * p.qty + price * qty) / (p.qty + qty),
        stop: order.stop ?? p.stop,
        take: order.take ?? p.take,
      }
    : { side: order.side, qty, entryPrice: price, entryTime: time, stop: order.stop, take: order.take };
  return {
    book: { ...book, balance: book.balance - cost, position },
    events: [`${label} 체결: ${fmt(price)}에 ${order.side === 1 ? "매수" : "매도"} ${fmt(order.amount)} USDT`],
  };
}

/** 새 봉이 열렸을 때 대기 주문과 손절·익절을 확인한다. 한 봉에서 둘 다 닿으면 시가에서 가까운 쪽을 먼저 처리한다. */
export function advance(book: ReplayBook, bar: Candle, makeId: () => string): Result {
  const events: string[] = [];
  let next = book;
  let openedThisBar = false;

  const remaining: ReplayOrder[] = [];
  for (const order of next.orders) {
    const touched = order.side === 1 ? bar.low <= order.price : bar.high >= order.price;
    if (!touched) {
      remaining.push(order);
      continue;
    }
    const price = order.side === 1 ? Math.min(bar.open, order.price) : Math.max(bar.open, order.price);
    const hadPosition = !!next.position;
    const r = fill(next, order, price, bar.time, makeId(), "지정가");
    next = r.book;
    events.push(...r.events);
    if (!hadPosition && next.position) openedThisBar = true;
  }
  next = { ...next, orders: remaining };

  const p = next.position;
  if (p && !openedThisBar) {
    const long = p.side === 1;
    const stopHit = p.stop !== undefined && (long ? bar.low <= p.stop : bar.high >= p.stop);
    const takeHit = p.take !== undefined && (long ? bar.high >= p.take : bar.low <= p.take);
    let which: "stop" | "take" | null = stopHit ? "stop" : takeHit ? "take" : null;
    if (stopHit && takeHit) {
      const highFirst = bar.high - bar.open <= bar.open - bar.low;
      which = long ? (highFirst ? "take" : "stop") : highFirst ? "stop" : "take";
      events.push("손절·익절이 한 봉 안에서 모두 닿아 시가에서 가까운 쪽을 먼저 처리했어요.");
    }
    if (which === "stop") {
      const price = long ? Math.min(bar.open, p.stop!) : Math.max(bar.open, p.stop!);
      const r = closePosition(next, price, bar.time, "손절", makeId());
      next = r.book;
      events.push(...r.events);
    } else if (which === "take") {
      const price = long ? Math.max(bar.open, p.take!) : Math.min(bar.open, p.take!);
      const r = closePosition(next, price, bar.time, "익절", makeId());
      next = r.book;
      events.push(...r.events);
    }
  }
  return { book: next, events };
}

export function equityOf(book: ReplayBook, price: number) {
  const p = book.position;
  return book.balance + (p ? p.qty * p.entryPrice + p.side * (price - p.entryPrice) * p.qty : 0);
}
