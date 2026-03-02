# REPL and Test Harness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `index.html` (REPL at `/`) and `test-harness/index.html` (interactive test runner at `/test-harness/`) to the tak project.

**Architecture:** Both pages are static HTML files that load `dist/tak.js` (the IIFE bundle exposing `window.Tak`) and instantiate `TakInterpreter` directly in script tags. The REPL overrides the `.` and `log` words to write to a DOM output element instead of `console.log`. The test harness does the same per-test to capture and compare output against an expected string.

**Tech Stack:** Vanilla HTML/CSS/JS, `window.Tak` global from `dist/tak.js`

---

## Shared context

After the IIFE build, the global `Tak` exposes:
- `Tak.TakInterpreter` — constructor, takes `{ debug?: boolean }`
- `Tak.registerStdlib(interp)` — registers all standard words including `.` and `log`
- `Tak.registerDomStdlib(interp)` — registers DOM words
- `Tak.tokenize(source)` → token array
- `Tak.parse(tokens)` → AST Program node

To run tak code programmatically and capture output:
```js
const lines = [];
const interp = new Tak.TakInterpreter();
Tak.registerStdlib(interp);
// Override print words to capture output
interp.defineWord('.', i => { lines.push(Tak.takFormat ? String(i.pop()) : String(i.pop())); });
// NOTE: takFormat is not directly exported; use String() or check exports
const tokens = Tak.tokenize(source);
const program = Tak.parse(tokens);
await interp.run(program);
```

> **Note on `takFormat`:** Check whether `Tak.takFormat` is available at runtime. If not, `.` should just call `String(i.pop())` as a fallback for the output panel. Look at `dist/tak.js` after build to confirm exported names, or just redefine `.` as `i => { output.push(String(i.pop())); }` — it works for numbers/strings/booleans which cover 99% of REPL use.

The aesthetic to match: dark background `#1a1a2e`, green text `#d4f4d4`, accent `#80ff80`, monospace font, border `1px solid #40a040`.

---

## Task 1: Create `index.html` — REPL

**Files:**
- Create: `index.html`

**What it does:**
- Nav bar at top with links to examples (counter, hello, fetch) and test-harness
- Full-width `<textarea>` for tak source input, pre-filled with `"Hello, tak!" .`
- **Run** button (and Ctrl+Enter shortcut)
- Output `<pre>` area showing lines printed by `.` / `log`, cleared on each run
- Final stack summary line in dim style, e.g. `stack: [ 42 "hello" ]`
- Error display in red if the run throws

**Step 1: Build `dist/tak.js` so it exists**

```bash
npm run build
```

Expected: `dist/tak.js` created (no errors).

