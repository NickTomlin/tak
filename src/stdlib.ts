// tak standard library — registerStdlib(interp)

import { TakInterpreter, TakValue, TakArray, TakDict, TakQuot, TakError } from './interpreter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertNumber(v: TakValue, word: string): number {
  if (typeof v !== 'number') throw new TakError(`${word}: expected number, got ${takType(v)}`);
  return v;
}

function assertString(v: TakValue, word: string): string {
  if (typeof v !== 'string') throw new TakError(`${word}: expected string, got ${takType(v)}`);
  return v;
}

function assertArray(v: TakValue, word: string): TakArray {
  if (!isTakArray(v)) throw new TakError(`${word}: expected array, got ${takType(v)}`);
  return v;
}

function assertQuot(v: TakValue, word: string): TakQuot {
  if (!isTakQuot(v)) throw new TakError(`${word}: expected quotation, got ${takType(v)}`);
  return v;
}

function assertDict(v: TakValue, word: string): TakDict {
  if (!isTakDict(v)) throw new TakError(`${word}: expected dict, got ${takType(v)}`);
  return v;
}

function isTakArray(v: TakValue): v is TakArray {
  return typeof v === 'object' && v !== null && !isElement(v) && (v as TakArray).kind === 'array';
}

function isTakDict(v: TakValue): v is TakDict {
  return typeof v === 'object' && v !== null && !isElement(v) && (v as TakDict).kind === 'dict';
}

function isTakQuot(v: TakValue): v is TakQuot {
  return typeof v === 'object' && v !== null && !isElement(v) && (v as TakQuot).kind === 'quot';
}

function isElement(v: TakValue): v is Element {
  return typeof v === 'object' && v !== null && v instanceof Element;
}

export function takType(v: TakValue): string {
  if (v === null) return 'null';
  if (typeof v === 'number') return 'number';
  if (typeof v === 'string') return 'string';
  if (typeof v === 'boolean') return 'bool';
  if (isTakArray(v)) return 'array';
  if (isTakDict(v)) return 'dict';
  if (isTakQuot(v)) return 'quot';
  if (isElement(v)) return 'element';
  return 'unknown';
}

function takEquals(a: TakValue, b: TakValue): boolean {
  if (a === b) return true;
  if (isTakArray(a) && isTakArray(b)) {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((item, i) => takEquals(item, b.items[i]));
  }
  return false;
}

// ---------------------------------------------------------------------------
// registerStdlib
// ---------------------------------------------------------------------------

