#!/usr/bin/env node
'use strict';
/**
 * scripts/build-docs.js
 * Reads README.md → writes docs/index.html.
 * No external dependencies.
 */
const { readFileSync, writeFileSync, copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const src  = readFileSync(join(root, 'README.md'), 'utf8');

// ── Helpers ────────────────────────────────────────────────────────────────

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(raw) {
  // Protect escaped pipes used in markdown table cells (str\|arr)
  let s = raw.replace(/\\\|/g, '\x00');
  s = escape(s);
  s = s.replace(/\x00/g, '|');
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function slug(text) {
  return text.toLowerCase().replace(/[()\/`*]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Block parser ───────────────────────────────────────────────────────────

function parseBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'tak';
      i++;
      const code = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing ```
      blocks.push({ type: 'code', lang, text: code.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Headings
    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) {
      blocks.push({ type: 'heading', level: hm[1].length, text: hm[2] });
      i++;
      continue;
    }

    // Table
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        rows.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'table', rows });
      continue;
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(lines[i].replace(/^[-*] /, ''));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // Blank
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('|') &&
      !lines[i].startsWith('```') &&
      !/^-{3,}$/.test(lines[i].trim()) &&
      !/^[-*] /.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) blocks.push({ type: 'para', text: para.join(' ') });
  }

  return blocks;
}

// ── Renderers ──────────────────────────────────────────────────────────────

function renderTable(rows) {
  const data = rows.filter(r => !/^\|[\s|:-]+\|$/.test(r));
  const cells = data.map(r => r.split('|').slice(1, -1).map(c => c.trim()));
  if (!cells.length) return '';
  const [head, ...body] = cells;
  return [
    '<table>',
    '<thead><tr>', head.map(c => `<th>${inline(c)}</th>`).join(''), '</tr></thead>',
    '<tbody>',
    ...body.map(row => '<tr>' + row.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'),
    '</tbody></table>',
  ].join('');
}

function renderBlocks(blocks) {
  return blocks.map(b => {
    switch (b.type) {
      case 'heading': {
        const id = slug(b.text);
        const tag = `h${b.level}`;
        return `<${tag} id="${id}"><a href="#${id}">${inline(b.text)}</a></${tag}>`;
      }
      case 'code':
        return `<pre><code class="lang-${b.lang}">${escape(b.text)}</code></pre>`;
      case 'table':
        return renderTable(b.rows);
      case 'list':
        return '<ul>' + b.items.map(it => `<li>${inline(it)}</li>`).join('') + '</ul>';
      case 'para':
        return `<p>${inline(b.text)}</p>`;
      case 'hr':
        return ''; // visual separation handled by heading margins
      default:
        return '';
    }
  }).join('\n');
}

function buildNav(blocks) {
  const items = [];
  let h2Open = false;

  for (const b of blocks) {
    if (b.type !== 'heading' || b.level < 2 || b.level > 3) continue;
    if (b.level === 2) {
      if (h2Open) items.push('</ul></li>');
      items.push(`<li><a href="#${slug(b.text)}">${escape(b.text)}</a><ul>`);
      h2Open = true;
    } else if (b.level === 3) {
      items.push(`<li><a href="#${slug(b.text)}">${escape(b.text)}</a></li>`);
    }
  }
  if (h2Open) items.push('</ul></li>');
  return `<nav><ul>${items.join('')}</ul></nav>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root {
  --bg:       #faf8f3;
  --bg-side:  #f3efe6;
  --bg-code:  #edeae2;
  --fg:       #2a2218;
  --fg-muted: #7a6e60;
  --accent:   #8b3a12;
  --border:   #ddd8cc;
  --side-w:   230px;
  --max-w:    720px;
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: Georgia, "Times New Roman", Times, serif;
  font-size: 17px;
  line-height: 1.75;
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
#sidebar {
  width: var(--side-w);
  min-width: var(--side-w);
  background: var(--bg-side);
  border-right: 1px solid var(--border);
  padding: 2rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  flex-shrink: 0;
}

#sidebar .logo {
  display: block;
  padding: 0 1.4rem 1.2rem;
  font-family: Georgia, serif;
  font-size: 1.5rem;
  font-style: italic;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.2rem;
  text-decoration: none;
  letter-spacing: 0.02em;
}

nav ul { list-style: none; }

nav > ul > li > a {
  display: block;
  padding: 0.28rem 1.4rem;
  color: var(--fg);
  text-decoration: none;
  font-size: 0.88rem;
  font-family: Georgia, serif;
}

nav > ul > li > a:hover { color: var(--accent); }

nav > ul > li > ul { margin-bottom: 0.5rem; }

nav > ul > li > ul > li > a {
  display: block;
  padding: 0.15rem 1.4rem 0.15rem 2.2rem;
  color: var(--fg-muted);
  text-decoration: none;
  font-size: 0.82rem;
  font-family: "SFMono-Regular", Consolas, monospace;
}

nav > ul > li > ul > li > a:hover { color: var(--accent); }

/* ── Main ── */
main {
  flex: 1;
  padding: 3rem 3rem 5rem;
  max-width: calc(var(--max-w) + 6rem);
  min-width: 0;
}

/* ── Typography ── */
h1 {
  font-size: 2.6rem;
  font-weight: normal;
  font-style: italic;
  color: var(--fg);
  margin-bottom: 0.3rem;
  letter-spacing: -0.01em;
}
h1 a { color: inherit; text-decoration: none; }

h2 {
  font-size: 1.4rem;
  font-weight: normal;
  font-style: italic;
  color: var(--fg);
  margin: 3rem 0 0.9rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.01em;
}
h2 a { color: inherit; text-decoration: none; }

h3 {
  font-size: 0.92rem;
  font-weight: bold;
  font-style: normal;
  font-family: "SFMono-Regular", Consolas, monospace;
  color: var(--accent);
  margin: 2rem 0 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
h3 a { color: inherit; text-decoration: none; }

h4 {
  font-size: 0.95rem;
  font-style: italic;
  color: var(--fg-muted);
  margin: 1.2rem 0 0.4rem;
}

p { margin-bottom: 1rem; }

a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
a:hover { text-decoration: none; }

strong { font-weight: bold; }

/* ── Code ── */
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.82em;
  background: var(--bg-code);
  color: var(--accent);
  padding: 0.1em 0.35em;
  border-radius: 2px;
}

pre {
  background: var(--bg-code);
  border-left: 2px solid var(--accent);
  padding: 1.1rem 1.4rem;
  overflow-x: auto;
  margin: 0.9rem 0 1.4rem;
}

pre code {
  background: none;
  color: var(--fg);
  padding: 0;
  font-size: 0.86rem;
  border-radius: 0;
}

/* ── Tables ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6rem 0 1.4rem;
  font-size: 0.88rem;
  font-family: "SFMono-Regular", Consolas, monospace;
}

th {
  text-align: left;
  padding: 0.5rem 0.9rem;
  color: var(--fg-muted);
  font-family: Georgia, serif;
  font-style: italic;
  font-weight: normal;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--fg-muted);
}

td {
  padding: 0.4rem 0.9rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

tr:last-child td { border-bottom: none; }
td:first-child code { color: var(--accent); font-weight: bold; }

/* ── Lists ── */
ul {
  padding-left: 1.6rem;
  margin-bottom: 1rem;
}

ul li { margin-bottom: 0.3rem; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

/* ── Playground ── */
.playground-wrap { margin-top: 1rem; }

#tak-input {
  width: 100%;
  min-height: 170px;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.86rem;
  background: var(--bg-code);
  color: var(--fg);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  padding: 1rem 1.2rem;
  resize: vertical;
  outline: none;
  line-height: 1.6;
  display: block;
}

#tak-input:focus { border-color: var(--accent); }

.playground-controls {
  display: flex;
  gap: 0.6rem;
  margin: 0.6rem 0;
}

.playground-controls button {
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.82rem;
  padding: 0.35rem 0.9rem;
  background: var(--accent);
  color: var(--bg);
  border: none;
  cursor: pointer;
  border-radius: 2px;
}

.playground-controls button:hover { opacity: 0.85; }

#tak-clear {
  background: var(--bg-code) !important;
  color: var(--fg) !important;
  border: 1px solid var(--border) !important;
}

.playground-output {
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.84rem;
  background: var(--bg-code);
  border-left: 2px solid var(--border);
  padding: 1rem 1.2rem;
  white-space: pre-wrap;
  line-height: 1.6;
  display: none;
}

.playground-output.has-content { display: block; }
.out-line { color: var(--fg); }
.out-stack { color: var(--fg-muted); margin-top: 0.6rem; border-top: 1px solid var(--border); padding-top: 0.4rem; }
.out-error { color: #c0392b; }

/* ── Responsive ── */
@media (max-width: 640px) {
  body { flex-direction: column; }
  #sidebar { position: static; width: 100%; height: auto; min-width: 0; }
  main { padding: 1.5rem 1rem 3rem; }
}
`.trim();

// ── Assemble ───────────────────────────────────────────────────────────────

const blocks = parseBlocks(src);

// Pull title from first h1
const titleBlock = blocks.find(b => b.type === 'heading' && b.level === 1);
const title = titleBlock ? titleBlock.text : 'tak';

// Inject playground nav entry after Quick Start
const nav = buildNav(blocks).replace(
  '<li><a href="#full-documentation">',
  '<li><a href="#playground">Playground</a><ul></ul></li><li><a href="#full-documentation">'
);

// Inject playground section between Quick Start and Syntax
const PLAYGROUND_HTML = `<h2 id="playground"><a href="#playground">Playground</a></h2>
<p>Try tak right here. Press <strong>Ctrl+Enter</strong> (or click Run) to execute.</p>
<div class="playground-wrap">
  <textarea id="tak-input" spellcheck="false">// Basic arithmetic
3 4 + .

// Define a function
fn square ( n -- n ) { dup * }
5 square .

// Higher-order words
[ 1 2 3 4 5 ] [ dup * ] map .</textarea>
  <div class="playground-controls">
    <button id="tak-run">&#9654; Run</button>
    <button id="tak-clear">Clear output</button>
  </div>
  <div id="tak-output" class="playground-output" aria-live="polite"></div>
</div>`;

const PLAYGROUND_SCRIPT = `<script src="./tak.js"></script>
<script>
(function () {
  var input = document.getElementById('tak-input');
  var output = document.getElementById('tak-output');
  var runBtn = document.getElementById('tak-run');
  var clearBtn = document.getElementById('tak-clear');

  function clearOutput() {
    output.innerHTML = '';
    output.classList.remove('has-content');
  }

  async function runTak() {
    clearOutput();
    var source = input.value.trim();
    if (!source) return;

    var lines = [];
    var interp = new Tak.TakInterpreter({ debug: false });
    Tak.registerStdlib(interp);

    var origLog = console.log;
    console.log = function () {
      var text = Array.from(arguments).join(' ');
      origLog(text);
      lines.push({ type: 'out', text: text });
    };

    var finalStack = [];
    interp.on('scriptEnd', function (e) { finalStack = e.stack; });

    try {
      var tokens = Tak.tokenize(source);
      var program = Tak.parse(tokens);
      await interp.run(program);
    } catch (err) {
      lines.push({ type: 'error', text: err.message || String(err) });
    } finally {
      console.log = origLog;
    }

    var frag = document.createDocumentFragment();
    lines.forEach(function (item) {
      var div = document.createElement('div');
      div.className = item.type === 'error' ? 'out-error' : 'out-line';
      div.textContent = (item.type === 'error' ? '\\u26a0 ' : '') + item.text;
      frag.appendChild(div);
    });

    if (finalStack.length > 0) {
      var stackDiv = document.createElement('div');
      stackDiv.className = 'out-stack';
      stackDiv.textContent = 'stack: [ ' + finalStack.map(function (v) { return Tak.takFormat(v); }).join('  ') + ' ]';
      frag.appendChild(stackDiv);
    }

    if (lines.length > 0 || finalStack.length > 0) {
      output.appendChild(frag);
      output.classList.add('has-content');
    }
  }

  runBtn.addEventListener('click', runTak);
  clearBtn.addEventListener('click', clearOutput);
  input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runTak();
    }
  });
})();
</script>`;

const body = renderBlocks(blocks).replace(
  '\n<h2 id="full-documentation">',
  '\n' + PLAYGROUND_HTML + '\n\n<h2 id="full-documentation">'
);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)} — documentation</title>
  <style>${CSS}</style>
</head>
<body>
  <aside id="sidebar">
    <a class="logo" href="#">tak</a>
    ${nav}
  </aside>
  <main>
    ${body}
  </main>
</body>
${PLAYGROUND_SCRIPT}
</html>`;

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'index.html'), html);

copyFileSync(join(root, 'dist', 'tak.js'), join(root, 'docs', 'tak.js'));

console.log('docs/index.html written');
console.log('docs/tak.js copied from dist/');
