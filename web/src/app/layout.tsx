import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import '@coinbase/onchainkit/styles.css';
import { Providers } from "./providers";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "ELARA — Premium Women's T-Shirts | Pay with Crypto",
    description: "Discover handcrafted women's t-shirts designed for the modern woman. Pay seamlessly with USDC on Base.",
    keywords: ["women's t-shirts", "premium clothing", "crypto payments", "USDC", "Base blockchain"],
    other: {
        "talentapp:project_verification": "fa42e3ff37f1a945aae70c3e2d2f48bcaf9cf394176094cdd8f918f6bf6056bcb06ca3e518cae8e54a50d663ad3b0706889ebef37bdaeca5599312f2bff00f72",
    },
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