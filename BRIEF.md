# Brief - Wallet Activity Intelligence (Solana)

## Objetivo (1 frase)
Gerar um relatorio humano e um JSON estruturado sobre a atividade de uma wallet Solana a partir de dados on-chain (read-only), com opcao de registrar um hash do relatorio via Memo em devnet.

## Acao Solana obrigatoria (1 item)
Leitura on-chain via RPC (getSignaturesForAddress + getTransaction/getParsedTransaction + balances/token accounts).

## Demo script (passo a passo)
1. `pnpm install`
2. `pnpm run report <address> --days 30`
3. Verificar arquivos gerados: `output/report.md` e `output/report.json`
4. (Opcional) `pnpm run publish-memo output/report.json --network devnet`
5. Conferir assinatura em `output/memo_tx_signature.txt`

## Nao fazer (escopo cortado)
- Nao enviar fundos.
- Nao usar mainnet para escrita.
- Nao gerar nem armazenar chave privada localmente (sem solana-keygen).
- Nao depender de Phantom ou hardware wallet.
- Nao usar devnet/testnet para o relatorio principal (leitura deve ser mainnet).

## Definition of Done (checklist)
- `pnpm run report <address> --days 30` gera `output/report.md` e `output/report.json`.
- O relatorio inclui: resumo de atividade, tokens mais usados, swaps, transfers, NFTs, principais interacoes, top counterparties e flags simples.
- Classificacao automatica de acoes: swap / transfer / nft / mint / stake / unknown.
- (Opcional) `pnpm run publish-memo output/report.json --network devnet` publica Memo com hash e salva assinatura.
- README com "Demo in 60 seconds".
