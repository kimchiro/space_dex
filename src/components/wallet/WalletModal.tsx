"use client";

import { useEffect, useRef } from "react";
import styled from "styled-components";
import { BUILDER_FEE, EXTENDED_NETWORK, NETWORK } from "@/lib/extended/config";
import { shortAddress, useWallet, walletLabel, type SetupStep } from "./context";
import PreviousAccountNotice from "./PreviousAccountNotice";
import { Desc, ErrorText, Facts, Ghost, Primary, Row, Section, Title } from "./ui";

const STEPS: { key: SetupStep; label: string; hint: string }[] = [
  { key: "derive", label: "Stark 키 만들기", hint: "AccountCreation 서명으로 이 기기에서만 키를 만들어요" },
  { key: "register", label: "Extended 계정 등록", hint: "AccountRegistration 서명과 Stark 서명을 보내요" },
  { key: "apiKey", label: "API 키 발급", hint: "조회용 API 키를 받기 위해 메시지에 서명해요" },
  { key: "verify", label: "계정 확인", hint: "등록된 공개키와 vault가 일치하는지 확인해요" },
];

export default function WalletModal() {
  const wallet = useWallet();
  const { panel, closePanel } = wallet;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel.open) return;
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Privy 창이 떠 있으면 Esc는 Privy 창만 닫게 둔다.
      if (e.key === "Escape" && !document.getElementById("privy-dialog")) closePanel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [panel.open, closePanel]);

  if (!panel.open) return null;

  // <dialog>의 최상위 레이어는 Privy 로그인·서명 창(z-index 999999)까지 가리므로 일반 레이어에 띄운다.
  return (
    <Backdrop onClick={(e) => e.target === e.currentTarget && closePanel()}>
      <Dialog ref={ref} role="dialog" aria-modal="true" aria-labelledby="wallet-title">
        <Head>
          <h2 id="wallet-title">지갑</h2>
          <NetworkBadge $mainnet={EXTENDED_NETWORK === "mainnet"}>Extended {NETWORK.label}</NetworkBadge>
          <CloseButton type="button" aria-label="지갑 창 닫기" onClick={closePanel}>
            ✕
          </CloseButton>
        </Head>
        <Body>
          <Content />
        </Body>
      </Dialog>
    </Backdrop>
  );
}

function Content() {
  const w = useWallet();

  if (!w.configured) {
    return (
      <Section>
        <Title>지갑 연결 설정이 필요해요</Title>
        <Desc>
          <code>NEXT_PUBLIC_PRIVY_APP_ID</code>를 <code>.env.local</code>에 넣으면 지갑 연결이 켜져요.
        </Desc>
      </Section>
    );
  }

  if (!w.ready) return <Desc>지갑 상태를 불러오는 중이에요…</Desc>;

  if (!w.authenticated && w.wallets.length === 0) {
    return (
      <Section>
        <Title>지갑을 연결해 주세요</Title>
        <Desc>브라우저 지갑, 모바일 지갑(WalletConnect), 이메일로 만드는 내장 지갑 중에서 고를 수 있어요.</Desc>
        <Primary type="button" onClick={w.login}>
          지갑 연결하기
        </Primary>
      </Section>
    );
  }

  return (
    <>
      {w.previous && <PreviousAccountNotice />}

      <Section>
        <Row>
          <Title>서명할 주소</Title>
          <Ghost type="button" onClick={w.connectAnother}>
            다른 지갑 연결
          </Ghost>
        </Row>
        <Desc>주문과 계정 서명에 쓸 주소를 직접 골라 주세요.</Desc>
        <WalletList role="radiogroup" aria-label="서명할 주소">
          {w.wallets.map((item) => {
            const checked = w.address?.toLowerCase() === item.address.toLowerCase();
            return (
              <li key={item.address}>
                <WalletItem type="button" role="radio" aria-checked={checked} $checked={checked} onClick={() => w.selectAddress(item.address)}>
                  <Radio $checked={checked} aria-hidden />
                  <span>
                    <strong>{shortAddress(item.address)}</strong>
                    <small>{walletLabel(item)}</small>
                  </span>
                </WalletItem>
              </li>
            );
          })}
          {w.wallets.length === 0 && <Desc>연결된 EVM 지갑이 없어요. 다른 지갑을 연결해 주세요.</Desc>}
        </WalletList>
      </Section>

      {w.address && <AccountSection />}

      <Footer>
        <Ghost type="button" onClick={w.logout}>
          연결 해제
        </Ghost>
        <small>연결 해제는 이 브라우저의 서명 세션만 끝내요. 자동매매용 서버 권한 해지와는 별개예요.</small>
      </Footer>
    </>
  );
}

