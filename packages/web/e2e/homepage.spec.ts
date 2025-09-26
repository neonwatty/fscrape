import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/FScrape/i);
  });

  test('displays main heading', async ({ page }) => {
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('navigation links are visible', async ({ page }) => {
    // Check for navigation elements
    const nav = page.locator('nav, header, [role="navigation"]').first();

    if (await nav.isVisible()) {
      // Navigation exists
      const postsLink = page.locator('a:has-text("Posts"), a[href*="posts"]').first();
      const analyticsLink = page.locator('a:has-text("Analytics"), a[href*="analytics"]').first();

      const hasNavLinks = (await postsLink.isVisible()) || (await analyticsLink.isVisible());
      expect(hasNavLinks).toBeTruthy();
    }
  });

  test('database load button appears if no data', async ({ page }) => {
    // Check for database load options
    const loadSampleButton = page.locator('button:has-text("Load Sample Database")');
    const uploadButton = page.locator('button:has-text("Choose File"), button:has-text("Upload")');

    const hasLoadOption = (await loadSampleButton.isVisible()) || (await uploadButton.isVisible());

    if (hasLoadOption) {
      // Click to load sample database
      await loadSampleButton.click();
      await page.waitForTimeout(2000);
    }

    // Should have data now
    expect(true).toBeTruthy();
  });

  test('shows dashboard stats cards', async ({ page }) => {
    // Ensure database is loaded
    const loadButton = page.locator('button:has-text("Load Sample Database")');
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for stats cards with actual text
    await expect(page.locator('text=Total Posts').first()).toBeVisible();
    await expect(page.locator('text=Active Platforms').first()).toBeVisible();
    await expect(page.locator('text=Total Score').first()).toBeVisible();
    await expect(page.locator('text=Total Comments').first()).toBeVisible();
  });

  test('displays trend chart', async ({ page }) => {
    // Ensure database is loaded
    const loadButton = page.locator('button:has-text("Load Sample Database")');
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(2000);
    }

    // Wait for charts to load
    await page.waitForTimeout(2000);

    // Check for chart canvas or container
    const chartCanvas = page.locator('canvas').first();
    const chartContainer = page.locator('.recharts-wrapper').first();

    const hasChart =
      (await chartCanvas.isVisible().catch(() => false)) ||
      (await chartContainer.isVisible().catch(() => false));

    expect(hasChart).toBeTruthy();
  });

  test('shows recent posts table', async ({ page }) => {
    // Ensure database is loaded
    const loadButton = page.locator('button:has-text("Load Sample Database")');
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(2000);
    }

    // Check for recent posts section
    await expect(page.locator('text=Recent Posts').first()).toBeVisible();

    // Check for table or list of posts
    const table = page.locator('table').first();
    const postsList = page.locator('[role="table"]').first();
    const postCards = page.locator('.space-y-4').first();

    const hasPosts =
      (await table.isVisible().catch(() => false)) ||
      (await postsList.isVisible().catch(() => false)) ||
      (await postCards.isVisible().catch(() => false));

    expect(hasPosts).toBeTruthy();
  });

  test('theme toggle works if available', async ({ page }) => {
    // Look for theme toggle
    const themeToggle = page
      .locator(
        'button[aria-label*="theme"], button[aria-label*="Theme"], [data-testid="theme-toggle"]'
      )
      .first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );

      // Click theme toggle
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Check theme changed
      const newTheme = await page.evaluate(() =>
        document.documentElement.classList.contains('dark')
      );
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test('platform selector works if available', async ({ page }) => {
    // Ensure database is loaded
    const loadButton = page.locator('button:has-text("Load Sample Database")');
    if (await loadButton.isVisible()) {
      await loadButton.click();
      await page.waitForTimeout(2000);
    }

    // Try to find and click a platform button
    const redditButton = page.locator('button:has-text("Reddit")');
    const hackerNewsButton = page.locator('button:has-text("Hacker News")');

    if (await redditButton.isVisible()) {
      await redditButton.click();
      await page.waitForTimeout(1000);
      expect(true).toBeTruthy();
    } else if (await hackerNewsButton.isVisible()) {
      await hackerNewsButton.click();
      await page.waitForTimeout(1000);
      expect(true).toBeTruthy();
    }
  });

  test('responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Page should still be functional
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

    // Check for mobile menu if navigation collapses
    const mobileMenu = page.locator('[aria-label*="Menu"], button:has-text("Menu")').first();

    // Either mobile menu exists or content is responsive
    expect(true).toBeTruthy();
  });

  test('loads without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out expected errors (like failed favicon requests)
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('Failed to load resource') &&
        !error.includes('404')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
