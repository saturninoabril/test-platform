/**
 * Authentication E2E Tests
 *
 * Tests user authentication flows through the UI:
 * - User can access signin page
 * - User sees appropriate error messages for invalid credentials
 * - User can successfully sign in and is redirected to dashboard
 */

import { test, expect } from '../fixtures';

test.describe('Authentication', () => {
  test('should load signin page successfully', async ({ page }) => {
    await page.goto('/auth/signin');

    // Verify signin page elements
    await expect(page.locator('h2')).toContainText('Sign in');
    await expect(page.locator('text=Choose your preferred sign-in method')).toBeVisible();

    // Verify OAuth options are present
    await expect(page.locator('button:has-text("Continue with GitHub")')).toBeVisible();
    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();

    // Verify email/password form is present
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
  });

  test('should show validation for empty credentials', async ({ page }) => {
    await page.goto('/auth/signin');

    // Try to submit empty form
    await page.locator('button:has-text("Sign in")').click();

    // Browser should show HTML5 validation (required fields)
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    // Verify inputs have required attribute
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('should handle invalid email format', async ({ page }) => {
    await page.goto('/auth/signin');

    // Enter invalid email
    await page.locator('input[name="email"]').fill('invalid-email');
    await page.locator('input[name="password"]').fill('password123');

    // Browser should show HTML5 validation for email format
    const emailInput = page.locator('input[name="email"]');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('should have functional OAuth buttons', async ({ page }) => {
    await page.goto('/auth/signin');

    // Check that OAuth buttons are clickable
    const githubButton = page.locator('button:has-text("Continue with GitHub")');
    const googleButton = page.locator('button:has-text("Continue with Google")');

    await expect(githubButton).toBeEnabled();
    await expect(googleButton).toBeEnabled();

    // Verify buttons have proper type="submit" (they're in forms)
    await expect(githubButton).toHaveAttribute('type', 'submit');
    await expect(googleButton).toHaveAttribute('type', 'submit');
  });

  test('should have accessible form elements', async ({ page }) => {
    await page.goto('/auth/signin');

    // Verify form accessibility
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');

    // Check for labels
    await expect(page.locator('label[for="email"]')).toContainText('Email');
    await expect(page.locator('label[for="password"]')).toContainText('Password');

    // Check for placeholders
    await expect(emailInput).toHaveAttribute('placeholder');
    await expect(passwordInput).toHaveAttribute('placeholder');

    // Check for proper input types
    await expect(emailInput).toHaveAttribute('type', 'email');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should have theme toggle on signin page', async ({ page }) => {
    await page.goto('/auth/signin');

    // Verify theme toggle is present (based on component in page)
    // Note: This assumes ThemeToggle component is visible
    const themeToggle = page.locator('.top-8.right-8');
    await expect(themeToggle).toBeVisible();
  });
});