function AccountSection() {
  const w = useWallet();
  const running = w.setup.status === "running" ? w.setup.step : null;
  const activeIndex = running ? STEPS.findIndex((s) => s.key === running) : -1;

  if (w.unlocked && w.account) {
    return (
      <Section>
        <Row>
          <Title>Extended 계정</Title>
          <Ghost type="button" onClick={w.lock}>
            잠그기
          </Ghost>
        </Row>
        <Facts>
          <div>
            <dt>계정 ID</dt>
            <dd>{w.account.accountId}</dd>
          </div>
          <div>
            <dt>Vault</dt>
            <dd>{w.account.vault}</dd>
          </div>
          <div>
            <dt>Stark 공개키</dt>
            <dd>{shortAddress(w.account.starkPublicKey)}</dd>
          </div>
          <div>
            <dt>빌더 수수료</dt>
            <dd>{Number(BUILDER_FEE) * 100}%</dd>
          </div>
        </Facts>
      </Section>
    );
  }

  const unlockOnly = Boolean(w.account);
  return (
    <Section>
      <Title>{unlockOnly ? "서명으로 잠금 해제" : "Extended 계정 연결"}</Title>
      <Desc>
        {unlockOnly
          ? "주문 서명 키는 저장하지 않아요. 같은 지갑으로 한 번 서명하면 이 기기에서 키를 다시 만들어요."
          : "지갑 연결과 계정 생성은 별개예요. 아래 단계를 거쳐 Extended 계정을 만들거나 기존 계정을 불러와요."}
      </Desc>
      {!unlockOnly && (
        <Steps>
          {STEPS.map((step, i) => (
            <StepItem key={step.key} $state={i < activeIndex ? "done" : i === activeIndex ? "active" : "todo"}>
              <span aria-hidden>{i + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <small>{step.hint}</small>
              </div>
            </StepItem>
          ))}
        </Steps>
      )}
      {w.setup.status === "error" && <ErrorText role="alert">{w.setup.message}</ErrorText>}
      <Primary type="button" disabled={Boolean(running)} onClick={w.connectAccount}>
        {running ? `${STEPS[activeIndex]?.label ?? "진행"} 중…` : unlockOnly ? "서명하고 잠금 해제" : "Extended 계정 연결하기"}
      </Primary>
    </Section>
  );
}

/* ---------- 스타일 ---------- */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 23, 51, 0.45);
`;

const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: min(480px, calc(100vw - 32px));
  max-height: min(760px, calc(100dvh - 32px));
  border-radius: ${({ theme }) => theme.radius.xl};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.text};
  box-shadow: ${({ theme }) => theme.shadow.popover};
  overflow: hidden;

  @media (max-width: 480px) {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
`;

const Head = styled.header`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  h2 {
    font-size: 18px;
    font-weight: 700;
  }
`;

const NetworkBadge = styled.span<{ $mainnet: boolean }>`
  padding: 3px 8px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 700;
  color: ${({ theme, $mainnet }) => ($mainnet ? theme.colors.rise : "#0a8f6a")};
  background: ${({ theme, $mainnet }) => ($mainnet ? theme.colors.riseWeak : "#e6f8f1")};
`;

const CloseButton = styled.button`
  margin-left: auto;
  width: 32px;
  height: 32px;
  border-radius: ${({ theme }) => theme.radius.sm};
  color: ${({ theme }) => theme.colors.textWeak};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
`;

const WalletList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const WalletItem = styled.button<{ $checked: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  border: 1px solid ${({ theme, $checked }) => ($checked ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $checked }) => ($checked ? theme.colors.primaryWeak : theme.colors.bg)};
  text-align: left;

  span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  strong {
    font-size: 14px;
    font-weight: 700;
  }

  small {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Radio = styled.i<{ $checked: boolean }>`
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid ${({ theme, $checked }) => ($checked ? theme.colors.primary : theme.colors.textDisabled)};
  box-shadow: inset 0 0 0 3px ${({ theme }) => theme.colors.bg};
  background: ${({ theme, $checked }) => ($checked ? theme.colors.primary : "transparent")};
`;

const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const StepItem = styled.li<{ $state: "done" | "active" | "todo" }>`
  display: flex;
  gap: 10px;

  > span {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 12px;
    font-weight: 700;
    color: ${({ theme, $state }) => ($state === "todo" ? theme.colors.textWeak : "#fff")};
    background: ${({ theme, $state }) => ($state === "done" ? "#0a8f6a" : $state === "active" ? theme.colors.primary : theme.colors.surface)};
  }

  div {
    display: flex;
    flex-direction: column;
  }

  strong {
    font-size: 14px;
    font-weight: 600;
  }

  small {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const Footer = styled.footer`
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 16px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  small {
    font-size: 12px;
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textWeak};
    word-break: keep-all;
  }
`;
