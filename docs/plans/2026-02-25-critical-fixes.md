# Critical Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three critical bugs (takFormat in REPL/harness, @js string-aware lexer, dom/on race condition) and change `await` to not auto-call `.json()`.

**Architecture:** All fixes are targeted edits to existing files — no new files except the two new stdlib words `response/json` and `response/text`. The `await` change is a breaking change for `fetch.html`, which is updated as part of that task.

**Tech Stack:** TypeScript (esbuild bundle), vanilla HTML/JS

---

## Shared context

After `npm run build`, the global `Tak` exposes all named exports from `src/browser-runtime.ts`. The build command is:
```bash
npm run build
# → dist/tak.js (IIFE, global name Tak)
```

Any new export added to `browser-runtime.ts` automatically becomes available as `Tak.<name>` in the browser after rebuild.

---

## Task 1: Export `takFormat` and fix `.` output in REPL and test harness

**Problem:** `index.html` and `test-harness/index.html` override `.` with `String(i.pop())`, which produces `[object Object]` for arrays, dicts, and quotations. The correct formatter is `takFormat` from `stdlib.ts`, but it isn't exported from the bundle.

**Files:**
- Modify: `src/browser-runtime.ts:65-70`
- Modify: `index.html:121,141`
- Modify: `test-harness/index.html:147`

**Step 1: Add `takFormat` to browser-runtime exports**

In `src/browser-runtime.ts`, the exports block currently reads (lines 65-70):
```ts
export { TakInterpreter } from './interpreter.js';
export { registerStdlib } from './stdlib.js';
export { registerDomStdlib } from './dom-stdlib.js';
export { attachDebugPanel } from './debug-panel.js';
export { tokenize } from './lexer.js';
export { parse } from './parser.js';
```

Change the `registerStdlib` line to also export `takFormat`:
```ts
export { TakInterpreter } from './interpreter.js';
export { registerStdlib, takFormat } from './stdlib.js';
export { registerDomStdlib } from './dom-stdlib.js';
export { attachDebugPanel } from './debug-panel.js';
export { tokenize } from './lexer.js';
export { parse } from './parser.js';
```

**Step 2: Rebuild**

```bash
npm run build
```

Expected: `dist/tak.js` rebuilt, no errors.

**Step 3: Update `index.html` — printFn and stack display**

In `index.html`:

Line 121 — change:
```js
        const printFn = i => { lines.push(String(i.pop())); };
```
to:
```js
        const printFn = i => { lines.push(Tak.takFormat(i.pop())); };
```

Line 141 — change:
```js
            stackLine.textContent = 'stack: [ ' + interp.stack.map(String).join(' ') + ' ]';
```
to:
```js
            stackLine.textContent = 'stack: [ ' + interp.stack.map(Tak.takFormat).join(' ') + ' ]';
```

**Step 4: Update `test-harness/index.html` — printFn**

Line 147 — change:
```js
        const printFn = i => { lines.push(String(i.pop())); };
```
to:
```js
        const printFn = i => { lines.push(Tak.takFormat(i.pop())); };
```

**Step 5: Manual smoke-test**

Open `http://localhost:3000/` (with `npm run serve` running).
- Type `[ 1 2 3 ] .` → output should be `[ 1 2 3 ]` (not `[object Object]`)
- Type `{ x: 1 y: 2 }` (no comma — commas are broken, see note) — or just `[ 1 2 ] .` to confirm array format

Open `http://localhost:3000/test-harness/` and click **Run all** — all 6 seed tests should pass.

**Step 6: Commit**

```bash
git add src/browser-runtime.ts index.html test-harness/index.html
git commit -m "fix: export takFormat; use it in REPL and test harness for correct output formatting"
```

---

## Task 2: Fix `@js(...)` string-aware paren matching in the lexer

**Problem:** The `@js(...)` scanner in `src/lexer.ts` counts raw `(` and `)` characters to find the closing delimiter. A `)` inside a string literal (e.g. `@js("hello)")`) closes the expression prematurely.

**Files:**
- Modify: `src/lexer.ts:132-137`

**Step 1: Replace the scan loop body**

Current code at lines 132-137:
```ts
      while (pos < source.length && depth > 0) {
        const c = advance();
        if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) break; }
        jsExpr += c;
      }
```

Replace with:
```ts
      let inStr = false;
      let strChar = '';
      while (pos < source.length && depth > 0) {
        const c = advance();
        if (inStr) {
          jsExpr += c;
          if (c === '\\' && pos < source.length) {
            jsExpr += advance(); // consume escaped char verbatim
          } else if (c === strChar) {
            inStr = false;
          }
        } else if (c === '"' || c === "'") {
          inStr = true;
          strChar = c;
          jsExpr += c;
        } else if (c === '(') {
          depth++;
          jsExpr += c;
        } else if (c === ')') {
          depth--;
          if (depth === 0) break; // closing ) not added to jsExpr
          jsExpr += c;
        } else {
          jsExpr += c;
        }
      }
```

**Key invariants preserved:**
- The closing `)` (the one that brings `depth` to 0) is consumed by `advance()` but NOT added to `jsExpr` — same as before.
- Parens inside `"..."` or `'...'` don't affect `depth`.
- `\"` and `\'` inside strings are consumed as two-char sequences so the closing quote char doesn't prematurely exit string mode.

**Step 2: Rebuild**

```bash
npm run build
```

Expected: no errors.

**Step 3: Manual smoke-test in the REPL**

Open `http://localhost:3000/`.

Test 1 — paren in string (was broken):
```
@js("hello)world") .
```
Expected output: `hello)world`

Test 2 — escaped quote (verify escape handling):
```
@js("say \"hi\"") .
```
Expected output: `say "hi"`

