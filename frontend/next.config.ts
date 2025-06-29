import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '4000',
                pathname: '/uploads/**',
            }
        ],
    },
    // allowedDevOrigins: ['http://192.168.1.33:3000'],
};

export default nextConfig;
