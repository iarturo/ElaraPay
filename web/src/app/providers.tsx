'use client'

import { OnchainKitProvider } from '@coinbase/onchainkit'
import { baseSepolia, base } from 'viem/chains'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { coinbaseWallet } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'

const chain = process.env.NEXT_PUBLIC_CHAIN === 'mainnet' ? base : baseSepolia

const config = createConfig({
    chains: [chain],
    connectors: [coinbaseWallet({ appName: 'ÉLARA', preference: 'smartWalletOnly' })],
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC),
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_RPC),
    },
    ssr: true, // <-- importante para Next
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // No renderices NADA en servidor — evita el flash blanco
    if (!mounted) return null

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