import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@coinbase/onchainkit/styles.css';
import { Providers } from "@/components/Providers";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "ÉLARA — Premium Women's T-Shirts | Pay with Crypto",
    description: "Discover handcrafted women's t-shirts designed for the modern woman. Pay seamlessly with USDC on Base.",
    keywords: ["women's t-shirts", "premium clothing", "crypto payments", "USDC", "Base blockchain"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={inter.variable} suppressHydrationWarning>
            <body className={inter.className} suppressHydrationWarning>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}