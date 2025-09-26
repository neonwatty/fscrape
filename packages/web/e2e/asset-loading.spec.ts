import { test, expect } from '@playwright/test';

test.describe('Asset Loading with basePath', () => {
  test.skip(
    () => process.env.NODE_ENV !== 'production',
    'These tests are designed for production builds with basePath'
  );

  test('no 404 errors for critical assets', async ({ page }) => {
    const failed404s: string[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();

      if (status === 404) {
        const isCritical =
          url.includes('sql-wasm.wasm') ||
          url.includes('sample.db') ||
          url.includes('manifest.json') ||
          url.includes('sw.js');

        if (isCritical) {
          failed404s.push(url);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (failed404s.length > 0) {
      console.log('Failed 404s:', failed404s);
    }

    expect(failed404s.length).toBe(0);
  });

  test('SQL.js WASM file has correct basePath', async ({ page }) => {
    const wasmRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('sql-wasm.wasm')) {
        wasmRequests.push(url);
      }
    });

    await page.goto('/');

    const loadSampleButton = page.getByRole('button', { name: /load sample data/i });
    if (await loadSampleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loadSampleButton.click();
      await page.waitForTimeout(3000);
    }

    if (wasmRequests.length > 0) {
      const wasmUrl = wasmRequests[0];
      expect(wasmUrl).toContain('/fscrape/sql-js/sql-wasm.wasm');
    }
  });

  test('manifest.json has correct basePath', async ({ page }) => {
    const manifestRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('manifest.json')) {
        manifestRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (manifestRequests.length > 0) {
      const manifestUrl = manifestRequests[0];
      expect(manifestUrl).toContain('/fscrape/manifest.json');
    }
  });

  test('service worker has correct basePath', async ({ page }) => {
    const swRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('sw.js')) {
        swRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (swRequests.length > 0) {
      const swUrl = swRequests[0];
      expect(swUrl).toContain('/fscrape/sw.js');
    }
  });

  test('all critical assets have basePath prefix', async ({ page }) => {
    const assetRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (
        url.includes('sql-wasm.wasm') ||
        url.includes('sample.db') ||
        url.includes('manifest.json') ||
        url.includes('sw.js')
      ) {
        assetRequests.push(url);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const missingBasePath = assetRequests.filter((url) => {
      const hasBasePath = url.includes('/fscrape/');
      const isLocalhost = url.includes('localhost');
      return !hasBasePath && !isLocalhost;
    });

    if (missingBasePath.length > 0) {
      console.log('Assets missing basePath:', missingBasePath);
    }

    expect(missingBasePath.length).toBe(0);
  });
});