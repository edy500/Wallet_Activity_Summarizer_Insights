# Wallet Activity Summarizer (Insights)

CLI que gera relatorio humano + JSON de atividade de uma wallet Solana via leitura on-chain (RPC). Opcionalmente publica um Memo em devnet com o hash do relatorio (requer AgentWallet).

## Demo in 60 seconds
```bash
pnpm install
pnpm run report <ADDRESS> --days 30
# Saidas: output/report.json, output/report.md, output/report.hash.txt

# Memo (devnet) - precisa AgentWallet
pnpm run publish-memo output/report.json --network devnet
```

## Comandos
- `pnpm run report <address> --days 30 --maxTx 1000 --rpc <url> --known-programs <path>`
- `pnpm run publish-memo <report.json> --network devnet --rpc <url> --dry-run`

## Saidas
- `output/report.json`
- `output/report.md`
- `output/report.hash.txt`
- `output/memo_payload.txt` (sempre gerado em publish-memo)

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

## Status do Memo
O comando `publish-memo` esta pronto para integrar com AgentWallet. Preciso do `skill.md` do AgentWallet para implementar a assinatura e envio da transacao.
