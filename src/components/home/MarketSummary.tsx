"use client";

import styled from "styled-components";
import { generateSeries, marketIndices } from "@/data/tokens";
import ChangeText from "@/components/common/ChangeText";
import Sparkline from "@/components/common/Sparkline";

export default function MarketSummary() {
  return (
    <Section>
      <Title>오늘의 DEX 시장</Title>
      <Grid>
        {marketIndices.map((idx) => {
          const series = generateSeries(idx.seed, 40, 100, 0.015);
          if (series[series.length - 1] >= series[0] !== idx.change >= 0) series.reverse();
          return (
            <Card key={idx.label}>
              <Label>{idx.label}</Label>
              <Value>{idx.value}</Value>
              <Bottom>
                <ChangeText value={idx.change} size={14} />
                <Sparkline data={series} width={88} height={28} />
              </Bottom>
            </Card>
          );
        })}
      </Grid>
    </Section>
  );
}

const Section = styled.section`
  margin-bottom: 40px;
`;

const Title = styled.h2`
  margin-bottom: 16px;
  font-size: 20px;
  font-weight: 700;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const Card = styled.div`
  padding: 20px;
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface};
  transition: background 0.15s;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const Label = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textSub};
`;

const Value = styled.p`
  margin-top: 6px;
  font-size: 22px;
  font-weight: 700;
`;

const Bottom = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: 8px;
`;
