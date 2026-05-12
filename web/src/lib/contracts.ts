// src/lib/contracts.ts

// Addresses are loaded from environment variables for safe mainnet/testnet switching.
// Fallback to Base Sepolia addresses for development.
export const GATEWAY_ADDRESS =
    process.env.NEXT_PUBLIC_GATEWAY_ADDRESS ||
    "0x01bC3576301bB012458f9B1aED30Ecf435F72BCe";

export const USDC_SEPOLIA_ADDRESS =
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// The ABI: The instruction manual so your web app knows which functions exist
export const GATEWAY_ABI = [
    {
        "type": "constructor",
        "inputs": [{ "name": "_usdcAddress", "type": "address", "internalType": "address" }],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "checkAllowance",
        "inputs": [{ "name": "user", "type": "address", "internalType": "address" }],
        "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "orderFulfilled",
        "inputs": [{ "name": "orderId", "type": "string", "internalType": "string" }],
        "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address", "internalType": "address" }],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "payForOrder",
        "inputs": [
            { "name": "amount", "type": "uint256", "internalType": "uint256" },
            { "name": "orderId", "type": "string", "internalType": "string" }
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "usdc",
        "inputs": [],
        "outputs": [{ "name": "", "type": "address", "internalType": "contract IERC20" }],
        "stateMutability": "view"
    },
    {
        "type": "event",
        "name": "PaymentReceived",
        "inputs": [
            { "name": "buyer", "type": "address", "indexed": true, "internalType": "address" },
            { "name": "orderId", "type": "string", "indexed": false, "internalType": "string" },
            { "name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256" }
        ],
        "anonymous": false
    },
    { "type": "error", "name": "EmptyOrderId", "inputs": [] },
    {
        "type": "error",
        "name": "OrderAlreadyPaid",
        "inputs": [{ "name": "orderId", "type": "string", "internalType": "string" }]
    },
    { "type": "error", "name": "TransferFailed", "inputs": [] },
    { "type": "error", "name": "ZeroAmount", "inputs": [] },
    {
        "type": "error",
        "name": "InsufficientAllowance",
        "inputs": [
            { "name": "required", "type": "uint256", "internalType": "uint256" },
            { "name": "actual", "type": "uint256", "internalType": "uint256" }
        ]
    }
] as const; // This "as const" is mandatory for TypeScript to read the contract without errors