/**
 * Test Report Detail Page E2E Tests
 *
 * Tests basic user interactions with the test report detail page:
 * - Viewing test report details
 * - Displaying metadata
 * - Expand/collapse file groups
 * - Viewing test results
 */

import { test, expect } from '../fixtures';

test.describe('Test Report Detail Page - Basic Display', () => {
  test('should display test report detail page with metadata', async ({
    page,
    committedDb,
    factories,
  }) => {
    const artifact = await factories.createPlaywrightArtifact(committedDb.db, 'test-run', {
      processingStatus: 'processed',
      githubRepository: 'saturninoabril/test-platform',
      githubActor: 'test-user',
      githubRunNumber: 123,
    });

    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'Sample test',
      status: 'passed',
      duration: 1234,
    });

    await page.goto(`/test-reports/${artifact.id}`);
    await page.waitForLoadState('networkidle');

    // Verify page title
    await expect(page.locator('h1:has-text("Test Report Details")')).toBeVisible();

    // Verify test results section is visible
    await expect(page.locator('text="Test Results"')).toBeVisible();

    // Verify Playwright framework is shown in sidebar (partial match for "Playwright")
    await expect(page.locator('text=/Playwright/i')).toBeVisible();
  });

  test('should display navigation buttons', async ({ page, committedDb, factories }) => {
    const artifacts = await factories.createTestArtifactsWithResults(
      committedDb.db,
      1,
      'playwright'
    );

    await page.goto(`/test-reports/${artifacts[0].id}`);
    await page.waitForLoadState('networkidle');

    // Verify Back button exists
    const backButton = page.locator('a:has-text("Back")');
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveAttribute('href', '/test-reports');

    // Verify Home button exists
    const homeButton = page.locator('a:has-text("Home")');
    await expect(homeButton).toBeVisible();
    await expect(homeButton).toHaveAttribute('href', '/');
  });

  test('should display test results summary', async ({ page, committedDb, factories }) => {
    const artifact = await factories.createPlaywrightArtifact(committedDb.db, 'test-run', {
      processingStatus: 'processed',
    });

    // Create mixed test results
    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'Passing test',
      status: 'passed',
      duration: 1000,
    });
    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'Failing test',
      status: 'failed',
      duration: 2000,
      errorMessage: 'Test failed',
    });

    await page.goto(`/test-reports/${artifact.id}`);
    await page.waitForLoadState('networkidle');

    // Verify summary statistics are shown
    await expect(page.locator('text="Test Results"')).toBeVisible();

    // Verify we can see test counts in sidebar (flexible patterns for any test counts)
    await expect(page.locator('text=/\\d+\\s+tests?/i').first()).toBeVisible();
    await expect(page.locator('text=/\\d+\\s+passed/i').first()).toBeVisible();
    await expect(page.locator('text=/\\d+\\s+failed/i').first()).toBeVisible();
  });
});

test.describe('Test Report Detail Page - Expand/Collapse', () => {
  test('should expand and collapse file groups', async ({ page, committedDb, factories }) => {
    const artifact = await factories.createPlaywrightArtifact(committedDb.db, 'test-run', {
      processingStatus: 'processed',
    });

    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'Test case 1',
      status: 'passed',
      duration: 1000,
    });
    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'Test case 2',
      status: 'failed',
      duration: 2000,
      errorMessage: 'Error details here',
    });

    await page.goto(`/test-reports/${artifact.id}`);
    await page.waitForLoadState('networkidle');

    // Find file header button (contains spec file name)
    const fileHeader = page
      .locator('button')
      .filter({ hasText: /\.spec\.ts/ })
      .first();
    await expect(fileHeader).toBeVisible();

    // Initially collapsed - test titles should not be visible
    await expect(page.locator('text="Test case 1"')).not.toBeVisible();
    await expect(page.locator('text="Test case 2"')).not.toBeVisible();

    // Click to expand
    await fileHeader.click();
    await page.waitForTimeout(500); // Wait for animation

    // Should see test details now
    await expect(page.locator('text="Test case 1"')).toBeVisible();
    await expect(page.locator('text="Test case 2"')).toBeVisible();
    await expect(page.locator('text="Error details here"')).toBeVisible();

    // Click to collapse
    await fileHeader.click();
    await page.waitForTimeout(500);

    // Should hide test details again
    await expect(page.locator('text="Test case 1"')).not.toBeVisible();
  });

  test('should display test details when expanded', async ({ page, committedDb, factories }) => {
    const artifact = await factories.createPlaywrightArtifact(committedDb.db, 'test-run', {
      processingStatus: 'processed',
    });

    await factories.createPlaywrightTestResult(committedDb.db, artifact.id, {
      testTitle: 'My test case',
      status: 'passed',
      duration: 1234,
      browser: 'chromium',
    });

    await page.goto(`/test-reports/${artifact.id}`);
    await page.waitForLoadState('networkidle');

    // Expand file group
    const fileHeader = page
      .locator('button')
      .filter({ hasText: /\.spec\.ts/ })
      .first();
    await fileHeader.click();
    await page.waitForTimeout(500);

    // Verify test details are visible
    await expect(page.locator('text="My test case"')).toBeVisible();
    await expect(page.locator('text=/chromium/i')).toBeVisible();

    // Verify duration is displayed (format like "1.23s")
    await expect(page.locator('text=/1.23s/').first()).toBeVisible();
  });
});

test.describe('Test Report Detail Page - Search and Filter UI', () => {
  test('should display search input', async ({ page, committedDb, factories }) => {
    const artifacts = await factories.createTestArtifactsWithResults(
      committedDb.db,
      1,
      'playwright'
    );

    await page.goto(`/test-reports/${artifacts[0].id}`);
    await page.waitForLoadState('networkidle');

    // Verify search input is visible
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEditable();
  });
});

test.describe('Test Report Detail Page - Error Handling', () => {
  test('should handle artifact not found', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await page.goto(`/test-reports/${fakeId}`);
    await page.waitForLoadState('networkidle');

    // Should show 404 page
    const pageContent = await page.content();
    const has404 = pageContent.includes('404') || pageContent.includes('Not Found');
    expect(has404).toBe(true);
  });

  test('should display processing status for pending artifacts', async ({
    page,
    committedDb,
    factories,
  }) => {
    // Create artifact in pending state (no test results)
    const artifact = await factories.createPlaywrightArtifact(committedDb.db, 'test-run', {
      processingStatus: 'pending',
    });

    await page.goto(`/test-reports/${artifact.id}`);
    await page.waitForLoadState('networkidle');

    // Should show processing status message
    const pageContent = await page.content();
    const hasPendingMessage =
      pageContent.includes('pending') ||
      pageContent.includes('Processing') ||
      pageContent.includes('queued');
    expect(hasPendingMessage).toBe(true);
  });
});
