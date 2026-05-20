# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ElaraPay** is a non-custodial USDC payment gateway on Base blockchain with three parts:
1. **`/contracts`** — Solidity smart contract (Foundry)
2. **`/web`** — Next.js 14 storefront frontend
3. **`/worker`** — Node.js event indexer

## Commands

### Smart Contracts (`/contracts`)
```bash
forge build                          # Compile
forge test -vvv                      # Run all tests
forge test -vvv --match-test <name>  # Run single test
forge script script/DeployGateway.s.sol:DeployGateway --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
```

### Frontend (`/web`)
```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
npm run worker   # Run event indexer (tsx scripts/worker.ts)
```

### Worker (`/worker`)
```bash
node index.js    # Start event listener
```

## Architecture

### Payment Flow
1. Customer connects wallet via OnchainKit (Coinbase Smart Wallet)
2. Frontend POSTs to `/api/create-order` — backend validates, calls `createOrder()` on-chain as admin, stores pending order in Supabase
3. OnchainKit batches `USDC.approve()` + `gateway.payForOrder()` for the user
4. Contract emits `PaymentReceived`; worker indexes it to Supabase

### `BasePaymentGateway.sol` — Core Contract
- Non-custodial: funds flow directly buyer → merchant (no escrow)
- Order lifecycle: `None → Created → Paid → Shipped/Refunded`
- Replay protection: each `orderId` can only be paid once
- Admin functions: `createOrder`, `markShipped`, `refund`, `rescueERC20`, `pause/unpause`
- User functions: `payForOrder`, `payWithPermit` (EIP-2612 gasless approval)
- Security: CEI pattern, `ReentrancyGuard`, `SafeERC20`, custom errors, `Ownable2Step`

### Frontend (`web/src/app/`)
- `page.tsx` — Main storefront (products, cart, payment UI)
- `providers.tsx` — wagmi + OnchainKit + React Query setup
- `api/create-order/route.ts` — Order creation API with rate limiting (Upstash Redis), idempotency, distributed lock to prevent nonce racing
- `lib/contracts.ts` — Contract addresses and ABIs
- `lib/products.ts` — Product catalog

### Worker (`worker/index.js`)
- Polls `PaymentReceived` events every 10 seconds, max 500 blocks per query
- Waits 2 confirmations; detects and handles chain reorgs
- Tracks `last_block` in Supabase to resume after restarts

## Key Libraries

| Layer | Tools |
|---|---|
| Contracts | Solidity ^0.8.20, Foundry, OpenZeppelin |
| Frontend | Next.js 14, wagmi v2, viem v2, `@coinbase/onchainkit`, TailwindCSS |
| State | React Query v5, Supabase (PostgreSQL) |
| Security | Upstash Redis (rate limiting), nanoid (order IDs) |
| Worker | ethers.js v6, Supabase |

## Environment Variables

### `/web` — public (`NEXT_PUBLIC_*`)
```
NEXT_PUBLIC_GATEWAY_ADDRESS      # Deployed contract
NEXT_PUBLIC_USDC_ADDRESS         # USDC token
NEXT_PUBLIC_CHAIN                # "sepolia" or "mainnet"
NEXT_PUBLIC_ONCHAINKIT_API_KEY
NEXT_PUBLIC_ALCHEMY_ID
```

### `/web` — server-only (`.env.server.local`)
```
ADMIN_PRIVATE_KEY                # Signs createOrder txs
SUPABASE_URL / SUPABASE_SERVICE_KEY
UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
```

### `/contracts` — `.env`
```
DEPLOYER_PRIVATE_KEY
USDC_ADDRESS
BASE_RPC_URL / BASE_SEPOLIA_RPC_URL
BASESCAN_API_KEY
```

## Network Targets

| Network | Chain ID | USDC |
|---|---|---|
| Base Sepolia (active) | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Base Mainnet (ready) | 8453 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Live contract on Base Sepolia: `0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684`

## Important Patterns

- The **backend (`/api/create-order`) is the price source of truth** — never trust client-provided amounts
- Rate limiting: 5 req/min per IP and per wallet address
- `forge-std` and `openzeppelin-contracts` are git submodules under `contracts/lib/`
- ABI files (`abi.json`, `abi_utf8.json`) in `/contracts` are manually kept in sync — regenerate after contract changes
- No frontend tests exist; contract tests are in `contracts/test/Gateway.t.sol` (10 test cases)
