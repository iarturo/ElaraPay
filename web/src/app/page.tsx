'use client';

import { GATEWAY_ADDRESS, GATEWAY_ABI, USDC_ADDRESS, ACTIVE_CHAIN } from '@/lib/contracts';
import {
    ConnectWallet,
    Wallet,
    WalletDropdown,
    WalletDropdownDisconnect,
} from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';
import {
    Transaction,
    TransactionButton,
    TransactionStatus,
    TransactionStatusAction,
    TransactionStatusLabel,
} from '@coinbase/onchainkit/transaction';
import { parseUnits } from 'viem';
import { useState, useEffect } from 'react';
import Image from 'next/image';

/* ─── ERC-20 Approve ABI ─────────────────────────────── */
const USDC_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

/* ─── Product Catalog ─────────────────────────────────── */
interface Product {
    id: string;
    name: string;
    description: string;
    price: string;
    image: string;
    badge?: 'new' | 'bestseller' | 'limited';
    sizes: string[];
    colors: string[];
}

const PRODUCTS: Product[] = [
    {
        id: 'ORD-1001',
        name: 'Abstract Muse Tee',
        description: 'Minimalist abstract art on premium cotton. A wearable piece of art for the creative soul.',
        price: '25',
        image: '/products/tshirt-white-abstract.png',
        badge: 'bestseller',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#FFFFFF', '#F5F5F5', '#FDE8E8'],
    },
    {
        id: 'ORD-1002',
        name: 'Noir & Gold Edition',
        description: 'Elegant gold geometric patterns on deep black. For nights that demand attention.',
        price: '35',
        image: '/products/tshirt-black-gold.png',
        badge: 'limited',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: ['#1A1A1A', '#2D2D2D'],
    },
    {
        id: 'ORD-1003',
        name: 'Sage Oversized Tee',
        description: 'Relaxed oversized fit in calming sage green. Comfort meets effortless style.',
        price: '22',
        image: '/products/tshirt-sage-green.png',
        badge: 'new',
        sizes: ['S', 'M', 'L', 'XL'],
        colors: ['#9CAF88', '#B4C7A5', '#E8F0E3'],
    },
    {
        id: 'ORD-1004',
        name: 'Rose Garden Tee',
        description: 'Dusty rose with delicate floral embroidery. Romantic details meet modern silhouette.',
        price: '28',
        image: '/products/tshirt-dusty-rose.png',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#D4A0A0', '#E8C4C4', '#F5E1E1'],
    },
    {
        id: 'ORD-1005',
        name: 'Lavender Crop',
        description: 'Trendy cropped silhouette in soft lavender. Perfect for high-waist pairings.',
        price: '20',
        image: '/products/tshirt-lavender.png',
        badge: 'new',
        sizes: ['XS', 'S', 'M', 'L'],
        colors: ['#C4B5E0', '#D8CCF0', '#E8E0F5'],
    },
    {
        id: 'ORD-1006',
        name: 'Maritime Stripe Tee',
        description: 'Classic navy with crisp white sleeve stripes. Timeless nautical elegance reimagined.',
        price: '24',
        image: '/products/tshirt-navy-stripe.png',
        badge: 'bestseller',
        sizes: ['XS', 'S', 'M', 'L', 'XL'],
        colors: ['#1E3A5F', '#2C4F7C', '#FFFFFF'],
    },
];

