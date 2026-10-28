"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

/** 버튼을 누르면 아래로 열리는 메뉴. 바깥 클릭·Esc로 닫힌다. */
export default function Dropdown({
  trigger,
  children,
  align = "left",
  label,
  panel = false,
}: {
  trigger: (open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  label: string;
  /** 내용이 스스로 크기·스크롤을 관리하는 패널형 메뉴 */
  panel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => setOpen(false);
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // 툴바가 가로 스크롤 영역이라 메뉴를 그 안에 두면 잘리므로, 버튼 위치를 기준으로 화면에 고정해 띄운다.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    const button = buttonRef.current?.getBoundingClientRect();
    if (!open || !menu || !button) return;
    const wanted = align === "left" ? button.left : button.right - menu.offsetWidth;
    menu.style.top = `${button.bottom + 4}px`;
    menu.style.left = `${Math.max(8, Math.min(wanted, window.innerWidth - menu.offsetWidth - 8))}px`;
  }, [open, align]);

  return (
    <>
      <TriggerButton ref={buttonRef} type="button" aria-haspopup={panel ? "dialog" : "menu"} aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger(open)}
      </TriggerButton>
      {open &&
        createPortal(
          <Menu
            ref={menuRef}
            role={panel ? "dialog" : "menu"}
            aria-label={label}
            $panel={panel}
          >
            {children(() => setOpen(false))}
          </Menu>,
          document.fullscreenElement ?? document.body,
        )}
    </>
  );
}

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

const Menu = styled.div<{ $panel: boolean }>`
  position: fixed;
  z-index: 1000;
  min-width: 200px;
  ${({ $panel }) => ($panel ? "display: flex; overflow: hidden;" : "max-height: 360px; overflow-y: auto; padding: 6px;")}
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
