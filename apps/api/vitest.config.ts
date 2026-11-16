import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: { LOG_LEVEL: 'silent' },
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    // PGlite boots Postgres in-process and runs the migrations per test file.
    hookTimeout: 60_000,
    // Each file runs its own PGlite (~150MB); cap concurrency to keep memory bounded.
    maxWorkers: 2,
    testTimeout: 30_000,
  },
});
