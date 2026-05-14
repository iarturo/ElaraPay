// src/components/Providers.tsx
'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { ACTIVE_CHAIN } from '@/lib/contracts';
import { base, baseSepolia } from 'viem/chains';
import { coinbaseWallet } from 'wagmi/connectors';
import { useState } from 'react';

const wagmiConfig = createConfig({
    chains: [base, baseSepolia],
    ssr: true,
    connectors: [
        coinbaseWallet({
            appName: 'Base Payment Gateway',
            preference: 'smartWalletOnly',
        }),
    ],
    transports: {
        [base.id]: http(),
        [baseSepolia.id]: http(),
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                    chain={ACTIVE_CHAIN}
                >
                    {children}
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}