**Step 2: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>tak repl</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      background: #1a1a2e;
      color: #d4f4d4;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    nav {
      padding: 0.5rem 1rem;
      background: rgba(40,80,40,0.4);
      border-bottom: 1px solid #40a040;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-shrink: 0;
    }
    nav .brand { color: #80ff80; font-weight: bold; font-size: 1.1rem; }
    nav a { color: #a0d4a0; text-decoration: none; font-size: 0.85rem; }
    nav a:hover { color: #80ff80; }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 1rem;
      gap: 0.75rem;
      overflow: hidden;
    }
    #editor {
      flex: 1;
      resize: none;
      background: rgba(255,255,255,0.04);
      color: #d4f4d4;
      border: 1px solid #40a040;
      border-radius: 4px;
      padding: 0.75rem;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      min-height: 160px;
    }
    #editor:focus { border-color: #80ff80; }
    .toolbar { display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0; }
    button#run-btn {
      background: #1a3a1a;
      color: #80ff80;
      border: 1px solid #40a040;
      border-radius: 4px;
      padding: 0.4rem 1.2rem;
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
    }
    button#run-btn:hover { background: #2a4a2a; }
    .hint { color: rgba(180,255,180,0.4); font-size: 0.78rem; }
    #output {
      flex: 1;
      background: rgba(0,0,0,0.3);
      border: 1px solid #2a4a2a;
      border-radius: 4px;
      padding: 0.75rem;
      overflow-y: auto;
      font-size: 0.9rem;
      white-space: pre-wrap;
      min-height: 80px;
    }
    .out-line { color: #d4f4d4; }
    .out-stack { color: rgba(180,255,180,0.45); font-size: 0.8rem; margin-top: 0.5rem; }
    .out-error { color: #ff8080; }
    .out-empty { color: rgba(180,255,180,0.3); font-style: italic; }
  </style>
</head>
<body>
  <nav>
    <span class="brand">tak</span>
    <a href="examples/counter.html">counter</a>
    <a href="examples/hello.html">hello</a>
    <a href="examples/fetch.html">fetch</a>
    <a href="test-harness/">test harness</a>
  </nav>
  <main>
    <textarea id="editor" spellcheck="false">"Hello, tak!" .</textarea>
    <div class="toolbar">
      <button id="run-btn">Run</button>
      <span class="hint">Ctrl+Enter</span>
    </div>
    <pre id="output"><span class="out-empty">output appears here</span></pre>
  </main>

  <script src="dist/tak.js"></script>
  <script>
    const editor = document.getElementById('editor');
    const output = document.getElementById('output');
    const runBtn = document.getElementById('run-btn');

    async function run() {
      const source = editor.value;
      output.innerHTML = '';

      const lines = [];
      let errorMsg = null;

      try {
        const interp = new Tak.TakInterpreter();
        Tak.registerStdlib(interp);
        Tak.registerDomStdlib(interp);

        // Redirect print output to the panel
        const printFn = i => { lines.push(String(i.pop())); };
        interp.defineWord('.', printFn);
        interp.defineWord('log', printFn);

        const tokens = Tak.tokenize(source);
        const program = Tak.parse(tokens);
        await interp.run(program);

        // Render output lines
        if (lines.length === 0 && interp.stack.length === 0) {
          output.innerHTML = '<span class="out-empty">no output</span>';
        } else {
          for (const l of lines) {
            const div = document.createElement('div');
            div.className = 'out-line';
            div.textContent = l;
            output.appendChild(div);
          }
          if (interp.stack.length > 0) {
            const stackLine = document.createElement('div');
            stackLine.className = 'out-stack';
            stackLine.textContent = 'stack: [ ' + interp.stack.map(String).join(' ') + ' ]';
            output.appendChild(stackLine);
          }
        }
      } catch (err) {
        const div = document.createElement('div');
        div.className = 'out-error';
        div.textContent = err instanceof Error ? err.message : String(err);
        output.appendChild(div);
      }
    }

    runBtn.addEventListener('click', run);
    editor.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); run(); }
    });
  </script>
