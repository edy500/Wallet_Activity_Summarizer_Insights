import { ParsedInstruction, ParsedTransactionWithMeta } from '@solana/web3.js';
import { formatSol, toIso, uniq } from './utils.js';

export type ActionType = 'swap' | 'transfer' | 'nft' | 'mint' | 'stake' | 'unknown';

export type KnownProgram = {
  id: string;
  name: string;
  category: string;
};

export type Report = {
  metadata: {
    address: string;
    days: number;
    startTime: string | null;
    endTime: string | null;
    generatedAt: string;
    rpcUrl: string;
    txScanned: number;
  };
  summary: {
    totalTx: number;
    totalFeesSol: number;
    actionCounts: Record<ActionType, number>;
  };
  protocolsUsed: { name: string; count: number }[];
  topTokens: { mint: string; transfers: number; amountAbs: string }[];
  topCounterparties: { address: string; transfers: number }[];
  hourlyActivity: { hour: number; tx: number }[];
  flags: { id: string; level: 'info' | 'warn'; message: string }[];
  txSamples: {
    signature: string;
    time: string | null;
    action: ActionType;
    programs: string[];
  }[];
};

const STAKE_PROGRAM = 'Stake11111111111111111111111111111111111111';

type Transfer = {
  mint?: string;
  amountAbs: bigint;
  decimals?: number;
  source?: string;
  destination?: string;
  isNftApprox?: boolean;
};

export function analyzeTransactions(
  address: string,
  rpcUrl: string,
  days: number,
  txs: (ParsedTransactionWithMeta | null)[],
  knownPrograms: KnownProgram[]
): Report {
  const actionCounts: Record<ActionType, number> = {
    swap: 0,
    transfer: 0,
    nft: 0,
    mint: 0,
    stake: 0,
    unknown: 0,
  };

  const tokenAgg = new Map<string, { transfers: number; amountAbs: bigint }>();
  const counterpartyAgg = new Map<string, number>();
  const protocolAgg = new Map<string, number>();
  const hourlyAgg = new Map<number, number>();

  const knownProgramMap = new Map(knownPrograms.map((p) => [p.id, p]));

  const txSamples: Report['txSamples'] = [];

  for (const tx of txs) {
    if (!tx || !tx.transaction) continue;
    const sig = tx.transaction.signatures?.[0] ?? 'unknown';
    const blockTime = tx.blockTime ?? null;
    const hour = blockTime ? new Date(blockTime * 1000).getUTCHours() : null;

    if (hour !== null) hourlyAgg.set(hour, (hourlyAgg.get(hour) ?? 0) + 1);

    const transfers: Transfer[] = [];
    const solTransfers: { source: string; destination: string; lamports: bigint }[] = [];
    const programs: string[] = [];
    const programIds = new Set<string>();

    const allInstructions = collectParsedInstructions(tx);

    for (const ix of allInstructions) {
      if (!ix) continue;
      const programId = ix.programId?.toString?.() ?? ix.programId?.toString?.() ?? '';
      if (programId) programIds.add(programId);
      if (ix.program) programs.push(ix.program);

      if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info as any;
        if (info?.source && info?.destination && info?.lamports) {
          solTransfers.push({
            source: info.source,
            destination: info.destination,
            lamports: BigInt(info.lamports),
          });
        }
      }

      if (ix.program === 'spl-token') {
        const info = ix.parsed?.info as any;
        const type = ix.parsed?.type as string | undefined;
        if (type === 'transfer') {
          const amount = info?.amount ? BigInt(info.amount) : 0n;
          transfers.push({
            mint: info?.mint,
            amountAbs: amount < 0n ? -amount : amount,
            source: info?.source,
            destination: info?.destination,
          });
        }
        if (type === 'transferChecked') {
          const tokenAmount = info?.tokenAmount;
          const amount = tokenAmount?.amount ? BigInt(tokenAmount.amount) : 0n;
          const decimals = tokenAmount?.decimals ?? undefined;
          transfers.push({
            mint: info?.mint,
            amountAbs: amount < 0n ? -amount : amount,
            decimals,
            source: info?.source,
            destination: info?.destination,
            isNftApprox: decimals === 0 && amount === 1n,
          });
        }
        if (type === 'mintTo') {
          const amount = info?.amount ? BigInt(info.amount) : 0n;
          transfers.push({
            mint: info?.mint,
            amountAbs: amount < 0n ? -amount : amount,
            destination: info?.account,
            isNftApprox: info?.decimals === 0 && amount === 1n,
          });
        }
        if (type === 'burn') {
          const amount = info?.amount ? BigInt(info.amount) : 0n;
          transfers.push({
            mint: info?.mint,
            amountAbs: amount < 0n ? -amount : amount,
            source: info?.account,
          });
        }
      }
    }

    for (const programId of programIds) {
      const known = knownProgramMap.get(programId);
      if (known) protocolAgg.set(known.name, (protocolAgg.get(known.name) ?? 0) + 1);
    }

    const tokenDeltas = computeOwnerTokenDeltas(tx, address);
    const solDelta = computeOwnerSolDelta(tx, address);
    const hasSwapProgram = hasSwapProgramCategory(programIds, knownProgramMap);

    const action = classifyAction({
      programIds,
      transfers,
      solTransfers,
      tokenDeltas,
      solDelta,
      hasSwapProgram,
    });
    actionCounts[action] += 1;

    for (const t of transfers) {
      if (!t.mint) continue;
      const entry = tokenAgg.get(t.mint) ?? { transfers: 0, amountAbs: 0n };
      entry.transfers += 1;
      entry.amountAbs += t.amountAbs;
      tokenAgg.set(t.mint, entry);

      const cp = counterpartyFromTransfer(address, t);
      if (cp) counterpartyAgg.set(cp, (counterpartyAgg.get(cp) ?? 0) + 1);
    }

    for (const s of solTransfers) {
      const cp = s.source === address ? s.destination : s.destination === address ? s.source : null;
      if (cp) counterpartyAgg.set(cp, (counterpartyAgg.get(cp) ?? 0) + 1);
    }

    if (txSamples.length < 10) {
      txSamples.push({
        signature: sig,
        time: toIso(blockTime),
        action,
        programs: uniq(programs).slice(0, 5),
      });
    }
  }

  const topTokens = Array.from(tokenAgg.entries())
    .map(([mint, v]) => ({
      mint,
      transfers: v.transfers,
      amountAbs: v.amountAbs.toString(),
    }))
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 10);

  const topCounterparties = Array.from(counterpartyAgg.entries())
    .map(([addr, transfers]) => ({ address: addr, transfers }))
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 10);

  const protocolsUsed = Array.from(protocolAgg.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const hourlyActivity = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    tx: hourlyAgg.get(h) ?? 0,
  }));

  const totalFeesSol = txs.reduce((acc, tx) => acc + (tx?.meta?.fee ?? 0), 0) / 1_000_000_000;

  const flags: Report['flags'] = [];
  const totalTx = txs.filter(Boolean).length;
  if (totalTx > 200) flags.push({ id: 'high_activity', level: 'info', message: 'High activity in selected window.' });
  if (topCounterparties.length >= 10) flags.push({ id: 'many_counterparties', level: 'info', message: 'Many counterparties observed.' });
  if (topTokens.length >= 10) flags.push({ id: 'many_tokens', level: 'info', message: 'Many token mints observed.' });

  return {
    metadata: {
      address,
      days,
      startTime: toIso(minBlockTime(txs)),
      endTime: toIso(maxBlockTime(txs)),
      generatedAt: new Date().toISOString(),
      rpcUrl,
      txScanned: txs.filter(Boolean).length,
    },
    summary: {
      totalTx,
      totalFeesSol,
      actionCounts,
    },
    protocolsUsed,
    topTokens,
    topCounterparties,
    hourlyActivity,
    flags,
    txSamples,
  };
}

