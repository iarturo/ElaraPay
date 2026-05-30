require('dotenv').config();
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

const { GATEWAY_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY, MERCHANT_WEBHOOK_URL } = process.env;
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.ALCHEMY_HTTP || 'https://sepolia.base.org';

const WebSocket = require('ws');

if (!GATEWAY_ADDRESS || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Faltan variables de entorno necesarias.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket }
});
const provider = new ethers.JsonRpcProvider(RPC_URL);

const gateway = new ethers.Contract(
    GATEWAY_ADDRESS,
    ['event PaymentReceived(address indexed buyer, string orderId, uint256 amount)'],
    provider
);

const CONFIRMATIONS = 2;
const POLL_INTERVAL_MS = 10_000;
const MAX_BLOCK_RANGE = 500; // M-04: límite de batch
const WEBHOOK_ATTEMPTS = 3;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getWorkerState = async () => {
    const { data, error } = await supabase.from('worker_state').select('last_block').eq('id', 1).single();
    if (error || !data) {
        console.log('⚠️ No state, iniciando desde bloque actual...');
        const current = await provider.getBlockNumber();
        await supabase.from('worker_state').upsert({ id: 1, last_block: current });
        return current;
    }
    return data.last_block;
};

const updateWorkerState = async (blockNumber) => {
    await supabase.from('worker_state').upsert({ id: 1, last_block: blockNumber });
};

const sendMerchantWebhookAttempt = async (webhookUrl, payload, fetchImpl) => {
    const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Merchant webhook responded ${response.status}`);
    }
};

const postMerchantWebhook = async (payload, options = {}) => {
    const webhookUrl = options.webhookUrl ?? MERCHANT_WEBHOOK_URL;
    if (!webhookUrl) {
        return { delivered: false, skipped: true, attempts: 0 };
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const sleepImpl = options.sleep ?? sleep;
    let lastError = null;

    for (let attempt = 1; attempt <= WEBHOOK_ATTEMPTS; attempt += 1) {
        try {
            await sendMerchantWebhookAttempt(webhookUrl, payload, fetchImpl);
            return { delivered: true, skipped: false, attempts: attempt };
        } catch (error) {
            lastError = error;
        }

        if (attempt < WEBHOOK_ATTEMPTS) {
            await sleepImpl(1000 * (2 ** (attempt - 1)));
        }
    }

    console.warn(`⚠️ Merchant webhook failed after ${WEBHOOK_ATTEMPTS} attempts: ${lastError?.message || 'unknown error'}`);
    return {
        delivered: false,
        skipped: false,
        attempts: WEBHOOK_ATTEMPTS,
        error: lastError?.message || 'unknown error',
    };
};

const processEvent = async (event) => {
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

    const payment = {
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
    };

    const { error } = await supabase.from('payments').insert(payment);
    if (error) {
        throw new Error(`Failed to index payment ${transactionHash}: ${error.message}`);
    }

    await postMerchantWebhook({
        orderId,
        amount: payment.amount,
        buyer: payment.payer,
        txHash: transactionHash,
        timestamp: new Date().toISOString(),
    });
};

const runPoller = async () => {
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
        await sleep(POLL_INTERVAL_MS);
    }
};

if (require.main === module) {
    console.log('🎧 ELARA Worker Poller LIVE');
    console.log('Gateway:', GATEWAY_ADDRESS);
    runPoller();
}

module.exports = {
    postMerchantWebhook,
    processEvent,
};
