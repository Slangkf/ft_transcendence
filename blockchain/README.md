# Blockchain module — Tournament scores on Avalanche

Stores ft_transcendence tournament results on-chain (Avalanche **Fuji** testnet)
via a Solidity smart contract. Guarantees **integrity & immutability**: each
tournament id can be written only once and can never be modified or deleted.

```
blockchain/
├── contracts/TournamentScores.sol   the smart contract
├── scripts/deploy.ts                deploys to Fuji, prints the address
├── test/TournamentScores.test.ts    proves record / retrieve / immutability
└── hardhat.config.ts                Fuji network config
```

## 1. Setup

```bash
cd blockchain
npm install
cp .env.example .env       # then fill DEPLOYER_PRIVATE_KEY
```

> ⚠️ Use a **dedicated throwaway wallet** that only holds test AVAX — never a
> wallet with real funds. The private key ends up in `.env` (gitignored).

Fund the wallet with test AVAX: https://faucet.avax.network/ (network: Fuji C-Chain).

## 2. Compile & test

```bash
npm run compile
npm run test        # runs on a local in-memory chain, no AVAX needed
```

## 3. Deploy to Fuji

```bash
npm run deploy:fuji
```

Copy the printed `CHAIN_CONTRACT_ADDRESS` into the **root** `.env` (used by the
backend). Verify it on https://testnet.snowtrace.io.

## 4. Backend wiring

The backend reads three env vars (see root `.env`, injected in `docker-compose.yml`):

| var | meaning |
|-----|---------|
| `AVAX_RPC_URL` | `https://api.avax-test.network/ext/bc/C/rpc` |
| `CHAIN_PRIVATE_KEY` | the same testnet key (signs the record tx) |
| `CHAIN_CONTRACT_ADDRESS` | address printed at deploy time |

If any is missing the backend logs `[blockchain] disabled` and tournaments work
normally without writing on-chain (fail-soft).

- Write: `BlockchainService.recordTournament()` is called from
  `TournamentService.finish()` when a tournament ends. The tx hash is broadcast
  to the bracket page via the `tournament_onchain` socket event.
- Read: `GET /api/tournament/:id/onchain` returns the scores read back from the
  contract.

## Network reference

| | |
|--|--|
| Network | Avalanche Fuji C-Chain |
| Chain ID | 43113 |
| RPC | https://api.avax-test.network/ext/bc/C/rpc |
| Explorer | https://testnet.snowtrace.io |
| Faucet | https://faucet.avax.network/ |
