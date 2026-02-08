import { Command } from 'commander';
import { runReport } from './report.js';
import { DEFAULT_MAINNET_RPC, DEFAULT_DEVNET_RPC } from './solana.js';
import { publishMemo } from './memo.js';
import { loadAgentWalletConfig, getAgentWalletConfigPath } from './agentwallet.js';

const program = new Command();

program
  .name('wallet-activity')
  .description('Wallet Activity Summarizer (Solana)')
  .version('0.1.0');

program
  .command('report')
  .argument('<address>', 'Solana address to analyze')
  .option('--days <number>', 'time window in days', '30')
  .option('--rpc <url>', 'RPC URL (default mainnet)', process.env.SOLANA_RPC_URL || DEFAULT_MAINNET_RPC)
  .option('--outDir <dir>', 'output directory', 'output')
  .option('--maxTx <number>', 'max transactions to scan', '1000')
  .option('--concurrency <number>', 'RPC concurrency for getParsedTransaction', '3')
  .option('--delayMs <number>', 'delay between batches (ms)', '400')
  .option('--known-programs <path>', 'path to known programs JSON list')
  .action(async (address, options) => {
    const days = Number(options.days);
    const maxTx = Number(options.maxTx);
    const concurrency = Number(options.concurrency);
    const delayMs = Number(options.delayMs);
    const { reportHash } = await runReport({
      address,
      days,
      rpcUrl: options.rpc,
      outDir: options.outDir,
      maxTx,
      concurrency,
      delayMs,
      knownProgramsPath: options.knownPrograms,
    });
    console.log(`Report generated. Hash: ${reportHash}`);
  });

program
  .command('publish-memo')
  .argument('<reportPath>', 'path to report.json')
  .option('--network <network>', 'devnet or mainnet', 'devnet')
  .option('--rpc <url>', 'RPC URL override')
  .option('--outDir <dir>', 'output directory', 'output')
  .option('--dry-run', 'only generate memo payload', false)
  .action(async (reportPath, options) => {
    const network = options.network;
    const rpcUrl = options.rpc || (network === 'devnet' ? DEFAULT_DEVNET_RPC : DEFAULT_MAINNET_RPC);
    const signature = await publishMemo(reportPath, {
      rpcUrl,
      outDir: options.outDir,
      dryRun: Boolean(options.dryRun),
    });
    if (signature) console.log(`Memo tx: ${signature}`);
  });

program
  .command('agentwallet-status')
  .description('Check AgentWallet configuration status')
  .action(() => {
    const cfg = loadAgentWalletConfig();
    if (!cfg) {
      console.log(`AgentWallet not configured. Expected: ${getAgentWalletConfigPath()}`);
      process.exitCode = 1;
      return;
    }
    console.log(`AgentWallet configured: ${cfg.username}`);
    if (cfg.solanaAddress) console.log(`Solana address: ${cfg.solanaAddress}`);
  });

program.parseAsync(process.argv);
