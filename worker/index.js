require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

const { GATEWAY_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.ALCHEMY_HTTP || 'https://sepolia.base.org';

if (!GATEWAY_ADDRESS || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Faltan variables de entorno necesarias (GATEWAY_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY).");
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
const POLL_INTERVAL_MS = 10000; // 10 segundos

async function getWorkerState() {
    let { data, error } = await supabase.from('worker_state').select('last_block').eq('id', 1).single();
    
    if (error || !data) {
        console.log('⚠️ No se encontró estado inicial en worker_state. Iniciando desde el bloque actual...');
        const current = await provider.getBlockNumber();
        // Upsert requiere llave primaria. Asumimos id=1
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
    
    // 1. Manejo de re-orgs y backfill (idempotencia)
    const { data: existing } = await supabase
        .from('payments')
        .select('id, block_hash, status')
        .eq('tx_hash', transactionHash)
        .single();
    
    if (existing) {
        if (existing.block_hash !== blockHash) {
            // Re-org detectado: El hash del bloque cambió en la cadena canónica
            console.warn(`⚠️ Re-org detectado para ${transactionHash}! Marcando como reorged.`);
            await supabase.from('payments').update({ status: 'reorged', block_hash: blockHash }).eq('id', existing.id);
        } else {
            // Ya fue procesado y sigue en el mismo bloque (Cadena Canónica)
        }
        return;
    }

    console.log(`\n💰 Pago Confirmado: ${amountUSDC} USDC | Orden: ${orderId} | Comprador: ${buyer.slice(0, 8)}...`);

    // 2. Insertar nuevo pago confirmado
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
    console.log(`✅ Poller iniciado. Esperando ${CONFIRMATIONS} confirmaciones por transacción...`);
    
    while (true) {
        try {
            const currentBlock = await provider.getBlockNumber();
            const safeBlock = currentBlock - CONFIRMATIONS;
            const lastProcessedBlock = await getWorkerState();

            if (safeBlock > lastProcessedBlock) {
                const fromBlock = lastProcessedBlock + 1;
                const toBlock = safeBlock;

                // Evitar queries inmensas si el worker estuvo apagado mucho tiempo
                if (toBlock - fromBlock > 2000) {
                    console.log(`⏭️ Demasiados bloques atrasados. Procesando batch seguro...`);
                    // Podrías implementar lógica de batching aquí, para este demo procesamos todo directo o limitamos el toBlock
                }

                console.log(`🔍 Consultando bloques ${fromBlock} a ${toBlock}...`);

                const logs = await gateway.queryFilter('PaymentReceived', fromBlock, toBlock);
                
                for (const log of logs) {
                    await processEvent(log);
                }

                // Guardar progreso en BD
                await updateWorkerState(toBlock);
            }
        } catch (error) {
            console.error('❌ Error en el ciclo del poller:', error.message);
        }

        // Esperar 10 segundos antes del siguiente ciclo
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

runPoller();