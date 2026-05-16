import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseUnits, isAddress, getAddress } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '@/lib/products';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS!;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
    : null;

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'elara:create-order',
});

export async function POST(req: NextRequest) {
    try {
        // Rate limit by IP
        const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1';
        const { success } = await ratelimit.limit(ip);
        if (!success) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { productId, size, buyer } = await req.json();

        // Input validation
        if (!productId || typeof productId !== 'string') {
            return NextResponse.json({ error: 'Invalid productId' }, { status: 400 });
        }
        if (!size || typeof size !== 'string') {
            return NextResponse.json({ error: 'Invalid size' }, { status: 400 });
        }
        if (!buyer || !isAddress(buyer)) {
            return NextResponse.json({ error: 'Invalid buyer address' }, { status: 400 });
        }
        const buyerChecksum = getAddress(buyer);

        if (!process.env.ADMIN_PRIVATE_KEY) {
            throw new Error('ADMIN_PRIVATE_KEY is not set');
        }

        // 1. Secure price lookup: backend is source of truth
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const amount = parseUnits(product.price, 6);

        // 2. Idempotency: check for existing pending order
        if (supabase) {
            const { data: existing } = await supabase
                .from('pending_orders')
                .select('order_id,amount,tx_hash')
                .eq('buyer', buyerChecksum.toLowerCase())
                .eq('product_id', productId)
                .eq('size', size)
                .eq('status', 'Created')
                .limit(1)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({
                    orderId: existing.order_id,
                    amount: existing.amount,
                    tx: existing.tx_hash,
                    reused: true
                });
            }
        }

        // 3. Generate cryptographically secure ID
        const orderId = `${productId}-${size}-${crypto.randomUUID()}`;

        const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
        const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
        const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

        // 4. On-chain transaction
        const hash = await walletClient.writeContract({
            address: GATEWAY as `0x${string}`,
            abi: [{
                name: 'createOrder',
                type: 'function',
                stateMutability: 'nonpayable',
                inputs: [
                    { name: 'orderId', type: 'string' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'buyer', type: 'address' }
                ],
                outputs: []
            }],
            functionName: 'createOrder',
            args: [orderId, amount, buyerChecksum as `0x${string}`]
        });

        // 5. Wait for 1 confirmation with timeout
        await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
            timeout: 60_000
        });

        // 6. Persist order for idempotency
        if (supabase) {
            await supabase.from('pending_orders').insert({
                order_id: orderId,
                buyer: buyerChecksum.toLowerCase(),
                product_id: productId,
                size: size,
                amount: amount.toString(),
                status: 'Created',
                tx_hash: hash
            });
        }

        return NextResponse.json({ orderId, amount: amount.toString(), tx: hash });
    } catch (e: any) {
        console.error('Error creating order:', e);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}