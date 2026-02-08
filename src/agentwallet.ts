import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type AgentWalletConfig = {
  username: string;
  email?: string;
  evmAddress?: string;
  solanaAddress?: string;
  apiToken: string;
  moltbookLinked?: boolean;
  moltbookUsername?: string | null;
  xHandle?: string | null;
};

export function loadAgentWalletConfig(): AgentWalletConfig | null {
  const path = getAgentWalletConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw) as AgentWalletConfig;
    if (!parsed?.username || !parsed?.apiToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getAgentWalletConfigPath(): string {
  return join(homedir(), '.agentwallet', 'config.json');
}

export function formatAgentWalletHelp(): string {
  return [
    'AgentWallet not configured.',
    'Expected config at ~/.agentwallet/config.json with apiToken.',
    'Follow: https://agentwallet.mcpay.tech/skill.md',
    'Connect flow: POST /api/connect/start -> POST /api/connect/complete',
  ].join('\n');
}
