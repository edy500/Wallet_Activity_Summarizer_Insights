import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { runReport } from './report.js';
import { DEFAULT_MAINNET_RPC } from './solana.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'publica');
const knownProgramsPath = join(rootDir, 'docs', 'known-programs.json');

const port = Number(process.env.PORT || 4173);

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function send(res: any, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (!req.url) return send(res, 400, 'Bad Request');
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/report') {
    const address = url.searchParams.get('address')?.trim();
    const days = Number(url.searchParams.get('days') || '30');
    const maxTx = Number(url.searchParams.get('maxTx') || '50');
    const rpcOverride = url.searchParams.get('rpc')?.trim() || '';

    if (!address) return send(res, 400, 'Missing address');

    try {
      const rpcUrl = rpcOverride || process.env.SOLANA_RPC_URL || DEFAULT_MAINNET_RPC;
      const safeMaxTx = Math.max(1, Math.min(200, maxTx));
      const { report } = await runReport({
        address,
        days,
        rpcUrl,
        outDir: 'output',
        maxTx: safeMaxTx,
        concurrency: 1,
        delayMs: 800,
        knownProgramsPath: existsSync(knownProgramsPath) ? knownProgramsPath : undefined,
      });
      return send(res, 200, JSON.stringify(report), 'application/json; charset=utf-8');
    } catch (err: any) {
      return send(res, 500, `Error: ${err?.message || 'unknown'}`);
    }
  }

  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = filePath.replace(/\/+/g, '/');
  const fullPath = join(publicDir, filePath);
  if (!fullPath.startsWith(publicDir)) return send(res, 403, 'Forbidden');
  if (!existsSync(fullPath)) return send(res, 404, 'Not found');

  const ext = extname(fullPath);
  const type = contentTypes[ext] || 'application/octet-stream';
  const content = readFileSync(fullPath);
  res.writeHead(200, { 'Content-Type': type });
  res.end(content);
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`UI server running at http://localhost:${port}`);
});
