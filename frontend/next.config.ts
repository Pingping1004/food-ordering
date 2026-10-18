import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer"

// next.config.js
const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

/**
 * Baseline response headers. The CSP is Report-Only on purpose: it surfaces violations in the console / Sentry without
 * breaking Firebase, Supabase, Sentry or the QR / image hosts. Tighten and switch to enforcing once it runs clean.
 */
const securityHeaders = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
    ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
    {
        key: 'Content-Security-Policy-Report-Only',
        value: [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "img-src 'self' data: blob: https://images.promptserve.online https://api.qrserver.com",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "connect-src 'self' https://api.promptserve.online https://*.supabase.co wss://*.supabase.co https://*.googleapis.com https://*.ingest.us.sentry.io",
            "worker-src 'self' blob:",
        ].join('; '),
    },
];

const nextConfig: NextConfig = {
    // Lets perf runs build/serve beside a running `next dev` (which also writes to .next).
    distDir: process.env.NEXT_DIST_DIR || '.next',
    poweredByHeader: false,
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
    // async redirects() {
    //     return [
    //         {
    //             source: '/',
    //             destination: '/',
    //             permanent: true,
    //         },
    //     ];
    // },

    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: process.env.NODE_ENV === 'development' ? 'http://localhost:4000/api/:path*' : 'https://api.promptserve.online/api/:path*',
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.promptserve.online',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'api.qrserver.com',
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
      // Replay is not enabled, so don't ship its code; also strips Sentry's debug logging from the bundle.
      bundleSizeOptimizations: {
        excludeDebugStatements: true,
        excludeReplayIframe: true,
        excludeReplayShadowDom: true,
        excludeReplayWorker: true,
      },
      widenClientFileUpload: true,
      tunnelRoute: "/monitoring",
      disableLogger: true,
      automaticVercelMonitors: true,
    }
  )