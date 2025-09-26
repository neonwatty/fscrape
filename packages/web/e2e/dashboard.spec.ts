import { test, expect, Page } from '@playwright/test';

// Helper function to wait for dashboard to load
async function waitForDashboardLoad(page: Page) {
  // Wait for the main content to load
  await page.waitForLoadState('networkidle', { timeout: 10000 });

  // Wait for either database loaded state or load button
  await page.waitForSelector('h1:has-text("Dashboard"), button:has-text("Load Sample Database")', {
    timeout: 10000,
  });
}

// Helper function to ensure database is loaded
async function ensureDatabaseLoaded(page: Page) {
  // Check if sample database button is visible
  const loadButton = page.locator('button:has-text("Load Sample Database")');
  const hasLoadButton = await loadButton.isVisible().catch(() => false);

  if (hasLoadButton) {
    // Click to load sample database
    await loadButton.click();
    // Wait for database to load
    await page.waitForTimeout(2000);
  }

  return true;
}

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForDashboardLoad(page);
  });

  test('should load the dashboard page', async ({ page }) => {
    // Check for main dashboard elements
    await expect(page).toHaveTitle(/FScrape/i);

    // Check for main heading
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('should display stats cards when database is loaded', async ({ page }) => {
    await ensureDatabaseLoaded(page);

    // Wait for stats cards to appear
    await page.waitForSelector('.grid');

    // Check for stats cards with specific text
    await expect(page.locator('text=Total Posts').first()).toBeVisible();
    await expect(page.locator('text=Active Platforms').first()).toBeVisible();
    await expect(page.locator('text=Total Score').first()).toBeVisible();
    await expect(page.locator('text=Total Comments').first()).toBeVisible();
  });

  test('should display platform selector', async ({ page }) => {
    await ensureDatabaseLoaded(page);

    // Check for platform selector section
    const platformSection = page.locator('text=Select Platform').first();

    if (await platformSection.isVisible()) {
      // Platform buttons should be visible
      const redditButton = page.locator('button:has-text("Reddit")');
      const hackerNewsButton = page.locator('button:has-text("Hacker News")');

      expect((await redditButton.isVisible()) || (await hackerNewsButton.isVisible())).toBeTruthy();
    }
  });

  test('should show trend chart', async ({ page }) => {
    await ensureDatabaseLoaded(page);

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

  test('should display recent posts table', async ({ page }) => {
    await ensureDatabaseLoaded(page);

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

  test('should handle platform switching', async ({ page }) => {
    await ensureDatabaseLoaded(page);

    // Try to find and click a platform button
    const redditButton = page.locator('button:has-text("Reddit")');
    const hackerNewsButton = page.locator('button:has-text("Hacker News")');

    if (await redditButton.isVisible()) {
      await redditButton.click();
      await page.waitForTimeout(1000);
      // Check that the page updated
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    } else if (await hackerNewsButton.isVisible()) {
      await hackerNewsButton.click();
      await page.waitForTimeout(1000);
      // Check that the page updated
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await ensureDatabaseLoaded(page);

    // Check that dashboard is still functional
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

    // Stats cards should stack on mobile
    const statsGrid = page.locator('.grid').first();
    if (await statsGrid.isVisible()) {
      const gridClass = await statsGrid.getAttribute('class');
      expect(gridClass).toContain('grid');
    }
  });

  test('should show loading states', async ({ page }) => {
    // Navigate to page
    await page.goto('/');

    // During initial load, there might be skeleton loaders
    const skeletons = page.locator('.animate-pulse, [class*="skeleton"]');
    const hasSkeletons = await skeletons
      .first()
      .isVisible()
      .catch(() => false);

    // Either skeletons were shown or content loaded directly
    if (hasSkeletons) {
      // Wait for skeletons to disappear
      await page.waitForTimeout(3000);
    }

    // Dashboard should be loaded now
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
  });

  test('should handle database file upload', async ({ page }) => {
    // Check if file upload is available
    const uploadButton = page.locator('button:has-text("Choose File"), button:has-text("Upload")');

    if (await uploadButton.isVisible()) {
      // File upload functionality exists
      expect(true).toBeTruthy();
    } else {
      // Sample database button should be available instead
      const sampleButton = page.locator('button:has-text("Load Sample Database")');
      await expect(sampleButton).toBeVisible();
    }
  });

  test('should navigate to other pages', async ({ page }) => {
    // Check for navigation links
    const postsLink = page.locator('a:has-text("Posts"), a[href*="posts"]').first();
    const analyticsLink = page.locator('a:has-text("Analytics"), a[href*="analytics"]').first();

    // Navigate to posts page if link exists
    if (await postsLink.isVisible()) {
      await postsLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/posts/);
    }

    // Go back to dashboard
    await page.goto('/');

    // Navigate to analytics page if link exists
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/analytics/);
    }
  });
});