function collectParsedInstructions(tx: ParsedTransactionWithMeta): ParsedInstruction[] {
  const out: ParsedInstruction[] = [];
  const messageIxs = tx.transaction.message.instructions as ParsedInstruction[];
  out.push(...messageIxs);
  const inner = tx.meta?.innerInstructions ?? [];
  for (const ix of inner) {
    out.push(...(ix.instructions as ParsedInstruction[]));
  }
  return out;
}

function classifyAction(input: {
  programIds: Set<string>;
  transfers: Transfer[];
  solTransfers: { source: string; destination: string; lamports: bigint }[];
  tokenDeltas: Map<string, bigint>;
  solDelta: bigint;
  hasSwapProgram: boolean;
}): ActionType {
  const { programIds, transfers, solTransfers, tokenDeltas, solDelta, hasSwapProgram } = input;
  const hasStake = programIds.has(STAKE_PROGRAM);
  if (hasStake) return 'stake';

  const tokenMints = transfers.map((t) => t.mint).filter(Boolean);
  const uniqueMints = uniq(tokenMints);
  const hasNft = transfers.some((t) => t.isNftApprox);
  const tokenDeltaValues = Array.from(tokenDeltas.values());
  const hasTokenIn = tokenDeltaValues.some((v) => v > 0n);
  const hasTokenOut = tokenDeltaValues.some((v) => v < 0n);
  const hasTokenDelta = tokenDeltaValues.length > 0;
  const hasSolIn = solDelta > 0n;
  const hasSolOut = solDelta < 0n;

  if (hasSwapProgram && (hasTokenDelta || hasSolIn || hasSolOut)) return 'swap';
  if (hasTokenIn && hasTokenOut && tokenDeltas.size >= 2) return 'swap';
  if ((hasTokenIn || hasTokenOut) && (hasSolIn || hasSolOut)) return 'swap';
  if (uniqueMints.length >= 2) return 'swap';
  if (solTransfers.length > 0 && tokenMints.length > 0) return 'swap';
  if (hasNft) return 'nft';
  if (tokenMints.length > 0 || solTransfers.length > 0) return 'transfer';
  if (transfers.some((t) => !t.source && t.destination)) return 'mint';

  return 'unknown';
}

