import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for E2E tests
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests in sequence to avoid conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1, // Allow 1 retry even in local development
  workers: process.env.CI ? 1 : 3, // Limit workers to avoid resource conflicts
  reporter: 'html',
  timeout: 60000, // 60 seconds for CLI operations
  
  use: {
    // Base URL for the application
    baseURL: 'http://localhost:3000',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'cli-tests',
      use: {
        ...devices['Desktop Chrome'],
        // CLI tests don't need browser viewport
        viewport: null,
      },
    },
  ],

  /* No web server needed for CLI tests */
  // webServer: undefined,
});