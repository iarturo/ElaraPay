require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

const { GATEWAY_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.ALCHEMY_HTTP || 'https://sepolia.base.org';

if (!GATEWAY_ADDRESS || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Faltan variables de entorno necesarias.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const provider = new ethers.JsonRpcProvider(RPC_URL);

console.log('🎧 ELARA Worker Poller LIVE');
console.log('Gateway:', GATEWAY_ADDRESS);

const gateway = new ethers.Contract(
    GATEWAY_ADDRESS,
    ['event PaymentReceived(address indexed buyer, string orderId, uint256 amount)'],
    provider
);

const CONFIRMATIONS = 2;
const POLL_INTERVAL_MS = 10_000;
const MAX_BLOCK_RANGE = 500; // M-04: límite de batch

async function getWorkerState() {
    const { data, error } = await supabase.from('worker_state').select('last_block').eq('id', 1).single();
    if (error || !data) {
        console.log('⚠️ No state, iniciando desde bloque actual...');
        const current = await provider.getBlockNumber();
        await supabase.from('worker_state').upsert({ id: 1, last_block: current });
        return current;
    }
    return data.last_block;
}

async function updateWorkerState(blockNumber) {
    await supabase.from('worker_state').upsert({ id: 1, last_block: blockNumber });
}

async function processEvent(event) {
    const { args: [buyer, orderId, amount], transactionHash, blockNumber, blockHash } = event;
    const amountUSDC = ethers.formatUnits(amount, 6);

    const { data: existing } = await supabase
        .from('payments')
        .select('id, block_hash')
        .eq('tx_hash', transactionHash)
        .maybeSingle();

    if (existing) {
        if (existing.block_hash !== blockHash) {
            console.warn(`⚠️ Re-org detectado para ${transactionHash}`);
            await supabase.from('payments').update({ status: 'reorged', block_hash: blockHash }).eq('id', existing.id);
        }
        return;
    }

    console.log(`\n💰 Pago: ${amountUSDC} USDC | Orden: ${orderId} | ${buyer.slice(0, 8)}...`);

    await supabase.from('payments').insert({
        payer: buyer.toLowerCase(),
        amount: parseFloat(amountUSDC),
        token: 'USDC',
        tx_hash: transactionHash,
        block_hash: blockHash,
        block_number: blockNumber,
        gateway: GATEWAY_ADDRESS.toLowerCase(),
        chain: 'base-sepolia',
        status: 'confirmed',
        order_id: orderId
    });
}

async function runPoller() {
    console.log(`✅ Poller iniciado. ${CONFIRMATIONS} confirmaciones.`);
    while (true) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const safeBlock = currentBlock - CONFIRMATIONS;
            const lastProcessedBlock = await getWorkerState();

            if (safeBlock > lastProcessedBlock) {
                const fromBlock = lastProcessedBlock + 1;
                // M-04: cap del rango
                const toBlock = Math.min(safeBlock, fromBlock + MAX_BLOCK_RANGE - 1);

                console.log(`🔍 Consultando bloques ${fromBlock} a ${toBlock}...`);

                const logs = await gateway.queryFilter('PaymentReceived', fromBlock, toBlock);

                for (const log of logs) {
                    await processEvent(log);
                }
                await updateWorkerState(toBlock);
            }
        } catch (error) {
            console.error('❌ Error en poller:', error.message);
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
}

runPoller();