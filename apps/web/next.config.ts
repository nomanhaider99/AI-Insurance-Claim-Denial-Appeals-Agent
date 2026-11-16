import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  // Monorepo: trace workspace deps (packages/shared) into the standalone bundle.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@appeal/shared'],
  poweredByHeader: false,
};

export default config;
