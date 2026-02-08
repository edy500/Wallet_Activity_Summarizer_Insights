import { createHash } from 'crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function formatSol(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  return sol.toFixed(4);
}

export function toIso(tsSeconds?: number | null): string | null {
  if (!tsSeconds) return null;
  return new Date(tsSeconds * 1000).toISOString();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
