// web/src/scripts/worker.ts
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// En producción, asegúrate de tener ALCHEMY_RPC_URL en tu .env.local
const ALCHEMY_URL = process.env.ALCHEMY_RPC_URL;

const ACTIVE_CHAIN = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia;
const GATEWAY_ADDRESS = process.env.NEXT_PUBLIC_GATEWAY_ADDRESS || "0x01bC3576301bB012458f9B1aED30Ecf435F72BCe";

const client = createPublicClient({
    chain: ACTIVE_CHAIN,
    transport: http(ALCHEMY_URL), // Si es undefined, usará el public RPC (puede tener límites de rate)
});

console.log(`📡 Iniciando worker para escuchar pagos en ${ACTIVE_CHAIN.name}...`);
console.log(`Contrato: ${GATEWAY_ADDRESS}`);

const unwatch = client.watchEvent({
    address: GATEWAY_ADDRESS as `0x${string}`,
    event: parseAbiItem('event PaymentReceived(address indexed buyer, string orderId, uint256 amount)'),
    onLogs: logs => {
        for (const log of logs) {
            const { buyer, orderId, amount } = log.args;
            console.log('\n✅ ¡NUEVO PAGO RECIBIDO!');
            console.log(`   Comprador: ${buyer}`);
            console.log(`   Orden: ${orderId}`);
            console.log(`   Monto: ${Number(amount) / 1e6} USDC`);
            console.log(`   TxHash: ${log.transactionHash}`);
            
            // TODO: Aquí debes conectar con tu base de datos (Postgres, Firebase, MongoDB)
            // y marcar la orden como "PAGADA" para que se procese el envío.
            // db.orders.update({ id: orderId }, { status: 'PAID', txHash: log.transactionHash });
        }
    },
    onError: error => console.error('Error escuchando eventos:', error)
});

// Mantener el proceso vivo
process.on('SIGINT', () => {
    console.log("Deteniendo worker...");
    unwatch();
    process.exit();
});
