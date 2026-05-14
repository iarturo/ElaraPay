/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@coinbase/onchainkit'],
    webpack: (config) => {
        config.externals.push('pino-pretty', 'lokijs', 'encoding');
        return config;
    },
};

module.exports = nextConfig;
