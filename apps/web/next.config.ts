import path from 'node:path';
import type { NextConfig } from 'next';

/** The Next.js server proxies API calls, so the browser only talks to one origin (first-party cookies). */
const apiTarget = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: trace workspace deps (packages/shared) into the standalone bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@appeal/shared'],
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'Referrer-Policy', value: 'same-origin' }] },
      // These pages carry one-time tokens in their URL: never send it as Referer.
      ...['/reset-password', '/accept-invite'].map((source) => ({
        source,
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      })),
    ];
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiTarget}/api/:path*` },
      { source: '/health', destination: `${apiTarget}/health` },
      { source: '/health/:path*', destination: `${apiTarget}/health/:path*` },
    ];
  },
};

export default config;
