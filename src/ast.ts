// tak AST node type definitions

export type AstNode =
  | Program
  | FnDef
  | Quotation
  | DictLiteral
  | Literal
  | Word
  | JsExpr
  | Use;

export interface Program {
  type: 'Program';
  body: AstNode[];
}

export interface StackEffect {
  inputs: string[];
  outputs: string[];
}

export interface FnDef {
  type: 'FnDef';
  name: string;
  effect: StackEffect;
  body: AstNode[];
  line: number;
  col: number;
}

export interface Quotation {
  type: 'Quotation';
  body: AstNode[];
  line: number;
  col: number;
}

export interface DictEntry {
  key: string;
  value: AstNode;
}

export interface DictLiteral {
  type: 'DictLiteral';
  entries: DictEntry[];
  line: number;
  col: number;
}

export interface Literal {
  type: 'Literal';
  value: number | string | boolean | null;
  line: number;
  col: number;
}

export interface Word {
  type: 'Word';
  name: string;
  line: number;
  col: number;
}

export interface JsExpr {
  type: 'JsExpr';
  /** raw JS source to eval */
  expr: string;
  line: number;
  col: number;
}

export interface UseBinding {
  /** Name of the export in the module */
  name: string;
  /** Local word name to define (same as name if no `as`) */
  alias: string;
}

export interface Use {
  type: 'Use';
  url: string;
  /** null = push whole module onto stack; array = defineWord per binding */
  bindings: UseBinding[] | null;
  line: number;
  col: number;
}
