export const USER_AGENT = "SPACEDEX/0.1";

// 언더스코어 헤더는 중간 프록시에서 버려질 수 있어 브라우저→중계 구간은 하이픈 이름을 쓴다.
export const FORWARDED_HEADERS: [from: string, to: string][] = [
  ["x-api-key", "X-Api-Key"],
  ["x-l1-signature", "L1_SIGNATURE"],
  ["x-l1-message-time", "L1_MESSAGE_TIME"],
  ["x-x10-active-account", "X-X10-ACTIVE-ACCOUNT"],
];
