<h1 align="center">ElaraPay</h1>

<p align="center">
  <strong>A non-custodial USDC payment gateway built natively on Base.</strong><br/>
  Accept stablecoin payments in your storefront — no intermediaries, no custody, no friction.
</p>

<p align="center">
  <a href="#architecture"><img src="https://img.shields.io/badge/Solidity-^0.8.20-363636?logo=solidity" alt="Solidity" /></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Foundry-Forge%20%2B%20Script-yellow" alt="Foundry" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/OnchainKit-0.38-0052FF?logo=coinbase" alt="OnchainKit" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/USDC-Circle-2775CA?logo=circle" alt="USDC" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?logo=supabase" alt="Supabase" /></a>
  <a href="#deployment"><img src="https://img.shields.io/badge/Network-Base%20Sepolia-0052FF" alt="Base Sepolia" /></a>
</p>

---

## Why This Exists

Traditional payment processors charge **2.9% + $0.30 per transaction**, enforce 3-7 day settlement windows, and require merchants to pass KYB checks that take weeks. For small and emerging brands, these costs and delays are prohibitive.

**BasePaymentGateway eliminates all of that.** It routes USDC payments directly from a customer's wallet to the merchant's wallet in a single atomic transaction — no middlemen, no custody, instant settlement. It's the payment infrastructure that Base was built for.

This project is a working proof of concept: a premium e-commerce storefront (**ELARA**) that accepts USDC payments on Base through a smart contract, using **Coinbase OnchainKit** for wallet connectivity, **Circle's USDC** as the settlement currency, and a **Node.js + Supabase worker** to track and index orders automatically.

---

## Live Demo

