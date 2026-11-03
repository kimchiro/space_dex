/** 브라우저에서 `/api/extended` 중계를 거쳐 Extended REST를 호출한다. */

export class ExtendedError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string | number,
  ) {
    super(message);
    this.name = "ExtendedError";
  }
}

type Auth = {
  apiKey?: string;
  accountId?: string;
  /** EIP-191 요청 서명. API 키 발급 같은 지갑 인증 요청에만 쓴다. */
  l1?: { signature: string; time: string };
};

type RequestOptions = Auth & {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: unknown;
};

// JS number로 표현할 수 없는 정수(주문 ID·계정 ID 등)를 문자열로 바꿔서 파싱한다.
const BIG_INT = /([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g;
export const parseJson = (text: string): unknown => JSON.parse(text.replace(BIG_INT, '$1"$2"'));

export async function extendedRequest<T>(path: string, { method = "GET", query, body, apiKey, accountId, l1 }: RequestOptions = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, value);
  const search = params.size ? `?${params}` : "";

  const headers: Record<string, string> = {};
  if (apiKey) headers["x-api-key"] = apiKey;
  if (accountId) headers["x-x10-active-account"] = accountId;
  if (l1) {
    headers["x-l1-signature"] = l1.signature;
    headers["x-l1-message-time"] = l1.time;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(`/api/extended${path}${search}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const text = await response.text();

  let json: { status?: string; data?: unknown; error?: { code?: string | number; message?: string } } = {};
  try {
    json = text ? (parseJson(text) as typeof json) : {};
  } catch {
    throw new ExtendedError(`Extended 응답을 읽지 못했어요. (${response.status})`, response.status);
  }

  if (!response.ok || json.status === "ERROR") {
    throw new ExtendedError(json.error?.message ?? `Extended 요청이 실패했어요. (${response.status})`, response.status, json.error?.code);
  }
  return json.data as T;
}

/* ---------- 응답 타입 ---------- */

export type StarknetDomain = { name: string; version: string; chainId: string; revision: string | number };

export type Market = {
  name: string;
  assetName: string;
  active: boolean;
  status: string;
  isRfq?: boolean;
  type?: string;
  marketStats: { lastPrice: string; askPrice: string; bidPrice: string; markPrice: string };
  tradingConfig: { minOrderSize: string; minOrderSizeChange: string; minPriceChange: string };
  l2Config: { collateralId: string; collateralResolution: number; syntheticId: string; syntheticResolution: number };
};

export type FeeRow = { market: string; makerFeeRate: string; takerFeeRate: string; builderFeeRate?: string | null };

export type AccountInfo = { accountId: string | number; l2Key: string; l2Vault: string | number; status: string; description?: string; accountIndex?: number };

export type Balance = { collateralName: string; balance: string; equity: string; availableForTrade: string };

export type OrderStatus = "NEW" | "PARTIALLY_FILLED" | "FILLED" | "UNTRIGGERED" | "CANCELLED" | "REJECTED" | "EXPIRED" | "TRIGGERED" | "UNKNOWN";

export type UserOrder = {
  id: string | number;
  externalId: string;
  market: string;
  side: "BUY" | "SELL";
  status: OrderStatus;
  statusReason?: string;
  price?: string;
  qty: string;
  filledQty?: string;
};

export const getStarknetDomain = () => extendedRequest<StarknetDomain>("/api/v1/info/starknet");

export const getMarkets = () => extendedRequest<Market[]>("/api/v1/info/markets");

export const getMarket = async (market: string) => {
  const rows = await extendedRequest<Market[]>("/api/v1/info/markets", { query: { market } });
  const found = rows?.find((m) => m.name === market);
  if (!found) throw new ExtendedError(`${market} 마켓을 찾을 수 없어요.`, 404);
  return found;
};

export const getFees = (auth: { apiKey: string }, market: string, builderId?: string) =>
  extendedRequest<FeeRow[]>("/api/v1/user/fees", { ...auth, query: { market, builderId } });

export const getAccountInfo = (auth: { apiKey: string }) => extendedRequest<AccountInfo>("/api/v1/user/account/info", auth);

export const getBalance = async (auth: { apiKey: string }) => {
  try {
    return await extendedRequest<Balance>("/api/v1/user/balance", auth);
  } catch (e) {
    // 잔액이 0이면 Extended가 404를 돌려준다.
    if (e instanceof ExtendedError && e.status === 404) return null;
    throw e;
  }
};

export const getOpenOrders = (auth: { apiKey: string }) => extendedRequest<UserOrder[]>("/api/v1/user/orders", auth);

export const getOrder = (auth: { apiKey: string }, id: string) => extendedRequest<UserOrder>(`/api/v1/user/orders/${id}`, auth);

export const getOrdersByExternalId = (auth: { apiKey: string }, externalId: string) => extendedRequest<UserOrder[]>(`/api/v1/user/orders/external/${externalId}`, auth);

export const placeOrder = (auth: { apiKey: string }, endpoint: string, body: unknown) =>
  extendedRequest<{ id: string | number; externalId: string }>(endpoint, { ...auth, method: "POST", body });

export const cancelOrder = (auth: { apiKey: string }, id: string) => extendedRequest<unknown>(`/api/v1/user/order/${id}`, { ...auth, method: "DELETE" });
