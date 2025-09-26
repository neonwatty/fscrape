import { test, expect } from '@playwright/test';

test.describe('Asset Loading with basePath', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads SQL.js WASM file successfully', async ({ page }) => {
    const wasmRequests: string[] = [];
    const failedRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('sql-wasm.wasm')) {
        wasmRequests.push(url);
      }
    });

    page.on('requestfailed', (request) => {
      const url = request.url();
      if (url.includes('sql-wasm.wasm')) {
        failedRequests.push(url);
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    expect(wasmRequests.length).toBeGreaterThan(0);
    expect(failedRequests.length).toBe(0);

    const wasmUrl = wasmRequests[0];
    if (process.env.NODE_ENV === 'production') {
      expect(wasmUrl).toContain('/fscrape/sql-js/sql-wasm.wasm');
    } else {
      expect(wasmUrl).toContain('/sql-js/sql-wasm.wasm');
    }
  });

  test('database file loads from correct path', async ({ page }) => {
    const dbRequests: string[] = [];
    const dbResponses: { url: string; status: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('sample.db') || url.includes('/data/')) {
        dbResponses.push({
          url,
          status: response.status(),
        });
      }
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('sample.db') || url.includes('/data/')) {
        dbRequests.push(url);
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    if (dbRequests.length > 0) {
      const dbUrl = dbRequests[0];
      if (process.env.NODE_ENV === 'production') {
        expect(dbUrl).toContain('/fscrape/data/sample.db');
      } else {
        expect(dbUrl).toContain('/data/sample.db');
      }

      const successResponses = dbResponses.filter((r) => r.status === 200);
      expect(successResponses.length).toBeGreaterThan(0);
    }
  });

  test('manifest.json loads from correct path', async ({ page }) => {
    const manifestRequests: string[] = [];
    const manifestResponses: { url: string; status: number }[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('manifest.json')) {
        manifestResponses.push({
          url,
          status: response.status(),
        });
      }
    });

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('manifest.json')) {
        manifestRequests.push(url);
      }
    });

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    if (manifestRequests.length > 0) {
      const manifestUrl = manifestRequests[0];
      if (process.env.NODE_ENV === 'production') {
        expect(manifestUrl).toContain('/fscrape/manifest.json');
      } else {
        expect(manifestUrl).toContain('/manifest.json');
      }
    }
  });

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
    await page.waitForTimeout(3000);

    if (failed404s.length > 0) {
      console.log('Failed 404s:', failed404s);
    }

    expect(failed404s.length).toBe(0);
  });

  test('database initializes without errors', async ({ page }) => {
    const dbErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && text.includes('database')) {
        dbErrors.push(text);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const relevantErrors = dbErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        error.toLowerCase().includes('database') &&
        (error.includes('failed') || error.includes('error'))
    );

    if (relevantErrors.length > 0) {
      console.log('Database errors found:', relevantErrors);
    }

    expect(relevantErrors.length).toBe(0);
  });

  test('SQL.js initializes successfully', async ({ page }) => {
    const sqlJsLogs: string[] = [];
    const sqlJsErrors: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('SQL.js') || text.includes('wasm')) {
        if (msg.type() === 'error') {
          sqlJsErrors.push(text);
        } else {
          sqlJsLogs.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const criticalErrors = sqlJsErrors.filter(
      (error) => error.includes('failed') || error.includes('Aborted')
    );

    if (criticalErrors.length > 0) {
      console.log('SQL.js errors:', criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test('service worker path is correct in production', async ({ page }) => {
    if (process.env.NODE_ENV !== 'production') {
      test.skip();
      return;
    }

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

  test('all asset paths have correct basePath prefix', async ({ page }) => {
    if (process.env.NODE_ENV !== 'production') {
      test.skip();
      return;
    }

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
    await page.waitForTimeout(3000);

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

  test.skip('NEXT_PUBLIC_BASE_PATH environment variable is set correctly', async ({ page }) => {
    await page.goto('/');

    const basePath = await page.evaluate(() => {
      return (window as any).__NEXT_DATA__?.props?.pageProps?.basePath || '';
    });

    if (process.env.NODE_ENV === 'production') {
      expect(basePath).toBe('/fscrape');
    } else {
      expect(basePath).toBe('');
    }
  });
});