> > 🌐 **Live App:** [https://elarapay.xyz](https://elarapay.xyz)
> **Network:** Base Sepolia Testnet  
> **Contract:** [`0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684`](https://sepolia.basescan.org/address/0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684)  
> **USDC (Sepolia):** [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e)

---

## Key Features

| Feature | Details |
|---|---|
| **Escrow Model** | Funds are held in the contract until the admin marks the order as shipped, then released to the merchant. |
| **USDC Native** | Built for Circle's USDC on Base. Stable, predictable, and denominated in dollars. |
| **Backend-Created Orders** | Orders are created on-chain by the backend (admin) with a fixed price — the frontend never sets the price. |
| **Replay Protection** | Each `orderId` can only be paid once. Prevents double-charge attacks at the contract level. |
| **ReentrancyGuard + CEI** | Uses OpenZeppelin's `ReentrancyGuard` and follows the Checks-Effects-Interactions pattern. |
| **Order Limits (M-02)** | Configurable `minOrder` / `maxOrder` bounds enforced on-chain. |
| **EIP-2612 Permit** | Supports gasless approvals via `payWithPermit` for a better UX. |
| **Rate Limiting** | IP and wallet-based rate limiting via Upstash Redis to prevent abuse. |
| **Distributed Locking (M-01)** | Redis-based distributed lock prevents nonce racing on concurrent order creation. |
| **Gas Optimized** | Custom errors instead of `require` strings. Immutable state variables. Minimal storage footprint. |
| **OnchainKit Integration** | Coinbase Smart Wallet support via `@coinbase/onchainkit` — one-click wallet connection. |
| **Event-Driven Fulfillment** | Emits `PaymentReceived` events that a dedicated Node.js backend listens to and indexes into Supabase. |
| **Admin Controls** | Mark orders as shipped (releases funds), process refunds, rescue stuck tokens, pause/unpause. |
| **ETH Rejection (M-05)** | Contract rejects unexpected ETH transfers to prevent accidental loss. |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     ELARA Storefront                     │
│               (Next.js + OnchainKit + wagmi)             │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Connect  │    │ Product Card │    │  Transaction  │  │
│  │ Wallet   │    │ + Size/Color │    │    Status     │  │
│  │ (Smart)  │    │  Selection   │    │   (On-chain)  │  │
│  └────┬─────┘    └──────┬───────┘    └───────────────┘  │
│       │                 │                                │
└───────┼─────────────────┼────────────────────────────────┘
        │                 │
        │     ┌───────────▼───────────┐
        │     │   Two Transactions    │
        │     │   (Batched by OCK)    │
        │     │                       │
        │     │  1. USDC.approve()    │
        │     │  2. gateway.payFor()  │
        │     └───────────┬───────────┘
        │                 │
────────┼─────────────────┼──────────── Base Network ──────
        │                 │                 │ (Emits PaymentReceived)
        │     ┌───────────▼───────────┐     │
        │     │  BasePaymentGateway   ├─────┤
        │     │                       │     │
        │     │  • Validates order    │     ▼
        │     │  • Marks fulfilled    │  ┌─────────────────────────┐
        │     │  • Emits event        │  │      Node.js Worker     │
        │     │  • transferFrom →     │  │ (ethers.js + Supabase)  │
        │     │    merchant wallet    │  │                         │
        │     └───────────────────────┘  │ • Listens via WebSockets│
        │                                │ • Decodes event data    │
        ▼                                │ • Saves order to DB     │
  ┌───────────┐         ┌──────────┐     └─────────────────────────┘
  │  Coinbase │         │  USDC    │
  │  Smart    │         │ (Circle) │
  │  Wallet   │         │  ERC-20  │
  └───────────┘         └──────────┘
```

### Payment Flow

1. Customer connects their **Coinbase Smart Wallet** via OnchainKit
2. Customer selects a product, size, and color
3. Frontend calls the **backend API** (`/api/create-order`) which creates the order on-chain with a fixed price (backend is source of truth)
4. OnchainKit batches two calls into one user approval:
   - `USDC.approve(gateway, amount)` — authorize the gateway to spend
   - `gateway.payForOrder(amount, orderId)` — execute the payment
5. The contract validates the order, marks it as **Paid**, emits `PaymentReceived`, and holds USDC in **escrow**
6. Admin calls `markShipped()` to release funds to the merchant, or `refund()` to return USDC to the buyer
7. A **Node.js backend worker** listens for the event via Alchemy WebSockets and indexes into **Supabase**

---

## Tech Stack

### Smart Contracts (`/contracts`)

| Technology | Purpose |
|---|---|
| **Solidity ^0.8.20** | Contract language |
| **Foundry (Forge)** | Testing, compilation, and deployment |
| **USDC (Circle)** | Payment settlement currency |

### Frontend (`/web`)

| Technology | Purpose |
|---|---|
| **Next.js 14** | React framework with App Router |
| **OnchainKit** `@coinbase/onchainkit` | Wallet connection, identity, and transaction components |
| **wagmi v2** | React hooks for Ethereum |
| **viem** | TypeScript-first EVM interactions |
| **TailwindCSS** | Utility-first styling |

### Backend API (`/web/src/app/api`)

| Technology | Purpose |
|---|---|
| **Next.js API Routes** | Server-side order creation and management |
| **Upstash Redis** | Rate limiting and distributed locking (nonce racing prevention) |
| **nanoid** | Cryptographically secure order ID generation |
| **Supabase** | PostgreSQL database for order persistence and idempotency |

### Backend Worker (`/worker`)

| Technology | Purpose |
|---|---|
| **Node.js** | Runtime environment |
| **ethers.js v6** | WebSocket provider and contract interactions |
| **Supabase** | PostgreSQL database for storing order and payment records |

---

## Project Structure

```text
Base/
├── contracts/                    # Foundry project
│   ├── src/
│   │   └── BasePaymentGateway.sol    # Core payment gateway contract (escrow model)
│   ├── test/
│   │   └── Gateway.t.sol             # Comprehensive Forge test suite
│   ├── script/
│   │   └── DeployGateway.s.sol       # Deployment script
│   ├── foundry.toml                  # Forge config (Etherscan V2 verification)
│   └── .env.example                  # Environment variable template
│
├── web/                          # Next.js storefront
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main storefront (ELARA)
│   │   │   ├── layout.tsx            # Root layout with Providers
│   │   │   ├── globals.css           # Design system + animations
│   │   │   └── api/
│   │   │       └── create-order/
│   │   │           └── route.ts      # Backend order creation API
│   │   ├── components/
│   │   │   └── Providers.tsx         # wagmi + OnchainKit + React Query
│   │   └── lib/
│   │       ├── contracts.ts          # ABI + contract addresses
│   │       ├── products.ts           # Product catalog (source of truth)
│   │       └── redis.ts              # Upstash Redis client
│   └── package.json
│
├── worker/                       # Node.js Event Indexer
│   ├── index.js                  # Listens to on-chain events and pushes to Supabase
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Smart Contract

### `BasePaymentGateway.sol`

A single, focused contract that manages the full order lifecycle: **Create → Pay → Ship/Refund**, with USDC held in escrow.

**Core Functions:**

| Function | Access | Description |
|---|---|---|
| `createOrder()` | Owner | Creates an order with fixed price, bound to a specific buyer |
| `payForOrder()` | Buyer | Pays for an existing order (requires prior USDC approval) |
| `payWithPermit()` | Buyer | Pays using EIP-2612 permit (gasless approval) |
| `markShipped()` | Owner | Releases escrowed USDC to the merchant |
| `refund()` | Owner | Returns escrowed USDC to the buyer |
| `setLimits()` | Owner | Sets min/max order amount bounds |
| `rescueERC20()` | Owner | Rescues stuck tokens from the contract |
| `pause() / unpause()` | Owner | Emergency pause mechanism |
| `getOrder()` | Public | View helper to query order details |

**Security Audit Fixes Applied:**

| ID | Severity | Fix |
|---|---|---|
| **M-01** | Medium | Distributed lock (Redis) prevents nonce racing in backend |
| **M-02** | Medium | On-chain `minOrder` / `maxOrder` bounds |
| **M-03** | Medium | `rescueERC20()` to recover stuck tokens |
| **M-04** | Medium | Explicit allowance check after `permit` try/catch |
| **M-05** | Medium | `receive()` reverts to reject unexpected ETH |
| **B-01** | Backend | Validate order amount against contract bounds before `createOrder` |
| **B-02** | Backend | Per-wallet rate limiting via Upstash Redis |
| **B-03** | Backend | Cryptographically secure order IDs via `nanoid` |
| **I-01** | Info | `getOrder()` view helper for easier integrations |
| **I-03** | Info | `Rescued` event emitted on token recovery |

**Additional Security:**
- **OpenZeppelin `Ownable2Step`** — Two-step ownership transfer prevents accidental loss
- **OpenZeppelin `ReentrancyGuard`** — Protects all state-changing external functions
- **OpenZeppelin `Pausable`** — Emergency circuit breaker
- **CEI Pattern** — State changes before external calls
- **Custom errors** — Gas-efficient error handling (no string storage)
- **Immutable USDC** — `usdc` address set once at deploy time

---

## Test Suite

The contract is tested with **10 test cases** covering:

| Category | Tests |
|---|---|
| **Positive flows** | Successful payment, multiple orders, allowance checks |
| **Input validation** | Zero amount, empty order ID |
| **Allowance checks** | Insufficient approval, insufficient balance |
| **Replay protection** | Same order ID from same buyer, same order ID from different buyers |
| **State verification** | Balance assertions, event emission, fulfillment mapping |

### Run Tests

```bash
cd contracts
forge test -vvv
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for smart contracts)
- A [Coinbase Developer Platform](https://www.coinbase.com/developer-platform) API key

### 1. Clone the Repository

```bash
git clone https://github.com/iarturo/ElaraPay.git
cd ElaraPay
```

### 2. Smart Contract Setup

```bash
cd contracts
cp .env.example .env
# Edit .env with your deployer key and USDC address
```

**Compile:**
```bash
forge build
```

**Test:**
```bash
forge test -vvv
```

**Deploy to Base Sepolia (with verification):**
```bash
source .env && forge script script/DeployGateway.s.sol:DeployGateway \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=84532" \
  --etherscan-api-key $BASESCAN_API_KEY
```

### 3. Frontend Setup

```bash
cd web
npm install
```

Create a `.env.local` file:
```env
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_coinbase_api_key
NEXT_PUBLIC_GATEWAY_ADDRESS=0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_CHAIN=sepolia
NEXT_PUBLIC_ALCHEMY_ID=your_alchemy_api_key
```

Create a `.env.server.local` file (server-side secrets):
```env
ADMIN_PRIVATE_KEY=0xYourAdminPrivateKey
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
```

**Run the development server:**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the storefront.

### 4. Backend Worker Setup

The worker listens for on-chain events and logs payments to Supabase.

```bash
cd worker
npm install
```

Create a `.env` file in the `worker` directory:
```env
ALCHEMY_WSS=wss://base-sepolia.g.alchemy.com/v2/your_alchemy_api_key
GATEWAY_ADDRESS=0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Run the worker:
```bash
node index.js
```

---

## Deployment

| Network | Contract | USDC Address | Chain ID |
|---|---|---|---|
| **Base Sepolia** | [`0x43EE62E...D684`](https://sepolia.basescan.org/address/0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 84532 |
| **Base Mainnet** | _Not yet deployed_ | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 8453 |

| Platform | URL |
|---|---|
| **Frontend** | [https://elarapay.xyz](https://elarapay.xyz) |
| **Contract (BaseScan)** | [View on BaseScan](https://sepolia.basescan.org/address/0x43EE62E72CDf8CD941AD8e7c20e8B384f6b3D684) |

To switch to **mainnet**, update the USDC address in your `.env` and change the chain configuration in `Providers.tsx` from `baseSepolia` to `base`.

---

## Webhook Notifications

ElaraPay supports sending real-time webhook notifications to the merchant's configured server immediately when a payment is received on-chain and indexed.

### Configuration

To enable webhooks, add the `WEBHOOK_URL` variable to your `.env` (for standalone worker) or `.env.local` (for Next.js worker):

```env
WEBHOOK_URL=https://your-merchant-server.com/api/payments/webhook
```

### Webhook Delivery & Retry Logic

- **Asynchronous Delivery**: The webhook is fired asynchronously immediately after database indexing to avoid blocking blockchain event listening.
- **Automatic Retries**: Failed deliveries (non-2xx response or network issues) are retried **up to 3 times** with **exponential backoff** (2 seconds, then 4 seconds delays).

### Payload Schema

Webhooks are delivered via `POST` with a JSON payload:

```json
{
  "orderId": "ord_1234567890abcdef",
  "amount": 120.00,
  "buyer": "0x0000000000000000000000000000000000000000",
  "txHash": "0x...",
  "timestamp": "2026-05-21T12:00:00.000Z"
}
```

---

## Roadmap

- [x] **Refund mechanism** — Admin-initiated refunds with on-chain audit trail
- [x] **Webhook notifications / indexing** — Node.js worker listens to events and pushes to Supabase
- [ ] **Multi-token support** — Accept ETH and other ERC-20s alongside USDC
- [ ] **Merchant dashboard** — Real-time order tracking via event indexing
- [ ] **Multi-merchant support** — Route payments to different merchants per product
- [ ] **Mainnet deployment** — Production launch on Base Mainnet

---

## Built With

<p align="center">
  <a href="https://base.org"><img src="https://img.shields.io/badge/Base-0052FF?style=for-the-badge&logo=coinbase&logoColor=white" alt="Base" /></a>
  <a href="https://www.circle.com/usdc"><img src="https://img.shields.io/badge/USDC-2775CA?style=for-the-badge&logo=circle&logoColor=white" alt="USDC" /></a>
  <a href="https://onchainkit.xyz"><img src="https://img.shields.io/badge/OnchainKit-0052FF?style=for-the-badge&logo=coinbase&logoColor=white" alt="OnchainKit" /></a>
  <a href="https://book.getfoundry.sh"><img src="https://img.shields.io/badge/Foundry-FFDB1C?style=for-the-badge&logoColor=black" alt="Foundry" /></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
</p>

---

## License

This project is licensed under the [MIT License](LICENSE).
2026

---

<p align="center">
  <sub>Built with 💙 on Base — bringing the world onchain, one payment at a time.</sub>
</p>
