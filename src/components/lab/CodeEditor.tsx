"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import styled from "styled-components";
import type { Severity } from "@/lib/pine/ast";

export type CodeEditorHandle = { goToLine: (line: number) => void };

const LINE_HEIGHT = 20;

export default function CodeEditor({
  value,
  onChange,
  marks,
  readOnly,
  height = 420,
  ref,
}: {
  value: string;
  onChange?: (value: string) => void;
  marks?: Map<number, Severity>;
  readOnly?: boolean;
  height?: number;
  ref?: Ref<CodeEditorHandle>;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = value.split("\n").length;

  useImperativeHandle(ref, () => ({
    goToLine: (line) => {
      const area = areaRef.current;
      if (!area) return;
      const lines = value.split("\n");
      const start = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
      area.focus();
      area.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
      area.scrollTop = Math.max(0, (line - 4) * LINE_HEIGHT);
    },
  }));

  return (
    <Frame style={{ height }}>
      <Gutter ref={gutterRef} aria-hidden>
        {Array.from({ length: lineCount }, (_, i) => {
          const mark = marks?.get(i + 1);
          return (
            <span key={i} data-mark={mark}>
              {i + 1}
            </span>
          );
        })}
      </Gutter>
      <Area
        ref={areaRef}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        wrap="off"
        aria-label="Pine Script 코드"
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab" || readOnly) return;
          e.preventDefault();
          const area = e.currentTarget;
          const { selectionStart, selectionEnd } = area;
          const next = `${value.slice(0, selectionStart)}    ${value.slice(selectionEnd)}`;
          onChange?.(next);
          requestAnimationFrame(() => area.setSelectionRange(selectionStart + 4, selectionStart + 4));
        }}
      />
    </Frame>
  );
}

const Frame = styled.div`
  display: flex;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: #fbfcfd;
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: 13px;
`;

const Gutter = styled.div`
  flex-shrink: 0;
  overflow: hidden;
  width: 44px;
  padding: 10px 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bgSub};
  color: ${({ theme }) => theme.colors.textDisabled};
  text-align: right;

  span {
    display: block;
    height: ${LINE_HEIGHT}px;
    padding-right: 8px;
    line-height: ${LINE_HEIGHT}px;
  }

  span[data-mark="error"] {
    background: #ffe3e5;
    color: #f04452;
    font-weight: 700;
  }

  span[data-mark="warning"] {
    background: #fff1d6;
    color: #d97a00;
    font-weight: 700;
  }
`;

const Area = styled.textarea`
  flex: 1;
  min-width: 0;
  padding: 10px 12px;
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.colors.text};
  font: inherit;
  line-height: ${LINE_HEIGHT}px;
  white-space: pre;
  resize: none;
  tab-size: 4;

  &:focus {
    outline: none;
  }
`;