export function registerStdlib(interp: TakInterpreter): void {

  // -------------------------------------------------------------------------
  // Stack ops
  // -------------------------------------------------------------------------

  interp.defineWord('dup', i => {
    const a = i.peek();
    i.push(a);
  });

  interp.defineWord('drop', i => {
    i.pop();
  });

  interp.defineWord('swap', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(b);
    i.push(a);
  });

  interp.defineWord('over', i => {
    const a = i.peek(1);
    i.push(a);
  });

  interp.defineWord('rot', i => {
    const c = i.pop();
    const b = i.pop();
    const a = i.pop();
    i.push(b);
    i.push(c);
    i.push(a);
  });

  interp.defineWord('nip', i => {
    const b = i.pop();
    i.pop();
    i.push(b);
  });

  interp.defineWord('tuck', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(b);
    i.push(a);
    i.push(b);
  });

  // -------------------------------------------------------------------------
  // Arithmetic
  // -------------------------------------------------------------------------

  interp.defineWord('+', i => {
    const b = assertNumber(i.pop(), '+');
    const a = assertNumber(i.pop(), '+');
    i.push(a + b);
  });

  interp.defineWord('-', i => {
    const b = assertNumber(i.pop(), '-');
    const a = assertNumber(i.pop(), '-');
    i.push(a - b);
  });

  interp.defineWord('*', i => {
    const b = assertNumber(i.pop(), '*');
    const a = assertNumber(i.pop(), '*');
    i.push(a * b);
  });

  interp.defineWord('/', i => {
    const b = assertNumber(i.pop(), '/');
    const a = assertNumber(i.pop(), '/');
    if (b === 0) throw new TakError('/: division by zero');
    i.push(a / b);
  });

  interp.defineWord('%', i => {
    const b = assertNumber(i.pop(), '%');
    const a = assertNumber(i.pop(), '%');
    i.push(a % b);
  });

  interp.defineWord('**', i => {
    const b = assertNumber(i.pop(), '**');
    const a = assertNumber(i.pop(), '**');
    i.push(Math.pow(a, b));
  });

  interp.defineWord('neg', i => {
    const a = assertNumber(i.pop(), 'neg');
    i.push(-a);
  });

  // -------------------------------------------------------------------------
  // Comparison
  // -------------------------------------------------------------------------

  interp.defineWord('=', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(takEquals(a, b));
  });

  interp.defineWord('!=', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(!takEquals(a, b));
  });

  interp.defineWord('<', i => {
    const b = assertNumber(i.pop(), '<');
    const a = assertNumber(i.pop(), '<');
    i.push(a < b);
  });

  interp.defineWord('>', i => {
    const b = assertNumber(i.pop(), '>');
    const a = assertNumber(i.pop(), '>');
    i.push(a > b);
  });

  interp.defineWord('<=', i => {
    const b = assertNumber(i.pop(), '<=');
    const a = assertNumber(i.pop(), '<=');
    i.push(a <= b);
  });

  interp.defineWord('>=', i => {
    const b = assertNumber(i.pop(), '>=');
    const a = assertNumber(i.pop(), '>=');
    i.push(a >= b);
  });

  // -------------------------------------------------------------------------
  // Logic
  // -------------------------------------------------------------------------

  interp.defineWord('and', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(Boolean(a) && Boolean(b));
  });

  interp.defineWord('or', i => {
    const b = i.pop();
    const a = i.pop();
    i.push(Boolean(a) || Boolean(b));
  });

  interp.defineWord('not', i => {
    const a = i.pop();
    i.push(!a);
  });

  // -------------------------------------------------------------------------
  // String
  // -------------------------------------------------------------------------

  interp.defineWord('concat', i => {
    const b = assertString(i.pop(), 'concat');
    const a = assertString(i.pop(), 'concat');
    i.push(a + b);
  });

  interp.defineWord('length', i => {
    const a = i.pop();
    if (typeof a === 'string') { i.push(a.length); return; }
    if (isTakArray(a)) { i.push(a.items.length); return; }
    throw new TakError(`length: expected string or array, got ${takType(a)}`);
  });

  interp.defineWord('substr', i => {
    const end = assertNumber(i.pop(), 'substr');
    const start = assertNumber(i.pop(), 'substr');
    const s = assertString(i.pop(), 'substr');
    i.push(s.substring(start, end));
  });

  interp.defineWord('split', i => {
    const sep = assertString(i.pop(), 'split');
    const s = assertString(i.pop(), 'split');
    const parts = s.split(sep).map(p => p as TakValue);
    i.push({ kind: 'array', items: parts });
  });

  // -------------------------------------------------------------------------
  // Array / Quotation
  // -------------------------------------------------------------------------

  interp.defineWord('push', i => {
    const val = i.pop();
    const arr = assertArray(i.pop(), 'push');
    // Return a new array (immutable style) — or mutate? Let's mutate for simplicity.
    arr.items.push(val);
    i.push(arr);
  });

  interp.defineWord('pop', async i => {
    const arr = assertArray(i.pop(), 'pop');
    if (arr.items.length === 0) throw new TakError('pop: array is empty');
    const val = arr.items.pop()!;
    i.push(arr);
    i.push(val);
  });

  interp.defineWord('nth', i => {
    const n = assertNumber(i.pop(), 'nth');
    const arr = assertArray(i.pop(), 'nth');
    const idx = n < 0 ? arr.items.length + n : n;
    if (idx < 0 || idx >= arr.items.length) throw new TakError(`nth: index ${n} out of bounds`);
    i.push(arr.items[idx]);
  });

  interp.defineWord('map', async i => {
    const quot = assertQuot(i.pop(), 'map');
    const arr = assertArray(i.pop(), 'map');
    const results: TakValue[] = [];
    for (const item of arr.items) {
      i.push(item);
      await i.callQuot(quot);
      results.push(i.pop());
    }
    i.push({ kind: 'array', items: results });
  });

  interp.defineWord('filter', async i => {
    const quot = assertQuot(i.pop(), 'filter');
    const arr = assertArray(i.pop(), 'filter');
    const results: TakValue[] = [];
    for (const item of arr.items) {
      i.push(item);
      await i.callQuot(quot);
      const keep = i.pop();
      if (keep) results.push(item);
    }
    i.push({ kind: 'array', items: results });
  });

  interp.defineWord('reduce', async i => {
    const quot = assertQuot(i.pop(), 'reduce');
    const init = i.pop();
    const arr = assertArray(i.pop(), 'reduce');
    i.push(init);
    for (const item of arr.items) {
      i.push(item);
      await i.callQuot(quot);
    }
    // result stays on stack
  });

  interp.defineWord('each', async i => {
    const quot = assertQuot(i.pop(), 'each');
    const arr = assertArray(i.pop(), 'each');
    for (const item of arr.items) {
      i.push(item);
      await i.callQuot(quot);
    }
  });

  interp.defineWord('call', async i => {
    const quot = assertQuot(i.pop(), 'call');
    await i.callQuot(quot);
  });

  // -------------------------------------------------------------------------
  // Dict
  // -------------------------------------------------------------------------

  interp.defineWord('get', i => {
    const key = assertString(i.pop(), 'get');
    const dict = assertDict(i.pop(), 'get');
    i.push(dict.map.has(key) ? dict.map.get(key)! : null);
  });

  interp.defineWord('set', i => {
    const val = i.pop();
    const key = assertString(i.pop(), 'set');
    const dict = assertDict(i.pop(), 'set');
    dict.map.set(key, val);
    i.push(dict);
  });

  interp.defineWord('has', i => {
    const key = assertString(i.pop(), 'has');
    const dict = assertDict(i.pop(), 'has');
    i.push(dict.map.has(key));
  });

  interp.defineWord('keys', i => {
    const dict = assertDict(i.pop(), 'keys');
    i.push({ kind: 'array', items: [...dict.map.keys()] });
  });

  // -------------------------------------------------------------------------
  // Control combinators
  // -------------------------------------------------------------------------

  interp.defineWord('if', async i => {
    const falseQuot = assertQuot(i.pop(), 'if');
    const trueQuot = assertQuot(i.pop(), 'if');
    const cond = i.pop();
    if (cond) {
      await i.callQuot(trueQuot);
    } else {
      await i.callQuot(falseQuot);
    }
  });

  interp.defineWord('when', async i => {
    const quot = assertQuot(i.pop(), 'when');
    const cond = i.pop();
    if (cond) await i.callQuot(quot);
  });

  interp.defineWord('unless', async i => {
    const quot = assertQuot(i.pop(), 'unless');
    const cond = i.pop();
    if (!cond) await i.callQuot(quot);
  });

  interp.defineWord('while', async i => {
    const bodyQuot = assertQuot(i.pop(), 'while');
    const condQuot = assertQuot(i.pop(), 'while');
    while (true) {
      await i.callQuot(condQuot);
      const cond = i.pop();
      if (!cond) break;
      await i.callQuot(bodyQuot);
    }
  });

  interp.defineWord('times', async i => {
    const quot = assertQuot(i.pop(), 'times');
    const n = assertNumber(i.pop(), 'times');
    for (let j = 0; j < n; j++) {
      await i.callQuot(quot);
    }
  });

  // -------------------------------------------------------------------------
  // I/O
  // -------------------------------------------------------------------------

  const printWord = (i: TakInterpreter) => {
    const val = i.pop();
    console.log(takFormat(val));
  };

  interp.defineWord('.', printWord);
  interp.defineWord('log', printWord);

  // str: convert top of stack to its string representation
  interp.defineWord('str', i => {
    const val = i.pop();
    i.push(takFormat(val));
  });

  // -------------------------------------------------------------------------
  // Type
  // -------------------------------------------------------------------------

  interp.defineWord('type', i => {
    const a = i.pop();
    i.push(takType(a));
  });

  interp.defineWord('number?', i => {
    i.push(typeof i.pop() === 'number');
  });

  interp.defineWord('string?', i => {
    i.push(typeof i.pop() === 'string');
  });

  interp.defineWord('bool?', i => {
    i.push(typeof i.pop() === 'boolean');
  });

  interp.defineWord('array?', i => {
    i.push(isTakArray(i.pop()));
  });

  interp.defineWord('dict?', i => {
    i.push(isTakDict(i.pop()));
  });

  interp.defineWord('null?', i => {
    i.push(i.pop() === null);
  });

  interp.defineWord('quot?', i => {
    i.push(isTakQuot(i.pop()));
  });

  // -------------------------------------------------------------------------
  // Async / Fetch
  // -------------------------------------------------------------------------

  interp.defineWord('fetch', async i => {
    const url = assertString(i.pop(), 'fetch');
    const promise = fetch(url);
    i.push(promise as unknown as TakValue);
  });

  interp.defineWord('fetch-post', async i => {
    const body = i.pop();
    const url = assertString(i.pop(), 'fetch-post');
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(takToJs(body));
    const promise = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    });
    i.push(promise as unknown as TakValue);
  });

  interp.defineWord('await', async i => {
    const val = i.pop();
    let resolved: unknown = val;
    if (val instanceof Promise) {
      resolved = await val;
    }
    // If it's a Response, resolve to json
    if (resolved instanceof Response) {
      resolved = await resolved.json();
      i.push(jsToTak(resolved));
    } else {
      i.push(jsToTak(resolved));
    }
  });

  interp.defineWord('json/parse', i => {
    const s = assertString(i.pop(), 'json/parse');
    try {
      i.push(jsToTak(JSON.parse(s)));
    } catch (e) {
      throw new TakError(`json/parse: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  interp.defineWord('json/str', i => {
    const val = i.pop();
    i.push(JSON.stringify(takToJs(val)));
  });

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------

  interp.defineWord('trace', i => {
    const val = i.peek();
    console.log('[trace]', takFormat(val));
    // value stays on stack
  });

  interp.defineWord('debug', i => {
    i.emit('debug', { stack: i.stack });
    console.log('[debug] stack:', i.stack.map(takFormat));
  });
}

// ---------------------------------------------------------------------------
// Formatting / conversion helpers
// ---------------------------------------------------------------------------

export function takFormat(v: TakValue): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (isTakArray(v)) return `[ ${v.items.map(takFormat).join(' ')} ]`;
  if (isTakDict(v)) {
    const pairs = [...v.map.entries()].map(([k, val]) => `${k}: ${takFormat(val)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  if (isTakQuot(v)) return `[ <quot> ]`;
  if (v instanceof Element) return `<${v.tagName.toLowerCase()}>`;
  return String(v);
}

/** Convert a tak value to a plain JS value (for JSON serialization) */
export function takToJs(v: TakValue): unknown {
  if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (isTakArray(v)) return v.items.map(takToJs);
  if (isTakDict(v)) {
    const obj: Record<string, unknown> = {};
    for (const [k, val] of v.map) obj[k] = takToJs(val);
    return obj;
  }
  return null;
}

/** Convert a plain JS value to a tak value */
export function jsToTak(v: unknown): TakValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return { kind: 'array', items: v.map(jsToTak) };
  if (typeof v === 'object') {
    const map = new Map<string, TakValue>();
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      map.set(k, jsToTak(val));
    }
    return { kind: 'dict', map };
  }
  return null;
}
