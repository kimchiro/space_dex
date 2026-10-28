import { V4_INPUT_TYPES, V4_RENAMES } from "./builtins";
import { lex, type Token } from "./lexer";

export type Change = { line: number; from: string; to: string; note: string };

type Edit = { line: number; col: number; end: number; text: string };

export function detectVersion(source: string): number | null {
  const m = /^\s*\/\/\s*@version\s*=\s*(\d+)/m.exec(source);
  return m ? Number(m[1]) : null;
}

/**
 * v4 코드를 v5 문법으로 옮긴다. 함수 이름 변경, input 타입 인자 변환, 버전 주석 교체만 한다.
 * 의미가 바뀌는 변환은 하지 않고, 바뀐 위치를 모두 기록한다.
 */
export function convertToV5(source: string): { code: string; changes: Change[] } {
  const version = detectVersion(source);
  if (version === null || version >= 5) return { code: source, changes: [] };

  const { lines } = lex(source);
  const tokens = lines.flatMap((l) => l.tokens);
  const edits: Edit[] = [];
  const changes: Change[] = [];

  const isOp = (t: Token | undefined, v: string) => t?.type === "op" && t.value === v;

  tokens.forEach((t, i) => {
    if (t.type !== "id" || !isOp(tokens[i + 1], "(") || isOp(tokens[i - 1], ".")) return;

    const renamed = V4_RENAMES[t.value];
    if (renamed) {
      edits.push({ line: t.line, col: t.col, end: t.end, text: renamed });
      changes.push({ line: t.line, from: t.value, to: renamed, note: "v5 네임스페이스 함수로 이름 변경" });
      return;
    }

    if (t.value === "input") {
      let depth = 0;
      for (let j = i + 1; j < tokens.length; j++) {
        const tok = tokens[j];
        if (isOp(tok, "(") || isOp(tok, "[")) depth++;
        if (isOp(tok, ")") || isOp(tok, "]")) depth--;
        if (depth === 0) break;
        const isTypeArg =
          depth === 1 && tok.type === "id" && tok.value === "type" && isOp(tokens[j + 1], "=") &&
          tokens[j + 2]?.value === "input" && isOp(tokens[j + 3], ".") && tokens[j + 4]?.type === "id";
        if (!isTypeArg) continue;

        const typeName = `input.${tokens[j + 4].value}`;
        const target = V4_INPUT_TYPES[typeName] ?? "input";
        const comma = tokens[j - 1];
        const startTok = isOp(comma, ",") ? comma : tok;
        const endTok = tokens[j + 4];
        if (startTok.line === endTok.line) edits.push({ line: startTok.line, col: startTok.col, end: endTok.end, text: "" });
        edits.push({ line: t.line, col: t.col, end: t.end, text: target });
        changes.push({ line: t.line, from: `input(…, type=${typeName})`, to: `${target}(…)`, note: "v5 타입별 input 함수로 변경" });
        break;
      }
    }
  });

  const sourceLines = source.split("\n");
  const versionLine = sourceLines.findIndex((l) => /^\s*\/\/\s*@version\s*=/.test(l));
  if (versionLine >= 0) {
    sourceLines[versionLine] = "//@version=5";
    changes.unshift({ line: versionLine + 1, from: `@version=${version}`, to: "@version=5", note: "Pine v5 기준으로 변환" });
  }

  const byLine = new Map<number, Edit[]>();
  edits.forEach((e) => byLine.set(e.line, [...(byLine.get(e.line) ?? []), e]));
  byLine.forEach((lineEdits, line) => {
    let text = sourceLines[line - 1];
    lineEdits.sort((a, b) => b.col - a.col).forEach((e) => {
      text = text.slice(0, e.col) + e.text + text.slice(e.end);
    });
    sourceLines[line - 1] = text;
  });

  if (/\btransp\s*=/.test(source)) {
    const line = source.split("\n").findIndex((l) => /\btransp\s*=/.test(l)) + 1;
    changes.push({ line, from: "transp=", to: "color.new(색, 투명도)", note: "v5에서 transp 인자가 없어졌어요. 투명도는 무시하고 표시해요." });
  }

  return { code: sourceLines.join("\n"), changes: changes.sort((a, b) => a.line - b.line) };
}
