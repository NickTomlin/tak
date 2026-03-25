// tak interpreter — tree-walking evaluator

import { AstNode, Program, FnDef, Quotation, DictLiteral, Literal, Word, JsExpr, Use } from './ast.js';

// Dynamic import that bypasses bundler static analysis
const _dynImport = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, unknown>>;

function collectUseUrls(nodes: AstNode[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    if (node.type === 'Use') {
      urls.push(node.url);
    } else if (node.type === 'FnDef') {
      urls.push(...collectUseUrls(node.body));
    } else if (node.type === 'Quotation') {
      urls.push(...collectUseUrls(node.body));
    }
  }
  return urls;
}

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export interface TakArray {
  kind: 'array';
  items: TakValue[];
}

export interface TakDict {
  kind: 'dict';
  map: Map<string, TakValue>;
}

export interface TakQuot {
  kind: 'quot';
  body: AstNode[];
  /** The interpreter instance that owns this quotation (for calling) */
  interp: TakInterpreter;
}

export interface TakJS {
  kind: 'js';
  value: unknown;
}

export type TakValue =
  | number
  | string
  | boolean
  | null
  | TakArray
  | TakDict
  | TakQuot
  | TakJS
  | Element;

export type TakWord = (interp: TakInterpreter) => Promise<void> | void;

// ---------------------------------------------------------------------------
// Minimal inline EventEmitter
// ---------------------------------------------------------------------------

type Listener<T> = (payload: T) => void;

class TakEmitter {
  private _listeners = new Map<string, Listener<unknown>[]>();

  on<T>(event: string, listener: Listener<T>): void {
    const list = this._listeners.get(event) ?? [];
    list.push(listener as Listener<unknown>);
    this._listeners.set(event, list);
  }

  off<T>(event: string, listener: Listener<T>): void {
    const list = this._listeners.get(event) ?? [];
    this._listeners.set(event, list.filter(l => l !== listener));
  }

  emit<T>(event: string, payload: T): void {
    const list = this._listeners.get(event) ?? [];
    for (const listener of list) listener(payload as unknown);
  }
}

// ---------------------------------------------------------------------------
// Interpreter options
// ---------------------------------------------------------------------------

export interface TakInterpreterOptions {
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// TakError
// ---------------------------------------------------------------------------

export class TakError extends Error {
  constructor(message: string, public word?: string, public takStack?: TakValue[]) {
    super(message);
    this.name = 'TakError';
  }
}

// ---------------------------------------------------------------------------
// TakInterpreter
// ---------------------------------------------------------------------------

export class TakInterpreter extends TakEmitter {
  /** The data stack */
  private _stack: TakValue[] = [];

  /** The word dictionary */
  dict: Map<string, TakWord> = new Map();

  /** Debug mode flag */
  readonly debug: boolean;

  /** Cache of pre-fetched modules keyed by URL */
  private _moduleCache = new Map<string, Record<string, unknown>>();

  constructor(options: TakInterpreterOptions = {}) {
    super();
    this.debug = options.debug ?? false;
  }

  // -------------------------------------------------------------------------
  // Stack access (read-only snapshots exposed externally)
  // -------------------------------------------------------------------------

  get stack(): TakValue[] {
    return [...this._stack];
  }

  // -------------------------------------------------------------------------
  // Stack operations (used by stdlib)
  // -------------------------------------------------------------------------

  push(value: TakValue): void {
    this._stack.push(value);
    this.emit('push', { value, stack: [...this._stack] });
  }

  pop(): TakValue {
    if (this._stack.length === 0) {
      throw new TakError('Stack underflow');
    }
    const value = this._stack.pop()!;
    this.emit('pop', { value, stack: [...this._stack] });
    return value;
  }

  peek(offset = 0): TakValue {
    const idx = this._stack.length - 1 - offset;
    if (idx < 0) throw new TakError('Stack underflow');
    return this._stack[idx];
  }

  stackSize(): number {
    return this._stack.length;
  }

  // -------------------------------------------------------------------------
  // Word registration & lookup
  // -------------------------------------------------------------------------

  defineWord(name: string, fn: TakWord): void {
    this.dict.set(name, fn);
  }

  // -------------------------------------------------------------------------
  // run / eval
  // -------------------------------------------------------------------------

