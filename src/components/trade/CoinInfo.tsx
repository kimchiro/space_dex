"use client";

import styled from "styled-components";
import type { Token } from "@/data/tokens";
import { getTokenProfile, getTopHolders, type Holder } from "@/data/tokenDetails";
import { formatCompact, formatPrice } from "@/lib/format";

const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function formatSupply(value: number) {
  return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function CoinInfo({ token }: { token: Token }) {
  const profile = getTokenProfile(token);
  const holders = getTopHolders(token);
  const topTotal = holders.reduce((s, h) => s + h.share, 0);

  const fields: [string, string][][] = [
    [
      ["시가총액", formatCompact(token.marketCap)],
      ["24h 거래대금", formatCompact(token.volume24h)],
      ["현재가", formatPrice(token.price)],
    ],
    [
      ["발행처", profile.issuer],
      ["체인", token.chain ?? "-"],
      ["컨트랙트", shortAddress(profile.contract)],
    ],
    [
      ["출시일", profile.launchDate],
      ["유통량", `${formatSupply(profile.circulatingSupply)} ${token.symbol}`],
      ["최대 발행량", profile.maxSupply ? `${formatSupply(profile.maxSupply)} ${token.symbol}` : "제한 없음"],
    ],
  ];

  return (
    <Card>
      <TitleRow>
        <Title>{token.name}</Title>
        <Symbol>{token.symbol}</Symbol>
      </TitleRow>
      <Source>출처: 온체인 데이터 및 {profile.website}</Source>
      <Description>{profile.description}</Description>

      <Fields>
        {fields.map((column, i) => (
          <FieldColumn key={i}>
            {column.map(([label, value]) => (
              <Field key={label}>
                <dt>{label}</dt>
                <dd title={value}>{value}</dd>
              </Field>
            ))}
          </FieldColumn>
        ))}
      </Fields>

      <SectionHead>
        <SectionTitle>보유 비중 Top 10</SectionTitle>
        <SectionSub>상위 10개 지갑 합계 {topTotal.toFixed(2)}% · 출처: 온체인 데이터</SectionSub>
      </SectionHead>

      <HolderBody>
        <Donut holders={holders} />
        <HolderList>
          {holders.map((h) => (
            <HolderRow key={h.label}>
              <Swatch style={{ background: h.color }} />
              <HolderLabel>{h.label}</HolderLabel>
              <HolderShare>{h.share.toFixed(2)}%</HolderShare>
            </HolderRow>
          ))}
        </HolderList>
      </HolderBody>
    </Card>
  );
}

function Donut({ holders }: { holders: Holder[] }) {
  const lengths = holders.map((h) => (h.share / 100) * CIRCUMFERENCE);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((s, l) => s + l, 0));

  return (
    <svg width={180} height={180} viewBox="0 0 120 120" aria-hidden>
      <circle cx={60} cy={60} r={RADIUS} fill="none" stroke="#d1d6db" strokeWidth={16} />
      {holders.map((h, i) => (
        <circle
          key={h.label}
          cx={60}
          cy={60}
          r={RADIUS}
          fill="none"
          stroke={h.color}
          strokeWidth={16}
          strokeDasharray={`${lengths[i]} ${CIRCUMFERENCE - lengths[i]}`}
          strokeDashoffset={-offsets[i]}
          transform="rotate(-90 60 60)"
        />
      ))}
    </svg>
  );
}

const Card = styled.div`
  padding: 28px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
`;

const Title = styled.h2`
  font-size: 20px;
  font-weight: 700;
`;

const Symbol = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Source = styled.p`
  margin-top: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const Description = styled.p`
  margin-top: 20px;
  font-size: 15px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.text};
`;

const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 24px;
  padding: 16px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  @container main (max-width: 640px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
`;

const FieldColumn = styled.dl`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 0 16px;

  & + & {
    border-left: 1px solid ${({ theme }) => theme.colors.border};
  }

  &:first-child {
    padding-left: 0;
  }

  @container main (max-width: 640px) {
    padding: 0;

    & + & {
      border-left: none;
    }
  }
`;

const Field = styled.div`
  display: flex;
  gap: 10px;
  font-size: 13px;

  dt {
    flex-shrink: 0;
    min-width: 56px;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
  }

  dd {
    overflow: hidden;
    color: ${({ theme }) => theme.colors.text};
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 32px;
`;

const SectionTitle = styled.h3`
  font-size: 17px;
  font-weight: 700;
`;

const SectionSub = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textWeak};
`;

const HolderBody = styled.div`
  display: flex;
  align-items: center;
  gap: 40px;
  margin-top: 16px;

  @container main (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;

    svg {
      align-self: center;
    }
  }
`;

const HolderList = styled.ul`
  flex: 1;
  min-width: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const HolderRow = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  font-size: 14px;
`;

const Swatch = styled.span`
  width: 12px;
  height: 12px;
  border-radius: 3px;
`;

const HolderLabel = styled.span`
  flex: 1;
  color: ${({ theme }) => theme.colors.textSub};
`;

const HolderShare = styled.span`
  font-weight: 600;
`;
