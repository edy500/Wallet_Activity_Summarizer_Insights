import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { chunk, sleep } from './utils.js';

export type SignatureInfo = {
  signature: string;
  blockTime: number | null;
  slot: number;
};

export const DEFAULT_MAINNET_RPC = 'https://api.mainnet-beta.solana.com';
export const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';

export function makeConnection(rpcUrl: string): Connection {
  return new Connection(rpcUrl, 'confirmed');
}

export async function fetchSignaturesForAddress(
  connection: Connection,
  address: string,
  sinceTs: number,
  maxTx: number
): Promise<SignatureInfo[]> {
  const pubkey = new PublicKey(address);
  const results: SignatureInfo[] = [];
  let before: string | undefined;
  let done = false;

  while (!done && results.length < maxTx) {
    const limit = Math.min(1000, maxTx - results.length);
    const sigs = await connection.getSignaturesForAddress(pubkey, { limit, before });
    if (sigs.length === 0) break;

    for (const s of sigs) {
      const bt = s.blockTime ?? null;
      if (bt !== null && bt < sinceTs) {
        done = true;
        break;
      }
      results.push({ signature: s.signature, blockTime: bt, slot: s.slot });
    }

    before = sigs[sigs.length - 1]?.signature;
    if (!before) break;
  }

  return results;
}

export async function fetchParsedTransactions(
  connection: Connection,
  signatures: SignatureInfo[],
  concurrency = 5,
  delayMs = 150
): Promise<(ParsedTransactionWithMeta | null)[]> {
  const sigs = signatures.map((s) => s.signature);
  const batches = chunk(sigs, concurrency);
  const out: (ParsedTransactionWithMeta | null)[] = [];

  for (const batch of batches) {
    const txs = await Promise.all(
      batch.map((sig) =>
        connection.getParsedTransaction(sig, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed',
        })
      )
    );
    out.push(...txs);
    if (delayMs > 0) await sleep(delayMs);
  }

  return out;
}
