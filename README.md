# Wallet Activity Summarizer (Insights)

CLI que gera relatorio humano + JSON de atividade de uma wallet Solana via leitura on-chain (RPC). Opcionalmente publica um Memo em devnet com o hash do relatorio (requer AgentWallet).

## Demo in 60 seconds
```bash
pnpm install

# 1) Gerar relatorio (mainnet, read-only)
pnpm run report <ADDRESS> --days 30 --maxTx 50 --concurrency 1 --delayMs 800 --known-programs docs/known-programs.json
# Saidas: output/report.json, output/report.md, output/report.hash.txt

# 2) Gerar payload de Memo (dry-run)
pnpm run publish-memo output/report.json --network devnet --dry-run
# Saida: output/memo_payload.txt
```

## Comandos
- `pnpm run report <address> --days 30 --maxTx 1000 --rpc <url> --known-programs <path>`
- `pnpm run publish-memo <report.json> --network devnet --rpc <url> --dry-run`

## Saidas
- `output/report.json`
- `output/report.md`
- `output/report.hash.txt`
- `output/memo_payload.txt` (sempre gerado em publish-memo)

## Demo outputs (repo)
- `docs/demo-report.md`
- `docs/demo-report.json` (RPC key redacted)

## UI local (minima)
```bash
pnpm run dev
```
Abre `http://localhost:4173` e mostra os insights do arquivo `publica/data/demo-report.json`.
Voce pode colar um address e gerar o relatorio direto na tela (API local).

## Notas de seguranca
- Leitura RPC e 100% read-only (sem chave privada).
- Para escrever Memo, use AgentWallet (proibido `solana-keygen`, sem Phantom/hardware wallet).

## Known programs
Se quiser classificar protocolos com mais precisao, passe um JSON via `--known-programs`.
Formato:
```json
[
  { "id": "ProgramIdAqui", "name": "Jupiter", "category": "swap" }
]
```

Ja inclui uma lista inicial em `docs/known-programs.json`:
```bash
pnpm run report <ADDRESS> --days 30 --known-programs docs/known-programs.json
```

## Status do Memo
O `skill.md` atual do AgentWallet nao expõe endpoint para assinar/enviar transacoes Solana genericas (como Memo). Por isso, `publish-memo` fica em **dry-run**: gera o hash e o payload do Memo, mas nao envia on-chain. Assim que houver endpoint para transacao generica, a integracao sera finalizada.
