export type ExtendedNetwork = "testnet" | "mainnet";

type NetworkConfig = {
  label: string;
  /** Extended REST 호스트. 온보딩(`/auth/onboard`)과 API(`/api/v1/...`)가 같은 호스트를 쓴다. */
  origin: string;
  /** 키 파생·계정 등록 EIP-712 서명 도메인. 메인넷과 테스트넷이 다르므로 섞으면 다른 키가 나온다. */
  signingDomain: string;
};

export const NETWORKS: Record<ExtendedNetwork, NetworkConfig> = {
  testnet: {
    label: "Testnet",
    origin: "https://api.starknet.sepolia.extended.exchange",
    signingDomain: "starknet.sepolia.extended.exchange",
  },
  mainnet: {
    label: "Mainnet",
    origin: "https://api.starknet.extended.exchange",
    signingDomain: "extended.exchange",
  },
};

export const EXTENDED_NETWORK: ExtendedNetwork = process.env.NEXT_PUBLIC_EXTENDED_NETWORK === "mainnet" ? "mainnet" : "testnet";
export const NETWORK = NETWORKS[EXTENDED_NETWORK];

/**
 * SPACEDEX Extended 계정의 clientId. 고객 accountId·vault·지갑 주소·추천 코드가 아니다.
 * 수수료 조회 쿼리는 문자열이고, 주문 본문의 builderId는 숫자다.
 */
export function parseBuilderId(value: string | null | undefined): number | null {
  const id = value?.trim() ?? "";
  if (!/^[1-9]\d*$/.test(id)) return null;
  const parsed = Number(id);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export const BUILDER_ID = parseBuilderId(process.env.NEXT_PUBLIC_EXTENDED_BUILDER_ID);

/** 0.12%. 소수 비율이므로 0.12로 쓰면 12%가 된다. 테스트넷 빌더 상한과 같다. */
export const BUILDER_FEE = "0.0012";

/** 메인 계정. 서브 계정은 1~9를 쓰고 Stark 키도 따로 파생된다. */
export const ACCOUNT_INDEX = 0;

export const API_KEY_PATH = "/api/v1/user/account/api-key";
