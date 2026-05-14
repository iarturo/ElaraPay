import { baseSepolia } from 'viem/chains'

// ✅ Una sola declaración - usa el objeto completo de viem (tiene .id, .name, .rpc, etc.)
export const ACTIVE_CHAIN = baseSepolia

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`
export const GATEWAY_ADDRESS = (process.env.NEXT_PUBLIC_GATEWAY_ADDRESS || '0x8502bB2EE17188735Eb6Ac6c6a67f89707feD6bf') as `0x${string}`

export const GATEWAY_ABI = [
    { "inputs": [{ "internalType": "address", "name": "_usdc", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" },
    { "inputs": [{ "internalType": "address", "name": "user", "type": "address" }], "name": "checkAllowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "paused", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "usdc", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    {
        "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "orders", "outputs": [
            { "internalType": "address", "name": "buyer", "type": "address" },
            { "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "internalType": "uint8", "name": "status", "type": "uint8" },
            { "internalType": "uint64", "name": "paidAt", "type": "uint64" }
        ], "stateMutability": "view", "type": "function"
    },
    { "inputs": [{ "internalType": "uint256", "name": "amount", "type": "uint256" }, { "internalType": "string", "name": "orderId", "type": "string" }], "name": "payForOrder", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    {
        "inputs": [
            { "internalType": "uint256", "name": "amount", "type": "uint256" },
            { "internalType": "string", "name": "orderId", "type": "string" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" },
            { "internalType": "uint8", "name": "v", "type": "uint8" },
            { "internalType": "bytes32", "name": "r", "type": "bytes32" },
            { "internalType": "bytes32", "name": "s", "type": "bytes32" }
        ], "name": "payWithPermit", "outputs": [], "stateMutability": "nonpayable", "type": "function"
    },
    { "inputs": [{ "internalType": "string", "name": "orderId", "type": "string" }], "name": "markShipped", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "string", "name": "orderId", "type": "string" }], "name": "refund", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "pause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "unpause", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    {
        "anonymous": false, "inputs": [
            { "indexed": true, "internalType": "address", "name": "buyer", "type": "address" },
            { "indexed": false, "internalType": "string", "name": "orderId", "type": "string" },
            { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
        ], "name": "PaymentReceived", "type": "event"
    }
] as const

export const USDC_ABI = [
    { "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "name": "account", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
] as const