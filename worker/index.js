require('dotenv').config();
const { ethers } = require('ethers');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

const { ALCHEMY_WSS, GATEWAY_ADDRESS, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: { transport: ws }
});
const provider = new ethers.WebSocketProvider(ALCHEMY_WSS);

console.log('🎧 ELARA Worker LIVE');
console.log('Gateway:', GATEWAY_ADDRESS);

const gateway = new ethers.Contract(
  GATEWAY_ADDRESS,
  ['event PaymentReceived(address indexed payer, string orderId, uint256 amount)'],
  provider
);

gateway.on('PaymentReceived', async (payer, orderId, amount, event) => {
  const amountUSDC = ethers.formatUnits(amount, 6);

  console.log(`\n💰 ${amountUSDC} USDC | ${orderId} | ${payer.slice(0, 8)}...`);

  await supabase.from('payments').insert({
    payer: payer.toLowerCase(),
    amount: parseFloat(amountUSDC),
    token: 'USDC',
    tx_hash: event.log.transactionHash,
    block_number: event.log.blockNumber,
    gateway: GATEWAY_ADDRESS.toLowerCase(),
    chain: 'base-sepolia',
    status: 'confirmed',
    order_id: orderId
  });
});

console.log('✅ Waiting for payments...');