function computeOwnerTokenDeltas(tx: ParsedTransactionWithMeta, owner: string): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  for (const bal of pre) {
    if (bal.owner !== owner) continue;
    const mint = bal.mint;
    const amount = bal.uiTokenAmount?.amount ? BigInt(bal.uiTokenAmount.amount) : 0n;
    deltas.set(mint, (deltas.get(mint) ?? 0n) - amount);
  }

  for (const bal of post) {
    if (bal.owner !== owner) continue;
    const mint = bal.mint;
    const amount = bal.uiTokenAmount?.amount ? BigInt(bal.uiTokenAmount.amount) : 0n;
    deltas.set(mint, (deltas.get(mint) ?? 0n) + amount);
  }

  for (const [mint, delta] of Array.from(deltas.entries())) {
    if (delta === 0n) deltas.delete(mint);
  }

  return deltas;
}

function computeOwnerSolDelta(tx: ParsedTransactionWithMeta, owner: string): bigint {
  const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toString());
  const idx = keys.indexOf(owner);
  if (idx < 0) return 0n;
  const pre = tx.meta?.preBalances?.[idx] ?? 0;
  const post = tx.meta?.postBalances?.[idx] ?? 0;
  return BigInt(post - pre);
}

function hasSwapProgramCategory(programIds: Set<string>, known: Map<string, KnownProgram>): boolean {
  for (const id of programIds) {
    const p = known.get(id);
    if (!p) continue;
    const cat = p.category?.toLowerCase?.() ?? '';
    if (cat === 'swap' || cat === 'amm' || cat === 'clmm' || cat === 'orderbook') return true;
  }
  return false;
}

function counterpartyFromTransfer(address: string, t: Transfer): string | null {
  if (!t.source && !t.destination) return null;
  if (t.source === address && t.destination) return t.destination;
  if (t.destination === address && t.source) return t.source;
  return null;
}

function minBlockTime(txs: (ParsedTransactionWithMeta | null)[]): number | null {
  let min: number | null = null;
  for (const tx of txs) {
    if (!tx?.blockTime) continue;
    if (min === null || tx.blockTime < min) min = tx.blockTime;
  }
  return min;
}

function maxBlockTime(txs: (ParsedTransactionWithMeta | null)[]): number | null {
  let max: number | null = null;
  for (const tx of txs) {
    if (!tx?.blockTime) continue;
    if (max === null || tx.blockTime > max) max = tx.blockTime;
  }
  return max;
}

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# Wallet Activity Report`);
  lines.push('');
  lines.push(`Address: ${report.metadata.address}`);
  lines.push(`Window: ${report.metadata.days} days`);
  lines.push(`Scanned tx: ${report.metadata.txScanned}`);
  lines.push(`Start: ${report.metadata.startTime ?? 'n/a'}`);
  lines.push(`End: ${report.metadata.endTime ?? 'n/a'}`);
  lines.push('');

  lines.push('## Summary');
  lines.push(`Total tx: ${report.summary.totalTx}`);
  lines.push(`Total fees: ${report.summary.totalFeesSol.toFixed(4)} SOL`);
  lines.push(`Actions: swap ${report.summary.actionCounts.swap}, transfer ${report.summary.actionCounts.transfer}, nft ${report.summary.actionCounts.nft}, mint ${report.summary.actionCounts.mint}, stake ${report.summary.actionCounts.stake}, unknown ${report.summary.actionCounts.unknown}`);
  lines.push('');

  if (report.protocolsUsed.length > 0) {
    lines.push('## Protocols (known list)');
    for (const p of report.protocolsUsed.slice(0, 10)) {
      lines.push(`- ${p.name}: ${p.count}`);
    }
    lines.push('');
  }

  if (report.topTokens.length > 0) {
    lines.push('## Top tokens (by transfers)');
    for (const t of report.topTokens) {
      lines.push(`- ${t.mint}: ${t.transfers} transfers`);
    }
    lines.push('');
  }

  if (report.topCounterparties.length > 0) {
    lines.push('## Top counterparties');
    for (const c of report.topCounterparties) {
      lines.push(`- ${c.address}: ${c.transfers} transfers`);
    }
    lines.push('');
  }

  lines.push('## Activity by hour (UTC)');
  for (const h of report.hourlyActivity) {
    lines.push(`- ${h.hour}: ${h.tx}`);
  }
  lines.push('');

  if (report.flags.length > 0) {
    lines.push('## Flags');
    for (const f of report.flags) {
      lines.push(`- [${f.level}] ${f.message}`);
    }
    lines.push('');
  }

  lines.push('## Sample transactions');
  for (const s of report.txSamples) {
    lines.push(`- ${s.signature} | ${s.time ?? 'n/a'} | ${s.action} | ${s.programs.join(', ')}`);
  }
  lines.push('');

  lines.push('_Notes: swap/ NFT classification is heuristic. For full accuracy, provide a known programs list or integrate protocol-specific decoders._');

  return lines.join('\n');
}
