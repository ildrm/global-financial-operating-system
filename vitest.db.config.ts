import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/integration/**/*.test.ts'], fileParallelism: false, testTimeout: 20000, reporters:['default','json'], outputFile:'docs/verification/database-results.json' } });
