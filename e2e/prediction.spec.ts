/**
 * E2E — Prediction Flow
 *
 * Covers: login → predictions page → solicitar predicción → ver resultado → guardar
 * Phases 2a/2b (EJM-27, EJM-28) UI complete — tests active.
 *
 * Note: login redirects to /predictions by default; all prediction UI is there.
 */

import { test, expect } from '@playwright/test';

const testUser = {
  email: process.env.E2E_USER_EMAIL || 'qa@test.loter.ia',
  password: process.env.E2E_USER_PASSWORD || 'SecurePassword123!',
};

test.describe('Prediction flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each prediction test — lands on /predictions by default
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/predictions');
  });

  test('Dashboard shows lottery selector and quota indicator', async ({ page }) => {
    // /predictions is the main prediction dashboard
    await expect(page.locator('[data-testid="lottery-selector"]')).toBeVisible();
    await expect(page.locator('[data-testid="quota-indicator"]')).toBeVisible();
  });

  test('User can request a prediction for Baloto', async ({ page }) => {
    await page.selectOption('[data-testid="lottery-selector"]', { index: 0 });
    await page.click('[data-testid="generate-prediction"]');

    await expect(page.locator('[data-testid="prediction-result"]')).toBeVisible({ timeout: 15000 });
    const numbers = page.locator('[data-testid="prediction-number"]');
    await expect(numbers).toHaveCount(6); // Baloto: 5 + 1 balota extra
  });

  test('User can save a prediction to favorites', async ({ page }) => {
    await page.selectOption('[data-testid="lottery-selector"]', { index: 0 });
    await page.click('[data-testid="generate-prediction"]');
    await expect(page.locator('[data-testid="prediction-result"]')).toBeVisible({ timeout: 15000 });

    await page.click('[data-testid="save-prediction"]');
    await expect(page.locator('[data-testid="save-success-toast"]')).toBeVisible();
  });

  test('Free user sees quota limit indicator on predictions page', async ({ page }) => {
    await page.goto('/predictions');
    await expect(page.locator('[data-testid="quota-indicator"]')).toBeVisible();
  });
});
