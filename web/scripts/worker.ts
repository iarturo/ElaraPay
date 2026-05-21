// web/scripts/worker.ts
import { createPublicClient, http, webSocket, parseAbiItem } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import ws from 'ws'

// Load env
dotenv.config({ path: '.env.local' })

// Fix for Node 20 WebSocket
declare global {
  var WebSocket: typeof ws
}

global.WebSocket = ws

// --- Config ---
const ALCHEMY_URL = process.env.ALCHEMY_RPC_URL
const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia
const GATEWAY_ADDRESS = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS as `0x${string}`
const WEBHOOK_URL = process.env.WEBHOOK_URL

function isString(value: unknown): value is string {
    return typeof value === 'string';
}

if (!isString(process.env.SUPABASE_URL) || !isString(process.env.SUPABASE_SERVICE_KEY)) {
    throw new Error('Environment variables SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

// --- Use WebSocket if URL starts with wss ---
const client = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: ALCHEMY_URL?.startsWith('wss')
        ? webSocket(ALCHEMY_URL)        // <-- AQUÍ va la línea
        : http(ALCHEMY_URL || undefined),
})

async function sendWebhook(url: string, payload: any, attempt = 1): Promise<void> {
    if (!url) return;
    try {
        console.log(`📡 Sending webhook to ${url} (Attempt ${attempt}/3)...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('✅ Webhook delivered successfully!');
    } catch (error: any) {
        console.error(`❌ Webhook delivery failed (Attempt ${attempt}/3):`, error.message);
        if (attempt < 3) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendWebhook(url, payload, attempt + 1);
        } else {
            console.error('❌ Max webhook retry attempts reached. Delivery failed.');
        }
    }
}

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

            if (WEBHOOK_URL && orderId) {
                const payload = {
                    orderId: orderId,
                    amount: Number(amount) / 1e6,
                    buyer: buyer?.toLowerCase(),
                    txHash: log.transactionHash,
                    timestamp: new Date().toISOString()
                };
                sendWebhook(WEBHOOK_URL, payload).catch(err => {
                    console.error('Error in sendWebhook call:', err);
                });
            }
        }
    },
    onError: (error) => console.error('Watcher Error:', error)
})

process.on('SIGINT', () => {
    unwatch()
    process.exit(0)
})