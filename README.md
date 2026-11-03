# space_dex

## 필수 버전

- Node.js 20.19.4
- npm 11.7.0
- Next.js 16.4.3
- React 19.3.0
- TypeScript 5
- @privy-io/react-auth 3.51.0
- viem 2.56.5
- starknet 8.5.4
- @x10xchange/stark-crypto-wrapper-wasm 0.1.6

## 테스트 환경

- Extended 테스트넷. `NEXT_PUBLIC_EXTENDED_NETWORK=testnet`
- API `https://api.starknet.sepolia.extended.exchange`
- chainId `SN_SEPOLIA`
- 빌더 수수료 `0.0012`
- 빌더 키는 회사 환경 변수. 유저는 API 키를 발급하지 않고 지갑 서명으로 자기 거래 계정을 준비함
- 환경 변수는 `.env.example`과 같다
- 개발 `http://localhost:3000`
- 프로덕션 `http://127.0.0.1:3100`

## 성공

- 주문 서명이 공식 테스트 벡터와 일치함. 본문 수수료는 기본 수수료만, `builderFee`는 별도
- 테스트넷 온보딩 후 재등록 시 같은 계정이 반환되고, API 키의 계정 정보가 일치함
- 잔액 0 주문은 400 / 1140
- 같은 주문 ID 재전송은 400 / 1134
- 상한을 넘는 빌더 수수료는 400 / 1128
- Extended 중계는 starknet 200, 허용하지 않은 경로는 404, API 키 없는 수수료 조회는 401
- 빌더 체결 API는 키 없을 때 503, 키가 있으면 200
- 테스트넷 마켓 41개의 빌더 수수료 상한은 0.12%
- 코인 상세 주문 버튼은 지갑 창만 열고, 지갑 창에는 주문 폼과 API 키 발급 단계가 없음
- 프로덕션 빌드가 통과하고, `http://127.0.0.1:3100/trade/BTC`의 시세와 Extended starknet 조회가 200

## 실패

- 빌더 수수료 0.15% 주문은 상한 0.12%를 넘어 400 / 1128로 거절됨
- 테스트넷 잔액이 없어 올바른 서명의 주문 접수는 확인하지 못함. 서명을 바꾼 주문도 잔액 부족 1140이 먼저 반환됨
