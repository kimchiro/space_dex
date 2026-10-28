export type Expr =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "na" }
  | { k: "id"; name: string; line: number }
  | { k: "hist"; id: number; e: Expr; offset: Expr; line: number }
  | { k: "un"; op: "-" | "+" | "not"; e: Expr }
  | { k: "bin"; op: string; l: Expr; r: Expr }
  | { k: "tern"; c: Expr; a: Expr; b: Expr }
  | { k: "call"; id: number; name: string; args: Expr[]; named: Record<string, Expr>; line: number };

export type Stmt =
  | { t: "assign"; mode: "decl" | "var" | "reassign"; name: string; e: Expr; line: number }
  | { t: "tuple"; names: string[]; e: Expr; line: number }
  | { t: "expr"; e: Expr; line: number }
  | { t: "if"; cond: Expr; then: Stmt[]; else: Stmt[]; line: number };

export type Program = Stmt[];

export type Severity = "error" | "warning" | "info";
export type Diagnostic = { line: number; severity: Severity; message: string };
