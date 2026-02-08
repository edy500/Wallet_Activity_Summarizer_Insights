import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { sha256Hex } from './utils.js';
import { loadAgentWalletConfig, formatAgentWalletHelp } from './agentwallet.js';

export type PublishMemoOptions = {
  rpcUrl: string;
  outDir: string;
  dryRun?: boolean;
};

export async function publishMemo(reportPath: string, opts: PublishMemoOptions): Promise<string | null> {
  const reportJson = readFileSync(reportPath, 'utf8');
  const hash = sha256Hex(reportJson);
  const memo = `WalletReport:${hash}`;

  const outMemoPath = resolve(opts.outDir, 'memo_payload.txt');
  writeFileSync(outMemoPath, memo, 'utf8');

  if (opts.dryRun) {
    return null;
  }

  const cfg = loadAgentWalletConfig();
  if (!cfg) {
    throw new Error(formatAgentWalletHelp());
  }

  throw new Error(
    'AgentWallet config detected, but memo publish requires a generic Solana transaction signing endpoint which is not in the provided skill. Please confirm the correct endpoint.'
  );
}