/* ─── Product Card Component ──────────────────────────── */
function ProductCard({ product, index }: { product: Product; index: number }) {
    const [selectedSize, setSelectedSize] = useState(product.sizes[1] || product.sizes[0]);
    const [orderId, setOrderId] = useState(() => `${product.id}-${selectedSize}-${Date.now()}`);

    const priceInDecimals = parseUnits(product.price, 6);

    useEffect(() => {
        setOrderId(`${product.id}-${selectedSize}-${Date.now()}`);
    }, [selectedSize, product.id]);

    const contracts = [
        {
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'approve' as const,
            args: [GATEWAY_ADDRESS, priceInDecimals] as const,
        },
        {
            address: GATEWAY_ADDRESS,
            abi: GATEWAY_ABI,
            functionName: 'payForOrder' as const,
            args: [priceInDecimals, orderId] as const,
        },
    ];

    return (
        <div className={`product-card animate-fade-in-up stagger-${index + 1}`}>
            <div className="relative overflow-hidden bg-[#F8F8F8] aspect-[4/5]">
                <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="product-image object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                {product.badge && (
                    <span className={`badge badge-${product.badge} absolute top-4 left-4 z-10`}>
                        {product.badge === 'new' && '✦ New'}
                        {product.badge === 'bestseller' && '★ Bestseller'}
                        {product.badge === 'limited' && '◆ Limited'}
                    </span>
                )}
            </div>

            <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-semibold text-gray-900 leading-tight">
                        {product.name}
                    </h3>
                    <span className="text-base font-semibold text-gray-900 whitespace-nowrap">
                        ${product.price}
                        <span className="text- font-normal text-gray-400 ml-0.5">USDC</span>
                    </span>
                </div>

                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                    {product.description}
                </p>

                <div className="mb-4">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                        Size
                    </span>
                    <div className="flex gap-1.5">
                        {product.sizes.map((size) => (
                            <button
                                key={size}
                                onClick={() => setSelectedSize(size)}
                                className={`size-option ${selectedSize === size ? 'active' : ''}`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-5">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 block">
                        Color
                    </span>
                    <div className="flex gap-2">
                        {product.colors.map((color, i) => (
                            <div
                                key={i}
                                className="w-6 h-6 rounded-full border-2 border-gray-200 hover:border-gray-400 transition-colors cursor-pointer hover:scale-110"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>

                <Transaction
                    contracts={contracts}
                    className="w-full"
                    chainId={ACTIVE_CHAIN.id}
                    onSuccess={(response) => {
                        console.log("¡Pago exitoso! Hash:", response.transactionReceipts[0].transactionHash);
                        setOrderId(`${product.id}-${selectedSize}-${Date.now()}`);
                    }}
                >
                    <TransactionButton
                        className="w-full bg-gray-900 text-white hover:bg-gray-800 rounded-xl py-3 text-sm font-medium transition-all duration-200 hover:shadow-lg"
                        text={`Pay ${product.price} USDC`}
                    />
                    <TransactionStatus>
                        <TransactionStatusLabel />
                        <TransactionStatusAction />
                    </TransactionStatus>
                </Transaction>
            </div>
        </div>
    );
}

/* ─── Main Page ───────────────────────────────────────── */
export default function Home() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div className="min-h-screen bg-[#FAFAFA]" />;
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA]">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">É</span>
                            </div>
                            <span className="text-lg font-semibold tracking-tight text-gray-900">
                                ÉLARA
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <a href="#collection" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                                Collection
                            </a>
                            <a href="#about" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                                About
                            </a>
                            <a href="#sizing" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                                Size Guide
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 mr-2">
                                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                Base Sepolia
                            </div>
                            <Wallet>
                                <ConnectWallet className="!bg-gray-900!text-white!rounded-xl!px-4!py-2!text-sm!font-medium hover:!bg-gray-800!transition-all!duration-200!border-0">
                                    <Avatar className="h-5 w-5" />
                                    <Name />
                                </ConnectWallet>
                                <WalletDropdown>
                                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                                        <Avatar />
                                        <Name />
                                        <Address />
                                    </Identity>
                                    <WalletDropdownDisconnect />
                                </WalletDropdown>
                            </Wallet>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/30" />
                <div className="absolute top-20 right-20 w- h- bg-gradient-to-br from-violet-100/40 to-rose-100/40 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-20 w- h- bg-gradient-to-tr from-blue-100/30 to-cyan-100/30 rounded-full blur-3xl" />

                <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-12 pb-0 md:pt-16 md:pb-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-gray-200 shadow-sm mb-6 animate-fade-in">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span className="text-xs font-medium text-gray-600">
                                    Powered by Base · Pay with USDC
                                </span>
                            </div>

                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1] animate-fade-in-up">
                                Premium Tees,
                                <br />
                                <span className="bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                                    Designed for Her
                                </span>
                            </h1>

                            <p className="mt-5 text-lg text-gray-500 leading-relaxed max-w-lg animate-fade-in-up stagger-2">
                                Handcrafted t-shirts that blend artistry with comfort.
                                Each piece is a statement. Pay instantly with crypto — no banks, no borders.
                            </p>

                            <div className="flex items-center gap-6 mt-7 animate-fade-in-up stagger-3">
                                <a
                                    href="#collection"
                                    className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                                >
                                    Shop Collection
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </a>
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                    Secure on-chain payments
                                </div>
                            </div>
                        </div>

                        <div className="relative flex justify-center items-end animate-fade-in-up stagger-3">
                            <div className="relative w-full max-w-md mx-auto">
                                <img
                                    src="/products/hero-model.png"
                                    alt="Woman wearing ÉLARA premium t-shirt"
                                    width="500"
                                    height="600"
                                    style={{ width: '100%', height: 'auto', display: 'block' }}
                                    className="drop-shadow-2xl"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Bar */}
            <section className="border-y border-gray-100 bg-white">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
                    <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-gray-900 font-medium">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" /><path d="m16 8 5 3-5 3z" /></svg>
                            Free Shipping Worldwide
                        </div>
                        <div className="w-1 h-1 bg-gray-900 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                            Non-Custodial Payments
                        </div>
                        <div className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /></svg>
                            Premium 100% Cotton
                        </div>
                        <div className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /></svg>
                            30-Day Returns
                        </div>
                    </div>
                </div>
            </section>

            {/* Product Grid */}
            <section id="collection" className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24">
                <div className="text-center mb-14">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 mb-3 block">
                        Spring / Summer 2026
                    </span>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                        The Collection
                    </h2>
                    <p className="mt-4 text-gray-500 max-w-md mx-auto">
                        Six essential pieces designed with intention. Each t-shirt tells a story.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                    {PRODUCTS.map((product, i) => (
                        <ProductCard key={product.id} product={product} index={i} />
                    ))}
                </div>
            </section>

            {/* How It Works */}
            <section className="bg-white border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                            How It Works
                        </h2>
                        <p className="mt-4 text-gray-500 max-w-md mx-auto">
                            Three steps to your new favorite tee. No banks required.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {[
                            {
                                step: '01',
                                title: 'Connect Wallet',
                                desc: 'Link your Coinbase Smart Wallet or any Web3 wallet in one click.',
                                icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
                                ),
                            },
                            {
                                step: '02',
                                title: 'Choose & Pay',
                                desc: 'Pick your tee, select a size, and approve the USDC payment with one tap.',
                                icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 18V6" /></svg>
                                ),
                            },
                            {
                                step: '03',
                                title: 'Receive Your Tee',
                                desc: 'Your order is confirmed on-chain instantly. Free worldwide shipping included.',
                                icon: (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                                ),
                            },
                        ].map((item, i) => (
                            <div key={i} className="text-center group">
                                <div className="w-14 h-14 mx-auto mb-5 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-all duration-300">
                                    {item.icon}
                                </div>
                                <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                                    Step {item.step}
                                </span>
                                <h3 className="text-lg font-semibold text-gray-900 mt-2 mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-sm text-gray-500 leading-relaxed">
                                    {item.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-gray-900 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xs">É</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">ÉLARA</span>
                        <span className="text-xs text-gray-400 ml-2">
                            © 2026
                        </span>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-gray-400">
                        <span className="flex items-center gap-1.5">
                            Built on
                            <span className="font-semibold text-blue-500">Base</span>
                        </span>
                        <span>·</span>
                        <span>Non-custodial payments</span>
                        <span>·</span>
                        <span>USDC on Sepolia Testnet</span>
                    </div>
                </div>
            </footer>
        </div>
    );
}