#!/usr/bin/env node
'use strict';
/**
 * scripts/serve.js
 * Zero-dependency dev server for tak docs and examples.
 * Usage: node scripts/serve.js [port]
 */
const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.tak':  'text/plain; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname;

  // Default route → docs
  if (pathname === '/') pathname = '/docs/index.html';

  // Resolve and guard against path traversal
  const filePath = path.resolve(root, '.' + pathname);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  let target = filePath;
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      target = path.join(target, 'index.html');
      fs.statSync(target); // throws if not found
    }
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not found');
    return;
  }

  const ext  = path.extname(target).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(target);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\ntak dev server → http://localhost:${PORT}\n`);
  console.log('  /                  docs/index.html');
  console.log('  /examples/*.html   examples');
  console.log('  /dist/tak.js       built runtime');
  console.log('\nCtrl+C to stop\n');
});
