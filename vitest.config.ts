import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      'coverage',
      'e2e/**/*',
      '**/*.e2e.{test,spec}.ts',
      'playwright-report',
      'test-results',
      'tests/cli/**/*.test.ts' // Temporarily exclude CLI tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'coverage',
        'e2e',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        'tests/**/*'
      ]
    }
  }
});