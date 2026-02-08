import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { analyzeTransactions, renderMarkdown, KnownProgram, Report } from './analysis.js';
import { DEFAULT_MAINNET_RPC, fetchParsedTransactions, fetchSignaturesForAddress, makeConnection } from './solana.js';
import { sha256Hex } from './utils.js';

export type ReportOptions = {
  address: string;
  days: number;
  rpcUrl: string;
  outDir: string;
  maxTx: number;
  concurrency?: number;
  delayMs?: number;
  knownProgramsPath?: string;
};

export async function runReport(opts: ReportOptions): Promise<{ report: Report; reportHash: string }> {
  const rpcUrl = opts.rpcUrl || DEFAULT_MAINNET_RPC;
  const connection = makeConnection(rpcUrl);
  const sinceTs = Math.floor(Date.now() / 1000) - opts.days * 24 * 60 * 60;

  const signatures = await fetchSignaturesForAddress(connection, opts.address, sinceTs, opts.maxTx);
  const txs = await fetchParsedTransactions(
    connection,
    signatures,
    opts.concurrency ?? 3,
    opts.delayMs ?? 400
  );

  const knownPrograms = loadKnownPrograms(opts.knownProgramsPath);

  const report = analyzeTransactions(opts.address, rpcUrl, opts.days, txs, knownPrograms);
  const reportJson = JSON.stringify(report, null, 2);
  const reportHash = sha256Hex(reportJson);

  const outDir = resolve(opts.outDir);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  writeFileSync(resolve(outDir, 'report.json'), reportJson, 'utf8');
  writeFileSync(resolve(outDir, 'report.md'), renderMarkdown(report), 'utf8');
  writeFileSync(resolve(outDir, 'report.hash.txt'), reportHash, 'utf8');

  return { report, reportHash };
}

function loadKnownPrograms(path?: string): KnownProgram[] {
  if (!path) return [];
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as KnownProgram[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
