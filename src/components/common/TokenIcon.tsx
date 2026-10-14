"use client";

import styled from "styled-components";

type Props = {
  symbol: string;
  color: string;
  size?: number;
};

export default function TokenIcon({ symbol, color, size = 36 }: Props) {
  return (
    <Circle $color={color} $size={size} aria-hidden>
      {symbol.slice(0, 1)}
    </Circle>
  );
}

const Circle = styled.span<{ $color: string; $size: number }>`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  color: #fff;
  font-size: ${({ $size }) => Math.round($size * 0.42)}px;
  font-weight: 700;
`;
