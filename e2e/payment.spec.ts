/**
 * E2E — Payment / Upgrade Flow
 *
 * Covers: free user → click upgrade → Stripe test checkout → plan activated
 * Uses Stripe test mode card: 4242 4242 4242 4242
 * Skipped until Phase 3 (EJM-29) is complete.
 */

import { test, expect } from '@playwright/test';

const freeUser = {
  email: process.env.E2E_FREE_USER_EMAIL || 'free-qa@test.loter.ia',
  password: process.env.E2E_USER_PASSWORD || 'SecurePassword123!',
};

test.describe('Payment / upgrade flow (Stripe test mode)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', freeUser.email);
    await page.fill('[data-testid="password-input"]', freeUser.password);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test.skip('Free user can view upgrade options', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.locator('[data-testid="plan-free"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-pro"]')).toBeVisible();
  });

  test.skip('User can upgrade to Pro via Stripe test checkout', async ({ page }) => {
    await page.goto('/billing');
    await page.click('[data-testid="upgrade-to-pro"]');

    // Stripe hosted checkout
    await page.waitForURL(/checkout\.stripe\.com/);
    await page.fill('[placeholder="Card number"]', '4242 4242 4242 4242');
    await page.fill('[placeholder="MM / YY"]', '12 / 29');
    await page.fill('[placeholder="CVC"]', '123');
    await page.fill('[placeholder="Name on card"]', 'QA Test User');
    await page.click('[data-testid="submit"]');

    // Redirect back to app
    await page.waitForURL(/loter.*\/billing.*success/);
    await expect(page.locator('[data-testid="plan-badge"]')).toContainText('Pro');
  });

  test.skip('Pro badge is visible on dashboard after upgrade', async ({ page }) => {
    await expect(page.locator('[data-testid="plan-badge"]')).toContainText('Pro');
  });
});
