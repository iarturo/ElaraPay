const fs = require('fs');

const header = `// src/lib/contracts.ts
import { base, baseSepolia } from 'viem/chains';

export const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia;
// Addresses are loaded from environment variables for safe mainnet/testnet switching.
export const GATEWAY_ADDRESS = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS as \`0x\${string}\`;
if (!GATEWAY_ADDRESS) console.error("Falta NEXT_PUBLIC_GATEWAY_ADDRESS");

export const USDC_ADDRESS = (ACTIVE_CHAIN.id === 8453
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // Base Mainnet
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as \`0x\${string}\`; // Sepolia

// The ABI: The instruction manual so your web app knows which functions exist
export const GATEWAY_ABI = `;

const artifactRaw = fs.readFileSync('contracts/out/BasePaymentGateway.sol/BasePaymentGateway.json', 'utf8');
const artifact = JSON.parse(artifactRaw);
const abiStr = JSON.stringify(artifact.abi, null, 4);

fs.writeFileSync('web/src/lib/contracts.ts', header + abiStr + ' as const;\n');
console.log("contracts.ts fixed successfully.");
