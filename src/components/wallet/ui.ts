import styled from "styled-components";

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

export const Title = styled.h3`
  font-size: 15px;
  font-weight: 700;
`;

export const Desc = styled.p`
  font-size: 13px;
  line-height: 1.6;
  color: ${({ theme }) => theme.colors.textSub};
  word-break: keep-all;

  code {
    padding: 1px 4px;
    border-radius: 4px;
    background: ${({ theme }) => theme.colors.surface};
    font-size: 12px;
  }
`;

export const Primary = styled.button`
  height: 48px;
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.primary};
  color: #fff;
  font-size: 15px;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Ghost = styled.button`
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};
  background: ${({ theme }) => theme.colors.surface};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceHover};
  }

  &:disabled {
    opacity: 0.5;
  }
`;

export const ErrorText = styled.p`
  padding: 10px 12px;
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: 13px;
  line-height: 1.5;
  color: ${({ theme }) => theme.colors.rise};
  background: ${({ theme }) => theme.colors.riseWeak};
`;

export const Facts = styled.dl`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  div {
    padding: 10px 12px;
    border-radius: ${({ theme }) => theme.radius.sm};
    background: ${({ theme }) => theme.colors.bgSub};
    border: 1px solid ${({ theme }) => theme.colors.border};
    min-width: 0;
  }

  dt {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.textWeak};
  }

  dd {
    margin-top: 2px;
    font-size: 14px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
