import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer"

// next.config.js
const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
    async redirects() {
        return [
            {
                source: '/',
                destination: '/login',
                permanent: true,
            },
        ];
    },

    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'https://api.promptserve.online/api/:path*',
                // destination: 'https://afbd008e22d3.ngrok-free.app/api/:path*'
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.promptserve.online',
                pathname: '/**',
            }
        ],
    },
};

export default withSentryConfig(
    withBundleAnalyzer(nextConfig),
    {
      org: "pings-org",
      project: "javascript-nextjs",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      disableLogger: true,
      automaticVercelMonitors: true,
    }
  )