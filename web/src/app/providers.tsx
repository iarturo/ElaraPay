'use client'

import { OnchainKitProvider } from '@coinbase/onchainkit'
import { base, baseSepolia } from 'wagmi/chains'  // ← cambia viem → wagmi
import { WagmiProvider, createConfig, http } from 'wagmi'
import { coinbaseWallet } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    if (!mounted) return null

    const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia

    // Config con Alchemy separado por chain
    const config = createConfig({
        chains: [baseSepolia, base],  // ← pon ambas
        connectors: [coinbaseWallet({ appName: 'ÉLARA', preference: 'smartWalletOnly' })],
        transports: {
            [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`),
            [baseSepolia.id]: http(`https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_ID}`),
        },
        ssr: true,
    })

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
                    chain={chain}
                    config={{ appearance: { mode: 'light' } }}
                >
                    {children}
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    )
}