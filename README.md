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
- tsx 4.23.15

## 테스트 환경

- Extended 테스트넷. `NEXT_PUBLIC_EXTENDED_NETWORK=testnet`
- API `https://api.starknet.sepolia.extended.exchange`
- chainId `SN_SEPOLIA`
- 빌더 수수료 `0.0012`
- 빌더 키는 회사 환경 변수. 유저는 API 키를 발급하지 않고 지갑 서명으로 자기 거래 계정을 준비함
- 빌더 계정 지갑과 거래 지갑은 따로 둔다. 같은 지갑으로 주문하면 1150으로 거절됨
- 입금이 없는 계정은 코인 상세의 `테스트 USDC 받기`로 지갑당 하루 1,000 USD를 받는다
- 호가는 `npm run maker:testnet`의 회사 호가 봇이 공급. 봇 전용 지갑 키는 `TESTNET_MAKER_PRIVATE_KEY`(서버 전용), 메인넷 설정이면 실행되지 않음
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
- 입금한 새 계정 두 개의 지정가·시장가 주문이 FILLED. 회사 빌더 체결 API에 builderId와 빌더 수수료 0.12%가 기록됨
- 테스트 USDC 받기 후 몇 초 안에 거래 가능 잔액 1,000 USD 반영
- 호가 봇이 BTC·ETH·SOL-USD에 매수·매도 5단계 post-only 호가를 걸고, 코인 상세 호가 카드에 Extended 테스트넷 호가로 표시됨
- 헤더 지갑 버튼과 주문 카드의 연결·서명 상태가 같고, 연결 해제 후 다시 연결 전까지 지갑이 보이지 않음

## 실패

- 빌더 수수료 0.15% 주문은 상한 0.12%를 넘어 400 / 1128로 거절됨
- 빌더 계정과 같은 지갑의 주문은 400 / 1150(Builder ID is not valid)으로 거절됨. builderId 값과 무관
- 입금 없는 계정의 주문은 접수(200) 후 REJECTED / UNKNOWN_ACCOUNT
- 호가가 빈 마켓의 시장가 주문은 CANCELLED / NO_LIQUIDITY
- Extended 공개 호가 API는 실제 호가보다 수십 초 늦게 갱신될 때가 있음
- Privy 지갑 창의 React key 경고는 Privy 내부 컴포넌트에서 발생. 개발 모드에서만 보이고 앱 코드로 고칠 수 없음
