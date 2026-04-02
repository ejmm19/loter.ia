/**
 * E2E — Prediction Flow
 *
 * Covers: login → dashboard → solicitar predicción → ver resultado → guardar
 * Skipped until Phases 2a/2b (EJM-27, EJM-28) UI is complete.
 */

import { test, expect } from '@playwright/test';

const testUser = {
  email: process.env.E2E_USER_EMAIL || 'qa@test.loter.ia',
  password: process.env.E2E_USER_PASSWORD || 'SecurePassword123!',
};

test.describe('Prediction flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each prediction test
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test.skip('Dashboard shows lottery results list', async ({ page }) => {
    await expect(page.locator('[data-testid="lottery-list"]')).toBeVisible();
    const items = page.locator('[data-testid="lottery-item"]');
    await expect(items).toHaveCountGreaterThan(0);
  });

  test.skip('User can request a prediction for Baloto', async ({ page }) => {
    await page.click('[data-testid="predict-button"]');
    await page.selectOption('[data-testid="lottery-selector"]', 'baloto');
    await page.click('[data-testid="generate-prediction"]');

    await expect(page.locator('[data-testid="prediction-result"]')).toBeVisible({ timeout: 15000 });
    const numbers = page.locator('[data-testid="prediction-number"]');
    await expect(numbers).toHaveCount(6); // Baloto: 5 + 1 balota extra
  });

  test.skip('User can save a prediction to favorites', async ({ page }) => {
    await page.click('[data-testid="predict-button"]');
    await page.selectOption('[data-testid="lottery-selector"]', 'baloto');
    await page.click('[data-testid="generate-prediction"]');
    await expect(page.locator('[data-testid="prediction-result"]')).toBeVisible({ timeout: 15000 });

    await page.click('[data-testid="save-prediction"]');
    await expect(page.locator('[data-testid="save-success-toast"]')).toBeVisible();
  });

  test.skip('Free user sees quota limit after N predictions', async ({ page }) => {
    // This test verifies the paywall kicks in
    await page.goto('/dashboard/predictions');
    await expect(page.locator('[data-testid="quota-indicator"]')).toBeVisible();
  });
});
