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

This project is a working proof of concept: a premium e-commerce storefront (**ÉLARA**) that accepts USDC payments on Base through a smart contract, using **Coinbase OnchainKit** for wallet connectivity, **Circle's USDC** as the settlement currency, and a **Node.js + Supabase worker** to track and index orders automatically.

---

## Live Demo

> **Network:** Base Sepolia Testnet  
> **Contract:** [`0xAB87C048805DCc643C4C6aa30E98F1B3E75C10c9`](https://sepolia.basescan.org/address/0xAB87C048805DCc643C4C6aa30E98F1B3E75C10c9)

---

## Key Features

| Feature | Details |
|---|---|
| **Non-Custodial** | Funds go directly from buyer → merchant via `transferFrom`. The contract never holds funds. |
| **USDC Native** | Built for Circle's USDC on Base. Stable, predictable, and denominated in dollars. |
| **Replay Protection** | Each `orderId` can only be paid once. Prevents double-charge attacks at the contract level. |
| **CEI Pattern** | Follows the Checks-Effects-Interactions pattern to mitigate reentrancy vulnerabilities. |
| **Gas Optimized** | Custom errors instead of `require` strings. Immutable state variables. Minimal storage footprint. |
| **OnchainKit Integration** | Coinbase Smart Wallet support via `@coinbase/onchainkit` — one-click wallet connection. |
| **Event-Driven Fulfillment** | Emits `PaymentReceived` events that a dedicated Node.js backend listens to and indexes into Supabase for order fulfillment. |
| **Admin Controls** | Includes admin functions to mark orders as shipped, or to process full refunds on-chain. |

---

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                     ÉLARA Storefront                     │
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
3. OnchainKit batches two calls into one user approval:
   - `USDC.approve(gateway, amount)` — authorize the gateway to spend
   - `gateway.payForOrder(amount, orderId)` — execute the payment
4. The contract validates the order, marks it as fulfilled, emits `PaymentReceived`, and transfers USDC directly to the merchant
5. A **Node.js backend worker** listens for the event via Alchemy WebSockets, parses the `orderId` and `amount`, and stores the confirmed order directly into a **Supabase** database.

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
│   │   └── BasePaymentGateway.sol    # Core payment router contract
│   ├── test/
│   │   └── Gateway.t.sol             # Comprehensive Forge test suite
│   ├── script/
│   │   └── DeployGateway.s.sol       # Deployment script
│   ├── foundry.toml                  # Forge configuration
│   └── .env.example                  # Environment variable template
│
├── web/                          # Next.js storefront
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Main storefront (ÉLARA)
│   │   │   ├── layout.tsx            # Root layout with Providers
│   │   │   └── globals.css           # Design system + animations
│   │   ├── components/
│   │   │   └── Providers.tsx         # wagmi + OnchainKit + React Query
│   │   └── lib/
│   │       └── contracts.ts          # ABI + contract addresses
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

A single, focused contract with one job: **route USDC from buyer to merchant, reliably.**

```solidity
function payForOrder(uint256 amount, string calldata orderId) external {
    // ── Checks ──
    if (amount == 0) revert ZeroAmount();
    if (bytes(orderId).length == 0) revert EmptyOrderId();

    bytes32 id = keccak256(bytes(orderId));
    if (orders[id].status != Status.None) revert OrderAlreadyPaid();

    // ── Effects (state change BEFORE external call — CEI) ──
    orders[id] = Order(msg.sender, amount, Status.Paid, uint64(block.timestamp));

    // ── Interactions (external call LAST) ──
    usdc.safeTransferFrom(msg.sender, owner(), amount);

    emit PaymentReceived(msg.sender, orderId, amount);
}
```

**Security highlights:**
- **CEI pattern** — State changes before external calls to prevent reentrancy
- **Replay protection** — `orders` mapping prevents double payments
- **Custom errors** — Gas-efficient error handling (no string storage)
- **Immutable state** — `owner` and `usdc` are set once at deploy time

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
git clone https://github.com/iarturo/base-payment-gateway.git
cd base-payment-gateway
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

**Deploy to Base Sepolia:**
```bash
forge script script/DeployGateway.s.sol:DeployGateway \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --broadcast \
  --verify
```

### 3. Frontend Setup

```bash
cd web
npm install
```

Create a `.env.local` file:
```env
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_coinbase_api_key
NEXT_PUBLIC_GATEWAY_ADDRESS=0xYourDeployedGatewayAddress
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_ALCHEMY_ID=your_alchemy_api_key
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
GATEWAY_ADDRESS=0xYourDeployedGatewayAddress
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

Run the worker:
```bash
node index.js
```

---

## Deployment

| Network | USDC Address | Chain ID |
|---|---|---|
| **Base Sepolia** | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | 84532 |
| **Base Mainnet** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 8453 |

To switch to **mainnet**, update the USDC address in your `.env` and change the chain configuration in `Providers.tsx` from `baseSepolia` to `base`.

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

---

<p align="center">
  <sub>Built with 💙 on Base — bringing the world onchain, one payment at a time.</sub>
</p>
