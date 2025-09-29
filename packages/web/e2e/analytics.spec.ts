import { test, expect } from '@playwright/test';

test.describe('Analytics Page Removal', () => {
  test('analytics route returns 404', async ({ page }) => {
    // Navigate to the analytics page
    const response = await page.goto('/analytics');

    // The page should return 404 since it no longer exists
    expect(response?.status()).toBe(404);
  });

  test('heatmap is available on dashboard', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for database to load and heatmap section to appear
    await page.waitForSelector('h2:has-text("Posting Time Analysis")', { timeout: 10000 });

    // Check for heatmap section
    await expect(page.locator('h2:has-text("Posting Time Analysis")')).toBeVisible();
    await expect(page.locator('h3:has-text("Posting Time Heatmap")')).toBeVisible();

    // Check for heatmap tabs
    await expect(page.locator('button[role="tab"]:has-text("Heatmap View")')).toBeVisible();
    await expect(page.locator('button[role="tab"]:has-text("Optimal Times")')).toBeVisible();

    // Check for day labels in heatmap
    await expect(page.locator('text=Sun')).toBeVisible();
    await expect(page.locator('text=Mon')).toBeVisible();
    await expect(page.locator('text=Fri')).toBeVisible();
  });

  test('analytics navigation link removed from header', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that Analytics link is not in desktop navigation
    const analyticsLink = page.locator('nav a:has-text("Analytics")');
    await expect(analyticsLink).not.toBeVisible();

    // Verify remaining nav items exist
    await expect(page.locator('nav a:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Posts")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Compare")')).toBeVisible();
  });
});