  async run(program: Program): Promise<void> {
    // Pre-fetch all Use node URLs concurrently before executing anything
    const urls = [...new Set(collectUseUrls(program.body))];
    const unfetched = urls.filter(u => !this._moduleCache.has(u));
    if (unfetched.length > 0) {
      await Promise.all(unfetched.map(async url => {
        this._moduleCache.set(url, await _dynImport(url));
      }));
    }

    for (const node of program.body) {
      await this.eval(node);
    }
    this.emit('scriptEnd', { stack: [...this._stack] });
  }

  async eval(node: AstNode): Promise<void> {
    switch (node.type) {
      case 'Program':
        for (const child of node.body) await this.eval(child);
        break;

      case 'Literal':
        this.push(node.value);
        break;

      case 'Quotation': {
        // Push as a TakQuot (not evaluated immediately)
        const quot: TakQuot = { kind: 'quot', body: node.body, interp: this };
        this.push(quot);
        break;
      }

      case 'DictLiteral': {
        const map = new Map<string, TakValue>();
        for (const entry of node.entries) {
          await this.eval(entry.value);
          const val = this.pop();
          map.set(entry.key, val);
        }
        const dict: TakDict = { kind: 'dict', map };
        this.push(dict);
        break;
      }

      case 'FnDef':
        await this.evalFnDef(node);
        break;

      case 'Word':
        await this.evalWord(node.name, node.line, node.col);
        break;

      case 'JsExpr':
        await this.evalJsExpr(node);
        break;

      case 'Use':
        await this.evalUse(node);
        break;

      default:
        throw new TakError(`Unknown AST node type: ${(node as AstNode).type}`);
    }
  }

  // -------------------------------------------------------------------------
  // FnDef: register a new word
  // -------------------------------------------------------------------------

  private async evalFnDef(node: FnDef): Promise<void> {
    const name = node.name;
    const body = node.body;
    // Capture the interpreter reference; the word is a closure
    const interp = this;

    this.defineWord(name, async (_: TakInterpreter) => {
      for (const bodyNode of body) {
        await interp.eval(bodyNode);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Word lookup & execution
  // -------------------------------------------------------------------------

  private async evalWord(name: string, line: number, col: number): Promise<void> {
    const word = this.dict.get(name);
    if (!word) {
      throw new TakError(`Unknown word: ${name} at ${line}:${col}`, name, [...this._stack]);
    }

    this.emit('beforeWord', { word: name, stack: [...this._stack] });

    try {
      await word(this);
    } catch (err) {
      const takErr = err instanceof TakError
        ? err
        : new TakError(
            err instanceof Error ? err.message : String(err),
            name,
            [...this._stack],
          );
      this.emit('error', { error: takErr, word: name, stack: [...this._stack] });
      throw takErr;
    }

    this.emit('afterWord', { word: name, stack: [...this._stack] });
  }

  // -------------------------------------------------------------------------
  // JsExpr: eval raw JS, push result
  // -------------------------------------------------------------------------

  private async evalJsExpr(node: JsExpr): Promise<void> {
    let result: unknown;
    try {
      // Indirect eval: runs in global scope, avoids bundler scope-hoisting issues
      // eslint-disable-next-line no-eval
      result = (0, eval)(node.expr);
    } catch (err) {
      throw new TakError(
        `@js eval error: ${err instanceof Error ? err.message : String(err)}`,
        '@js',
        [...this._stack],
      );
    }
    // If the result is a promise, await it
    if (result instanceof Promise) {
      result = await result;
    }
    this.push(result as TakValue);
  }

  // -------------------------------------------------------------------------
  // Use: static import (pre-fetched in run())
  // -------------------------------------------------------------------------

  private async evalUse(node: Use): Promise<void> {
    const mod = this._moduleCache.get(node.url);
    if (!mod) {
      throw new TakError(`Module not pre-fetched: ${node.url}`, 'use', [...this._stack]);
    }

    if (node.bindings === null) {
      // Push the whole module object as a TakJS value
      this.push({ kind: 'js', value: mod } as TakJS);
    } else {
      // Define a word per binding that pushes the exported value
      for (const { name, alias } of node.bindings) {
        if (!(name in mod)) {
          throw new TakError(`Module "${node.url}" has no export "${name}"`, 'use', [...this._stack]);
        }
        const val: TakJS = { kind: 'js', value: mod[name] };
        this.defineWord(alias, i => i.push(val));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Call a quotation (used by stdlib combinators)
  // -------------------------------------------------------------------------

  async callQuot(quot: TakQuot): Promise<void> {
    for (const node of quot.body) {
      await this.eval(node);
    }
  }
}