Test 3 — normal expression still works:
```
@js(1 + 2) .
```
Expected output: `3`

**Step 4: Commit**

```bash
git add src/lexer.ts
git commit -m "fix: make @js(...) lexer string-aware so ) inside string literals is not treated as closing delimiter"
```

---

## Task 3: Serialize `dom/on` async handlers with a per-listener queue

**Problem:** `dom/on` in `src/dom-stdlib.ts` registers an `async` event listener that shares the interpreter's stack. If the event fires while the previous handler is awaiting (e.g. mid-`fetch`), both closures interleave on the same stack, corrupting it.

**Fix:** Each `dom/on` call creates a local `queue` promise chain. Each new event invocation appends to the chain via `.then()`, so handlers run one at a time in arrival order.

**Files:**
- Modify: `src/dom-stdlib.ts:84-91`

**Step 1: Replace the event listener body**

Current code at lines 84-91:
```ts
    el.addEventListener(event, async (_ev) => {
      i.push(el as TakValue);
      try {
        await i.callQuot(quot);
      } catch (err) {
        console.error('[tak] dom/on handler error:', err);
      }
    });
```

Replace with:
```ts
    let queue: Promise<void> = Promise.resolve();
    el.addEventListener(event, (_ev) => {
      queue = queue.then(async () => {
        i.push(el as TakValue);
        try {
          await i.callQuot(quot);
        } catch (err) {
          console.error('[tak] dom/on handler error:', err);
        }
      });
    });
```

**How it works:** `queue` starts as a resolved promise. Each event appends a `.then()` that runs the handler body. Since `.then()` callbacks run sequentially, each handler waits for the previous to finish before starting. The `catch` inside `.then()` prevents a failed handler from breaking the chain for subsequent events (unhandled rejection propagation is blocked by the try/catch).

**Step 2: Rebuild**

```bash
npm run build
```

Expected: no errors.

**Step 3: Smoke-test**

Open `http://localhost:3000/examples/counter.html`.
- Rapidly click **+ Increment** several times — counter should increment by 1 for each click, no skipped or double-counted updates.
- Try the fetch example at `http://localhost:3000/examples/fetch.html` — clicking the button multiple times rapidly should queue fetches, not corrupt the stack. (Note: fetch.html is updated in Task 4 to use `response/json` — rebuild required for it to work.)

**Step 4: Commit**

```bash
git add src/dom-stdlib.ts
git commit -m "fix: serialize dom/on async handlers with a per-listener promise queue to prevent stack corruption"
```

---

## Task 4: Remove auto-json from `await`; add `response/json` and `response/text`

**Problem:** `await` in `stdlib.ts` automatically calls `.json()` on any `Response` object. This makes it impossible to fetch plain text, check status codes, or handle non-JSON APIs.

**Fix:** `await` resolves promises and pushes the raw result (including a raw `Response` object). Two new words handle response bodies: `response/json` and `response/text`.

**Files:**
- Modify: `src/stdlib.ts:494-507`
- Modify: `examples/fetch.html:62-65`

**Step 1: Rewrite `await` and add the two new words**

Current code at lines 494-507 in `src/stdlib.ts`:
```ts
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
```

Replace with:
```ts
  interp.defineWord('await', async i => {
    const val = i.pop();
    if (val instanceof Promise) {
      const resolved = await val;
      i.push(resolved as TakValue);
    } else {
      i.push(val);
    }
  });

  // response/json ( response -- dict )
  // Reads a Response body as JSON and pushes the result as a tak value.
  interp.defineWord('response/json', async i => {
    const val = i.pop();
    if (!(val instanceof Response)) throw new TakError('response/json: expected Response');
    const data = await val.json();
    i.push(jsToTak(data));
  });

  // response/text ( response -- str )
  // Reads a Response body as plain text and pushes the string.
  interp.defineWord('response/text', async i => {
    const val = i.pop();
    if (!(val instanceof Response)) throw new TakError('response/text: expected Response');
    const text = await val.text();
    i.push(text);
  });
```

**Step 2: Update `examples/fetch.html`**

The fetch example currently has (lines 62-65):
```tak
  "https://v2.jokeapi.dev/joke/Any?type=single" fetch await

  // The interpreter's await word handles Response → JSON automatically
  // result is a tak dict on the stack
```

Change to:
```tak
  "https://v2.jokeapi.dev/joke/Any?type=single" fetch await response/json
```

(Remove the now-wrong comment. The two lines become one.)

**Step 3: Rebuild**

```bash
npm run build
```

Expected: no errors.

**Step 4: Smoke-test**

Open `http://localhost:3000/examples/fetch.html`.
- Click **Fetch a joke** — should display a joke (not an error).
- Confirms `fetch await response/json` pipeline works end to end.

In the REPL, try:
```
"https://httpbin.org/get" fetch await response/json "url" get .
```
Expected: prints the URL echoed back by httpbin.

**Step 5: Commit**

```bash
git add src/stdlib.ts examples/fetch.html
git commit -m "fix: await no longer auto-calls .json(); add response/json and response/text words"
```

---

## Task 5: Rebuild and final verification

**Step 1: Full rebuild**

```bash
npm run build
```

**Step 2: Run test harness seed tests**

Open `http://localhost:3000/test-harness/` and click **Run all**.
Expected: all 6 seed tests pass (✓).

**Step 3: Add a new test for `takFormat` correctness**

In the test harness, add a custom test:
- Snippet: `[ 1 2 3 ] .`
- Expected: `[ 1 2 3 ]`

Click **Run all** — the new test should pass (confirms takFormat fix works end to end in the harness).

**Step 4: Commit if any last tweaks**

```bash
git add -p
git commit -m "chore: final build and verification"
```
