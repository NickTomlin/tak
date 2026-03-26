#!/usr/bin/env node
'use strict';
/**
 * scripts/build-docs.js
 * Reads README.md → writes docs/index.html.
 * No external dependencies.
 */
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
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
  --bg:       #0f1117;
  --bg-side:  #141820;
  --bg-code:  #0a0d12;
  --fg:       #c8dfc8;
  --fg-muted: #6a8c6a;
  --accent:   #7ae07a;
  --accent2:  #3a8a3a;
  --border:   #1e2e1e;
  --side-w:   220px;
  --max-w:    860px;
}

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.7;
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
#sidebar {
  width: var(--side-w);
  min-width: var(--side-w);
  background: var(--bg-side);
  border-right: 1px solid var(--border);
  padding: 1.5rem 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  flex-shrink: 0;
}

#sidebar .logo {
  display: block;
  padding: 0 1.2rem 1.2rem;
  font-family: monospace;
  font-size: 1.3rem;
  font-weight: bold;
  color: var(--accent);
  border-bottom: 1px solid var(--border);
  margin-bottom: 1rem;
  text-decoration: none;
}

nav ul { list-style: none; }

nav > ul > li > a {
  display: block;
  padding: 0.3rem 1.2rem;
  color: var(--fg);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.03em;
}

nav > ul > li > a:hover { color: var(--accent); }

nav > ul > li > ul { margin-bottom: 0.4rem; }

nav > ul > li > ul > li > a {
  display: block;
  padding: 0.18rem 1.2rem 0.18rem 2rem;
  color: var(--fg-muted);
  text-decoration: none;
  font-size: 0.82rem;
}

nav > ul > li > ul > li > a:hover { color: var(--accent); }

/* ── Main ── */
main {
  flex: 1;
  padding: 2.5rem 2rem 4rem;
  max-width: calc(var(--max-w) + 4rem);
  min-width: 0;
}

/* ── Typography ── */
h1 { font-size: 2rem; color: var(--accent); margin-bottom: 0.4rem; }
h1 a { color: inherit; text-decoration: none; }

h2 {
  font-size: 1.3rem;
  color: var(--accent);
  margin: 2.5rem 0 0.8rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}
h2 a { color: inherit; text-decoration: none; }

h3 {
  font-size: 1rem;
  color: var(--accent);
  margin: 1.6rem 0 0.5rem;
  font-family: monospace;
}
h3 a { color: inherit; text-decoration: none; }

h4 { font-size: 0.9rem; color: var(--fg-muted); margin: 1rem 0 0.4rem; }

p { margin-bottom: 0.9rem; }

a { color: var(--accent2); }
a:hover { color: var(--accent); }

strong { color: var(--fg); }

/* ── Code ── */
code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.85em;
  background: var(--bg-code);
  color: var(--accent);
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

pre {
  background: var(--bg-code);
  border-left: 3px solid var(--accent2);
  border-radius: 0 6px 6px 0;
  padding: 1rem 1.2rem;
  overflow-x: auto;
  margin: 0.8rem 0 1.2rem;
}

pre code {
  background: none;
  color: var(--fg);
  padding: 0;
  font-size: 0.88rem;
  border-radius: 0;
}

/* ── Tables ── */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.6rem 0 1.2rem;
  font-size: 0.88rem;
}

th {
  text-align: left;
  padding: 0.45rem 0.8rem;
  background: var(--bg-side);
  color: var(--fg-muted);
  font-weight: 600;
  border-bottom: 2px solid var(--border);
  letter-spacing: 0.03em;
}

td {
  padding: 0.4rem 0.8rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

tr:last-child td { border-bottom: none; }
td:first-child code { color: var(--accent); }

/* ── Lists ── */
ul {
  padding-left: 1.4rem;
  margin-bottom: 0.9rem;
}

ul li { margin-bottom: 0.2rem; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

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

const nav  = buildNav(blocks);
const body = renderBlocks(blocks);

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
</html>`;

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'index.html'), html);
console.log('docs/index.html written');
