#!/usr/bin/env node
/**
 * Minimal static server for the demo and docs pages.
 * No dependencies — `npm run demo` should not require an install.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const root = process.cwd();
const port = Number(process.argv[2] || process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.jsx':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.gif':  'image/gif',
  '.css':  'text/css; charset=utf-8',
  '.md':   'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/demo/index.html';

    // keep requests inside the package root
    const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }

    const s = await stat(file);
    const target = s.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(target);

    res.writeHead(200, {
      'content-type': TYPES[extname(target)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});

/* Bound to the loopback address explicitly, and loud when the port is taken.

   Left to itself, node listens on every interface — and macOS is happy to let
   a second process bind `*:5173` while a first one holds `[::1]:5173`. Both
   servers start, both print the same URL, and `localhost` resolves to the IPv6
   address first: the other application answers, and this one prints a link to
   a page it is not serving. It printed a working URL to a 404 for a demo that
   was fine. */
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  port ${port} is already in use — something else is serving it.\n` +
                  `  try:  node scripts/serve.mjs ${port + 1}\n`);
    process.exit(1);
  }
  throw err;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`
  spelling-buddy

  demo    http://127.0.0.1:${port}/demo/index.html
  docs    http://127.0.0.1:${port}/docs/index.html
  lesson  http://127.0.0.1:${port}/examples/lesson.html
`);
});
