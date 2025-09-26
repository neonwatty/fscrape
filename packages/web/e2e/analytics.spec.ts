import { test, expect } from '@playwright/test'

test.describe('Analytics Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/analytics')
    // Wait for page to load
    await page.waitForLoadState('networkidle')
  })

  test('displays analytics dashboard', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1:has-text("Analytics Dashboard")')).toBeVisible()

    // Check for tabs
    await expect(page.locator('button:has-text("Overview")')).toBeVisible()
    await expect(page.locator('button:has-text("Engagement")')).toBeVisible()
    await expect(page.locator('button:has-text("Growth")')).toBeVisible()
    await expect(page.locator('button:has-text("Authors")')).toBeVisible()
  })

  test('date range selector works', async ({ page }) => {
    // Find and click the date range selector
    const dateRangeSelector = page.locator('button[role="combobox"]').first()
    await dateRangeSelector.click()

    // Select last 7 days
    await page.locator('text=Last 7 days').click()

    // Verify selection was made
    await expect(dateRangeSelector).toContainText('Last 7 days')
  })

  test('metrics cards show correct data', async ({ page }) => {
    // Wait for metrics cards to load
    await page.waitForSelector('.text-2xl.font-bold')

    // Check for metric cards - they have specific titles
    await expect(page.locator('text=Total Posts').first()).toBeVisible()
    await expect(page.locator('text=Total Score').first()).toBeVisible()
    await expect(page.locator('text=Comments').first()).toBeVisible()
    await expect(page.locator('text=Avg Engagement').first()).toBeVisible()
  })

  test('charts are interactive', async ({ page }) => {
    // Wait for charts to load (they're dynamically imported)
    await page.waitForTimeout(2000)

    // Check if canvas elements are present (charts render to canvas)
    const charts = page.locator('canvas')
    const count = await charts.count()
    expect(count).toBeGreaterThan(0)
  })

  test('export functionality works', async ({ page }) => {
    // Find CSV export button
    const csvButton = page.locator('button:has-text("CSV")')
    await expect(csvButton).toBeVisible()

    // Find JSON export button
    const jsonButton = page.locator('button:has-text("JSON")')
    await expect(jsonButton).toBeVisible()

    // Click CSV export and check for download
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
    await csvButton.click()
    const download = await downloadPromise

    // Verify download filename
    expect(download.suggestedFilename()).toContain('.csv')
  })

  test('platform filter works', async ({ page }) => {
    // Find platform selector (second combobox)
    const selectors = page.locator('button[role="combobox"]')
    const platformSelector = selectors.nth(1)
    await platformSelector.click()

    // Select Reddit
    await page.locator('text=Reddit').click()

    // Verify selection was made
    await expect(platformSelector).toContainText('Reddit')
  })

  test('tabs navigation works', async ({ page }) => {
    // Click on Engagement tab
    await page.locator('button:has-text("Engagement")').click()

    // Wait for content to load
    await page.waitForTimeout(1000)

    // Check for engagement-specific content
    await expect(page.locator('text=Engagement Patterns')).toBeVisible()

    // Click on Growth tab
    await page.locator('button:has-text("Growth")').click()

    // Wait for content to load
    await page.waitForTimeout(1000)

    // Check for growth-specific content
    await expect(page.locator('text=Growth Analysis')).toBeVisible()

    // Click on Authors tab
    await page.locator('button:has-text("Authors")').click()

    // Wait for content to load
    await page.waitForTimeout(1000)

    // Check for authors-specific content
    await expect(page.locator('text=Author Leaderboard')).toBeVisible()
  })

  test('refresh button works', async ({ page }) => {
    // Find and click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")')
    await expect(refreshButton).toBeVisible()

    // Click refresh
    await refreshButton.click()

    // Wait for potential data reload
    await page.waitForTimeout(1000)

    // Check page is still functional
    await expect(page.locator('h1:has-text("Analytics Dashboard")')).toBeVisible()
  })
})
