/**
 * Lightweight local development server with zero external dependencies.
 * Serves static assets from public/ and routes /api/plan to the Vercel handler.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { POST } from './api/plan.js';

// Load .env if present
if (existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...vals] = trimmed.split('=');
    if (key) {
      process.env[key.trim()] ??= vals.join('=').trim();
    }
  }
}

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = join(process.cwd(), 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Handle API route
  if (pathname === '/api/plan') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      const request = new Request(`http://${req.headers.host || 'localhost'}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      });

      const response = await POST(request);
      res.statusCode = response.status;
      for (const [k, v] of response.headers.entries()) {
        res.setHeader(k, v);
      }
      res.end(await response.text());
    } catch (err) {
      console.error('Local server error:', err);
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Internal server error' } }));
    }
    return;
  }

  // Handle Clean URLs and Static files
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = join(PUBLIC_DIR, 'index.html');
  } else if (pathname === '/plan') {
    filePath = join(PUBLIC_DIR, 'plan.html');
  } else {
    filePath = join(PUBLIC_DIR, pathname);
  }

  if (existsSync(filePath)) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('content-type', contentType);
    res.end(readFileSync(filePath));
    return;
  }

  res.statusCode = 404;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.info(`\n🚀 AuraPlan running locally at: http://localhost:${PORT}`);
  console.info(`✨ Open http://localhost:${PORT} in your browser to view the app.\n`);
});