</body>
</html>
```

**Step 3: Open in browser and verify**

With `npm run serve` running, open `http://localhost:3000/`.
- Default snippet `"Hello, tak!" .` should print `Hello, tak!` in the output panel.
- Try `1 2 + .` — should print `3`.
- Try `1 2 +` (no `.`) — output should show `stack: [ 3 ]`.
- Try `unknown-word` — should show a red error message.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add REPL at / with example nav links"
```

---

## Task 2: Create `test-harness/index.html` — Interactive test runner

**Files:**
- Create: `test-harness/index.html`

**What it does:**
- Same nav bar as REPL (link back to `/`)
- **Add test** form: tak snippet textarea + expected output string input + **Add** button
- Pre-seeded with ~6 basic test cases (see below)
- **Run all** button: runs each test case, compares captured `.` output (joined with `\n`) to expected string
- Per-test result: ✓ green / ✗ red with actual vs expected shown on failure
- **Clear all** button to reset tests

**Pre-seeded test cases** (snippet → expected):
| Snippet | Expected |
|---------|----------|
| `1 2 + .` | `3` |
| `"hello" " " "world" concat concat .` | `hello world` |
| `true false or .` | `true` |
| `5 dup * .` | `25` |
| `[ 1 2 3 ] 0 [ + ] reduce .` | `6` |
| `3 [ dup . ] times` | `3\n3\n3` (three lines) |

> **Note on expected format:** Expected is the full captured output joined with newlines. For `3 [ dup . ] times`, expected is `"3\n3\n3"` — use a textarea for the expected field so multi-line is easy.

**Step 1: Create the `test-harness/` directory and write `test-harness/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>tak — test harness</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      background: #1a1a2e;
      color: #d4f4d4;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    nav {
      padding: 0.5rem 1rem;
      background: rgba(40,80,40,0.4);
      border-bottom: 1px solid #40a040;
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-shrink: 0;
    }
    nav .brand { color: #80ff80; font-weight: bold; font-size: 1.1rem; }
    nav a { color: #a0d4a0; text-decoration: none; font-size: 0.85rem; }
    nav a:hover { color: #80ff80; }
    main { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
    h2 { color: #80ff80; margin: 0; font-size: 1rem; letter-spacing: 0.05em; }
    .add-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      background: rgba(255,255,255,0.03);
      border: 1px solid #2a4a2a;
      border-radius: 4px;
      padding: 0.75rem;
    }
    .add-form label { color: rgba(180,255,180,0.6); font-size: 0.78rem; margin-bottom: 2px; display: block; }
    .add-form textarea, .add-form input {
      width: 100%;
      background: rgba(255,255,255,0.04);
      color: #d4f4d4;
      border: 1px solid #40a040;
      border-radius: 3px;
      padding: 0.4rem;
      font-family: inherit;
      font-size: 0.85rem;
      outline: none;
      resize: vertical;
    }
    .add-form textarea:focus, .add-form input:focus { border-color: #80ff80; }
    .add-form-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 0.5rem;
    }
    .toolbar { display: flex; gap: 0.5rem; }
    button {
      background: #1a3a1a;
      color: #80ff80;
      border: 1px solid #40a040;
      border-radius: 4px;
      padding: 0.35rem 1rem;
      font-family: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
    button:hover { background: #2a4a2a; }
    button.danger { border-color: #804040; color: #ff8080; }
    button.danger:hover { background: #3a1a1a; }
    #summary { font-size: 0.85rem; color: rgba(180,255,180,0.5); }
    #results { display: flex; flex-direction: column; gap: 0.5rem; }
    .test-card {
      border: 1px solid #2a4a2a;
      border-radius: 4px;
      padding: 0.6rem 0.75rem;
      display: grid;
      grid-template-columns: 1.5rem 1fr auto;
      gap: 0.5rem;
      align-items: start;
    }
    .test-card.pass { border-color: #3a6a3a; }
    .test-card.fail { border-color: #6a3a3a; }
    .test-card.pending { border-color: #2a4a2a; }
    .status { font-size: 1.1rem; line-height: 1.4; }
    .status.pass { color: #60d060; }
    .status.fail { color: #ff6060; }
    .status.pending { color: rgba(180,255,180,0.3); }
    .test-body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
    .test-snippet { color: #a0d4a0; font-size: 0.82rem; white-space: pre-wrap; word-break: break-all; }
    .test-expected { color: rgba(180,255,180,0.5); font-size: 0.78rem; }
    .test-actual { color: #ff9090; font-size: 0.78rem; }
    .test-remove { background: none; border: none; color: rgba(180,100,100,0.4); cursor: pointer; padding: 0; font-size: 0.9rem; line-height: 1; }
    .test-remove:hover { color: #ff6060; background: none; }
  </style>
</head>
<body>
  <nav>
    <span class="brand">tak</span>
    <a href="../">repl</a>
    <a href="../examples/counter.html">counter</a>
    <a href="../examples/hello.html">hello</a>
    <a href="../examples/fetch.html">fetch</a>
  </nav>
  <main>
    <h2>test harness</h2>

    <!-- Add test form -->
    <div class="add-form">
      <div>
        <label>tak snippet</label>
        <textarea id="new-snippet" rows="3" placeholder="1 2 + ."></textarea>
      </div>
      <div>
        <label>expected output</label>
        <textarea id="new-expected" rows="3" placeholder="3"></textarea>
      </div>
      <div class="add-form-actions">
        <button id="add-btn">Add test</button>
      </div>
    </div>

    <!-- Controls -->
    <div class="toolbar">
      <button id="run-all-btn">Run all</button>
      <button id="clear-btn" class="danger">Clear all</button>
      <span id="summary"></span>
    </div>

    <!-- Test results -->
    <div id="results"></div>
  </main>

  <script src="../dist/tak.js"></script>
  <script>
    // --- Test state ---
    let tests = [];

    const SEED_TESTS = [
      { snippet: '1 2 + .', expected: '3' },
      { snippet: '"hello" " " concat "world" concat .', expected: 'hello world' },
      { snippet: 'true false or .', expected: 'true' },
      { snippet: '5 dup * .', expected: '25' },
      { snippet: '[ 1 2 3 ] 0 [ + ] reduce .', expected: '6' },
      { snippet: '3 [ dup . ] times', expected: '3\n3\n3' },
    ];

    // --- Run a single tak snippet, return { output, error } ---
    async function runSnippet(source) {
      const lines = [];
      try {
        const interp = new Tak.TakInterpreter();
        Tak.registerStdlib(interp);
        const printFn = i => { lines.push(String(i.pop())); };
        interp.defineWord('.', printFn);
        interp.defineWord('log', printFn);
        const tokens = Tak.tokenize(source);
        const program = Tak.parse(tokens);
        await interp.run(program);
        return { output: lines.join('\n'), error: null };
      } catch (err) {
        return { output: lines.join('\n'), error: err instanceof Error ? err.message : String(err) };
      }
    }

    // --- Render ---
    function render() {
      const container = document.getElementById('results');
      container.innerHTML = '';
      for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        const card = document.createElement('div');
        card.className = 'test-card ' + (t.status ?? 'pending');

        const statusSym = t.status === 'pass' ? '✓' : t.status === 'fail' ? '✗' : '·';
        const failDetail = t.status === 'fail'
          ? `<div class="test-actual">actual:   ${escHtml(t.actual ?? '')}</div>`
          : '';

        card.innerHTML = `
          <span class="status ${t.status ?? 'pending'}">${statusSym}</span>
          <div class="test-body">
            <div class="test-snippet">${escHtml(t.snippet)}</div>
            <div class="test-expected">expected: ${escHtml(t.expected)}</div>
            ${failDetail}
          </div>
          <button class="test-remove" data-idx="${i}" title="Remove">✕</button>
        `;
        container.appendChild(card);
      }

      // Summary
      const ran = tests.filter(t => t.status);
      const passed = tests.filter(t => t.status === 'pass').length;
      const failed = tests.filter(t => t.status === 'fail').length;
      document.getElementById('summary').textContent =
        ran.length ? `${passed} passed, ${failed} failed` : '';
    }

    function escHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // --- Wire up buttons ---
    document.getElementById('add-btn').addEventListener('click', () => {
      const snippet = document.getElementById('new-snippet').value.trim();
      const expected = document.getElementById('new-expected').value;
      if (!snippet) return;
      tests.push({ snippet, expected, status: null, actual: null });
      document.getElementById('new-snippet').value = '';
      document.getElementById('new-expected').value = '';
      render();
    });

    document.getElementById('run-all-btn').addEventListener('click', async () => {
      for (const t of tests) {
        const { output, error } = await runSnippet(t.snippet);
        if (error) {
          t.status = 'fail';
          t.actual = 'ERROR: ' + error;
        } else {
          t.actual = output;
          t.status = output === t.expected ? 'pass' : 'fail';
        }
      }
      render();
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      tests = SEED_TESTS.map(t => ({ ...t, status: null, actual: null }));
      render();
    });

    document.getElementById('results').addEventListener('click', e => {
      const btn = e.target.closest('[data-idx]');
      if (!btn) return;
      tests.splice(Number(btn.dataset.idx), 1);
      render();
    });

    // --- Seed and initial render ---
    tests = SEED_TESTS.map(t => ({ ...t, status: null, actual: null }));
    render();
  </script>
</body>
</html>
```

**Step 2: Open in browser and verify**

With `npm run serve` running, open `http://localhost:3000/test-harness/`.
- Pre-seeded tests should all be visible in "pending" (·) state.
- Click **Run all** — all 6 should turn ✓ green.
- Add a custom test: snippet `999 .`, expected `999` → Add, Run all → should pass.
- Add a failing test: snippet `1 2 + .`, expected `999` → should show ✗ with `actual: 3`.
- Click **Clear all** → resets to the 6 seed tests.
- Remove a test with ✕ → it disappears.
- Nav links should work: "repl" links back to `../` (root REPL).

**Step 3: Commit**

```bash
git add test-harness/index.html
git commit -m "feat: add interactive test harness at /test-harness/"
```

---

## Task 3: Final smoke-test and nav verification

**Step 1: Check all cross-links work**

- `http://localhost:3000/` — REPL loads, nav shows counter/hello/fetch/test harness links
- `http://localhost:3000/test-harness/` — harness loads, nav shows repl/counter/hello/fetch links
- `http://localhost:3000/examples/counter.html` — counter still works (links unchanged)
- `http://localhost:3000/examples/hello.html` — hello still works
- `http://localhost:3000/examples/fetch.html` — fetch still works

**Step 2: Verify the lexer fix is in dist**

In the REPL, run:
```
10 3 - .
```
Expected output: `7` (not a lex error).

**Step 3: Commit if any tweaks were needed**

```bash
git add -p
git commit -m "fix: nav link corrections and smoke-test tweaks"
```
