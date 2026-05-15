// web/scripts/worker.ts
import { createPublicClient, http, webSocket, parseAbiItem } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import ws from 'ws'

// Load env
dotenv.config({ path: '.env.local' })

    // Fix for Node 20 WebSocket
    ; (global as any).WebSocket = ws

// --- Config ---
const ALCHEMY_URL = process.env.ALCHEMY_RPC_URL
const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia
const GATEWAY_ADDRESS = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS as `0x${string}`

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
)

// --- Use WebSocket if URL starts with wss ---
const client = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: ALCHEMY_URL?.startsWith('wss')
        ? webSocket(ALCHEMY_URL)        // <-- AQUÍ va la línea
        : http(ALCHEMY_URL || undefined),
})

console.log(`📡 ELARA Worker listening on ${ACTIVE_CHAIN.name}`)
console.log(`Contract: ${GATEWAY_ADDRESS}`)

const unwatch = client.watchEvent({
    address: GATEWAY_ADDRESS,
    event: parseAbiItem('event PaymentReceived(address indexed buyer, string orderId, uint256 amount)'),
    onLogs: async (logs) => {
        for (const log of logs) {
            const { buyer, orderId, amount } = log.args
            console.log('\n✅ PAYMENT RECEIVED!')
            console.log(`  Order: ${orderId}`)
            console.log(`  Amount: ${Number(amount) / 1e6} USDC`)

            await supabase.from('orders').upsert({
                id: orderId,
                buyer: buyer?.toLowerCase(),
                amount: Number(amount) / 1e6,
                status: 'PAID',
                tx_hash: log.transactionHash,
                paid_at: new Date().toISOString(),
                chain_id: ACTIVE_CHAIN.id
            }, { onConflict: 'id' })

            console.log('💾 Saved to Supabase')
        }
    },
    onError: (error) => console.error('Watcher Error:', error)
})

process.on('SIGINT', () => {
    unwatch()
    process.exit(0)
})