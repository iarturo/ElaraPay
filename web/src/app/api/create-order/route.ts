import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS } from '@/lib/products';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS!;
const RPC = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
    try {
        const { productId, size, buyer } = await req.json();

        if (!process.env.ADMIN_PRIVATE_KEY) {
            throw new Error("ADMIN_PRIVATE_KEY is not set in environment");
        }

        // 1. Precio seguro: Lookup en el backend, no confiamos en el cliente
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) throw new Error("Producto no encontrado");
        
        const priceInDecimals = parseUnits(product.price, 6);
        const amount = priceInDecimals;

        // 2. Idempotencia: Verificar si ya existe una orden pendiente en Supabase
        if (supabase) {
            const { data: existingOrders } = await supabase
                .from('pending_orders')
                .select('*')
                .eq('buyer', buyer.toLowerCase())
                .eq('product_id', productId)
                .eq('size', size)
                .eq('status', 'Created')
                .limit(1);

            if (existingOrders && existingOrders.length > 0) {
                const existingOrder = existingOrders[0];
                return NextResponse.json({ 
                    orderId: existingOrder.order_id, 
                    amount: existingOrder.amount, 
                    tx: existingOrder.tx_hash,
                    reused: true
                });
            }
        }

        // 3. Generar ID criptográficamente seguro
        const orderId = `${productId}-${size}-${crypto.randomUUID()}`;

        const account = privateKeyToAccount(process.env.ADMIN_PRIVATE_KEY as `0x${string}`);
        const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC) });
        const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC) });

        // 4. Transacción on-chain
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
            args: [orderId, amount, buyer as `0x${string}`]
        });

        // 5. Espera de 1 confirmación antes de devolver el ID al frontend
        await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

        // 6. Guardar la orden en Supabase para futuras idas/vueltas (Idempotencia)
        if (supabase) {
            await supabase.from('pending_orders').insert({
                order_id: orderId,
                buyer: buyer.toLowerCase(),
                product_id: productId,
                size: size,
                amount: amount.toString(),
                status: 'Created',
                tx_hash: hash
            });
        }

        return NextResponse.json({ orderId, amount: amount.toString(), tx: hash });
    } catch (e: any) {
        console.error("Error creating order:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
