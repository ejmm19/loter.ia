/**
 * E2E — Auth Flow
 *
 * Covers: registro → confirmación → login → logout
 * Precondition: app running at BASE_URL (default http://localhost:4200)
 * and API running at API_URL (default http://localhost:8787)
 *
 * All tests are skipped until Phase 1 (EJM-26) UI is complete.
 */

import { test, expect } from '@playwright/test';

const testUser = {
  name: 'Test QA User',
  email: `qa-${Date.now()}@test.loter.ia`,
  password: 'SecurePassword123!',
};

test.describe('Auth flow', () => {
  test.skip('Register — new user can create an account', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="register-submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-greeting"]')).toContainText(testUser.name);
  });

  test.skip('Login — registered user can sign in', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');

    await expect(page).toHaveURL('/dashboard');
  });

  test.skip('Login — shows error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', 'WrongPassword!');
    await page.click('[data-testid="login-submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test.skip('Protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });

  test.skip('Logout — user is redirected to home', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/dashboard');

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/');

    // Verify token is gone — try to revisit dashboard
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
