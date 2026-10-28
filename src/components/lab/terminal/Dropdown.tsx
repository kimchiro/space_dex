"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styled from "styled-components";

/** 버튼을 누르면 아래로 열리는 메뉴. 바깥 클릭·Esc로 닫힌다. */
export default function Dropdown({
  trigger,
  children,
  align = "left",
  label,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Root ref={rootRef}>
      <TriggerButton type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger(open)}
      </TriggerButton>
      {open && (
        <Menu role="menu" $align={align}>
          {children(() => setOpen(false))}
        </Menu>
      )}
    </Root>
  );
}

const Root = styled.div`
  position: relative;
`;

const TriggerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textSub};
  white-space: nowrap;

  &:hover,
  &[aria-expanded="true"] {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Menu = styled.div<{ $align: "left" | "right" }>`
  position: absolute;
  top: calc(100% + 4px);
  ${({ $align }) => ($align === "left" ? "left: 0;" : "right: 0;")}
  z-index: 30;
  min-width: 200px;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bg};
  box-shadow: ${({ theme }) => theme.shadow.popover};
`;

export const MenuLabel = styled.div`
  padding: 6px 10px 4px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textWeak};
`;

export const MenuItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  text-align: left;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};

  &:hover {
    background: ${({ theme }) => theme.colors.surface};
  }

  small {
    margin-left: auto;
    font-size: 11px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textWeak};
  }
`;

export const MenuCheck = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.textDisabled)};
  background: ${({ theme, $on }) => ($on ? theme.colors.primary : "transparent")};
  color: #fff;
  font-size: 11px;
  line-height: 1;
`;

export const MenuDivider = styled.hr`
  margin: 6px 4px;
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;
