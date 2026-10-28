"use client";

import styled, { css } from "styled-components";

export const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  background: ${({ theme }) => theme.colors.bg};
`;

export const CardHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export const Title = styled.h2`
  font-size: 17px;
  font-weight: 700;
`;

export const SubTitle = styled.h3`
  font-size: 14px;
  font-weight: 700;
`;

export const Muted = styled.p`
  font-size: 13px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean }>`
  display: flex;
  flex-wrap: ${({ $wrap = true }) => ($wrap ? "wrap" : "nowrap")};
  align-items: center;
  gap: ${({ $gap = 8 }) => $gap}px;
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
`;

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};

  small {
    font-weight: 400;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

const control = css`
  height: 38px;
  padding: 0 10px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: ${({ theme }) => theme.colors.bg};
  font-size: 14px;
  color: ${({ theme }) => theme.colors.text};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.bgSub};
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

export const Input = styled.input`
  ${control}
  min-width: 0;
`;

export const Select = styled.select`
  ${control}
  min-width: 0;
`;

export const TextArea = styled.textarea`
  ${control}
  height: auto;
  padding: 10px;
  line-height: 1.5;
  resize: vertical;
`;

export const Button = styled.button<{ $variant?: "primary" | "secondary" | "ghost" | "danger"; $size?: "sm" | "md" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: ${({ $size = "md" }) => ($size === "sm" ? "32px" : "40px")};
  padding: 0 ${({ $size = "md" }) => ($size === "sm" ? "12px" : "16px")};
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ $size = "md" }) => ($size === "sm" ? "13px" : "14px")};
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s;

  ${({ theme, $variant = "secondary" }) => {
    switch ($variant) {
      case "primary":
        return css`
          background: ${theme.colors.primary};
          color: #fff;
          &:hover:not(:disabled) {
            background: ${theme.colors.primaryHover};
          }
        `;
      case "danger":
        return css`
          background: ${theme.colors.riseWeak};
          color: ${theme.colors.rise};
        `;
      case "ghost":
        return css`
          color: ${theme.colors.textSub};
          &:hover:not(:disabled) {
            background: ${theme.colors.surface};
          }
        `;
      default:
        return css`
          background: ${theme.colors.surface};
          color: ${theme.colors.text};
          &:hover:not(:disabled) {
            background: ${theme.colors.surfaceHover};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const BADGE_COLORS = {
  ok: ["#e6f8f1", "#00a36c"],
  warn: ["#fff6e5", "#d97a00"],
  error: ["#fff0f1", "#f04452"],
  info: ["#e8f3ff", "#3182f6"],
  neutral: ["#f2f4f6", "#4e5968"],
} as const;

export type BadgeTone = keyof typeof BADGE_COLORS;

export const Badge = styled.span<{ $tone?: BadgeTone }>`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  background: ${({ $tone = "neutral" }) => BADGE_COLORS[$tone][0]};
  color: ${({ $tone = "neutral" }) => BADGE_COLORS[$tone][1]};
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;

  th {
    padding: 8px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textWeak};
    text-align: right;
    white-space: nowrap;
  }

  td {
    padding: 9px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.bgSub};
    text-align: right;
    white-space: nowrap;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }
`;

export const TableScroll = styled.div`
  overflow: auto;
  max-height: 360px;
`;

export const Notice = styled.div<{ $tone?: BadgeTone }>`
  padding: 12px 14px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ $tone = "info" }) => BADGE_COLORS[$tone][0]};
  color: ${({ theme }) => theme.colors.textSub};
  font-size: 13px;
  line-height: 1.55;

  strong {
    color: ${({ $tone = "info" }) => BADGE_COLORS[$tone][1]};
  }
`;

export const Stat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  dt {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
    white-space: nowrap;
  }

  dd {
    font-size: 16px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
`;

export const StatGrid = styled.dl`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 14px 18px;
`;
