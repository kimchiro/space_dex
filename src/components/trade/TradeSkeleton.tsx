"use client";

import styled, { keyframes } from "styled-components";

export default function TradeSkeleton() {
  return (
    <>
      <Block style={{ width: 280, height: 64, marginBottom: 20 }} />
      <Block style={{ height: 72, marginBottom: 20 }} />
      <Grid>
        <Block style={{ height: 400 }} />
        <Block style={{ height: 560 }} />
      </Grid>
    </>
  );
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const Block = styled.div`
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.surface};
  animation: ${pulse} 1.4s ease-in-out infinite;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;

  @container main (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
