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

createServer(async (req, res) => {
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
}).listen(port, () => {
  console.log(`
  spelling-buddy

  demo    http://localhost:${port}/demo/index.html
  docs    http://localhost:${port}/docs/index.html
  lesson  http://localhost:${port}/examples/lesson.html
`);
});
