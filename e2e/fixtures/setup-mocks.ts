/**
 * Setup mocks for E2E tests without external dependencies
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Create a mock configuration file that uses local test data
 */
export function setupMockConfig(testDir: string): string {
  const configPath = join(testDir, 'test-config.json');
  
  const config = {
    database: {
      path: join(testDir, 'test.db')
    },
    platforms: {
      reddit: {
        clientId: 'test_client_id',
        clientSecret: 'test_client_secret',
        userAgent: 'fscrape-test/1.0',
        testMode: true // This will tell the scraper to use mock data
      },
      hackernews: {
        testMode: true // This will tell the scraper to use mock data
      }
    },
    export: {
      defaultFormat: 'json',
      outputDirectory: join(testDir, 'exports')
    }
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Setup environment variables for test mode
 */
export function setupTestEnvironment(): void {
  process.env.FSCRAPE_TEST_MODE = 'true';
  process.env.NODE_ENV = 'test';
}

/**
 * Clean up test environment
 */
export function cleanupTestEnvironment(): void {
  delete process.env.FSCRAPE_TEST_MODE;
  delete process.env.NODE_ENV;
}