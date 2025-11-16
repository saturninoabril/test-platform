/**
 * Test Reports List Page E2E Tests
 *
 * Tests basic user interactions with the test reports list page:
 * - Viewing list of reports
 * - Clicking on report cards to navigate
 * - Empty state handling
 * - Error handling
 */

import { test, expect } from '../fixtures';

test.describe('Test Reports List Page', () => {
  test('should display test reports list with metadata', async ({
    page,
    committedDb,
    factories,
  }) => {
    // Create test artifacts
    await factories.createTestArtifactsWithResults(committedDb.db, 3, 'playwright');

    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page.locator('h1:has-text("Test Reports")')).toBeVisible();

    // Verify showing count text (pattern: "Showing 1-3 of 3 reports")
    await expect(page.locator('text=/Showing.*reports?/i')).toBeVisible();
  });

  test('should display report card with framework and metadata', async ({
    page,
    committedDb,
    factories,
  }) => {
    // Create one artifact with known metadata
    await factories.createTestArtifactsWithResults(committedDb.db, 1, 'playwright');

    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Verify framework name is displayed
    await expect(page.locator('text="playwright"').first()).toBeVisible();

    // Verify test statistics are displayed (using partial text "Total:")
    await expect(page.locator('text=/Total:/')).toBeVisible();

    // Verify we see test count numbers (should show numbers like "1", "2", etc.)
    const reportCard = page.locator('text="playwright"').locator('../..');
    await expect(reportCard).toBeVisible();
  });

  test('should navigate to detail page when clicking report card', async ({
    page,
    committedDb,
    factories,
  }) => {
    const artifacts = await factories.createTestArtifactsWithResults(
      committedDb.db,
      1,
      'playwright'
    );

    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Find and click the report card link
    const reportLink = page.locator(`a[href="/test-reports/${artifacts[0].id}"]`).first();
    await expect(reportLink).toBeVisible();

    // Wait for navigation by using page.waitForURL
    await Promise.all([
      page.waitForURL(`**/test-reports/${artifacts[0].id}**`),
      reportLink.click(),
    ]);

    // Verify we're on the detail page
    expect(page.url()).toContain(`/test-reports/${artifacts[0].id}`);
    await expect(page.locator('h1:has-text("Test Report Details")')).toBeVisible();
  });

  test('should handle empty test reports list', async ({ page }) => {
    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Should show empty state message
    await expect(page.locator('text="No test reports found"')).toBeVisible();
    await expect(page.locator('text="Upload test artifacts to see reports here"')).toBeVisible();
  });

  test('should handle non-existent artifact with 404', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await page.goto(`/test-reports/${fakeId}`);
    await page.waitForLoadState('networkidle');

    // Should show 404 page
    const pageContent = await page.content();
    const has404 = pageContent.includes('404') || pageContent.includes('Not Found');
    expect(has404).toBe(true);
  });

  test('should display Home button in header', async ({ page, committedDb, factories }) => {
    await factories.createTestArtifactsWithResults(committedDb.db, 1, 'playwright');

    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Verify Home button exists and is clickable
    const homeButton = page.locator('a:has-text("Home")');
    await expect(homeButton).toBeVisible();
    await expect(homeButton).toHaveAttribute('href', '/');
  });

  test('should display multiple reports correctly', async ({ page, committedDb, factories }) => {
    // Create mix of playwright and cypress reports
    await factories.createTestArtifactsWithResults(committedDb.db, 2, 'playwright');
    await factories.createTestArtifactsWithResults(committedDb.db, 1, 'cypress');

    await page.goto('/test-reports');
    await page.waitForLoadState('networkidle');

    // Should show 3 total reports (using pattern match)
    await expect(page.locator('text=/3.*report/i')).toBeVisible();

    // Should show both frameworks
    await expect(page.locator('text="playwright"').first()).toBeVisible();
    await expect(page.locator('text="cypress"').first()).toBeVisible();
  });
});
